/**
 * POST /api/auth/set-password
 * Body: { currentPassword: string; newPassword: string }
 *
 * 1. Verifies the current password via ROPC grant
 * 2. Sets the new password via Keycloak Admin API (immediate, no email link)
 * 3. Sends a security notification email via our backend so the user knows
 *    their password was changed (and can take action if it wasn't them)
 *
 * The user never interacts with Keycloak directly.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

function env(name: string, fallback: string) {
  return process.env[name] || fallback
}

/**
 * Obtains an admin token via the afrotransact-admin-api service account
 * (client_credentials grant). This is scoped to manage-users in the
 * afrotransact realm only — no master realm credentials ever leave the
 * Keycloak server, and no username/password is stored in the app.
 */
async function getAdminToken(): Promise<string | null> {
  const kcIssuer = env("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")
  try {
    const res = await fetch(`${kcIssuer}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: "afrotransact-admin-api",
        client_secret: env("KEYCLOAK_ADMIN_API_SECRET", "afrotransact-admin-api-secret"),
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error("[set-password] Admin token fetch failed", res.status, text.slice(0, 200))
      return null
    }
    const { access_token } = (await res.json()) as { access_token?: string }
    return access_token ?? null
  } catch (err) {
    console.error("[set-password] Admin token fetch error", err)
    return null
  }
}

/**
 * Verifies the current password via ROPC against a dedicated internal
 * Keycloak client (`KEYCLOAK_VERIFY_CLIENT_ID`).
 *
 * Use a separate internal client — NOT the public `afrotransact-web` client —
 * so the user-facing client never needs Direct Access Grants enabled.
 *
 * Keycloak setup for the verify client:
 *   Client ID:             afrotransact-internal  (or whatever you name it)
 *   Access Type:           confidential
 *   Standard Flow:         OFF
 *   Direct Access Grants:  ON   ← only this client needs it
 *
 * We try preferred_username first (extracted from the current access token),
 * then fall back to email, because Keycloak's ROPC `username` field must
 * match the Keycloak account username, not necessarily the email address.
 */
async function verifyCurrentPassword(
  email: string,
  password: string,
  accessToken?: string,
): Promise<boolean> {
  const kcIssuer = env("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")

  // Dedicated internal client with Direct Access Grants ON.
  // Falls back to the web client so dev environments work out of the box
  // (enable Direct Access Grants on afrotransact-web in local Keycloak only).
  const clientId = "afrotransact-internal"
  const clientSecret = env("KEYCLOAK_VERIFY_CLIENT_SECRET", env("KEYCLOAK_CLIENT_SECRET", ""))

  // Extract preferred_username from the current access token (most reliable)
  let preferredUsername: string | undefined
  if (accessToken) {
    try {
      const payload = JSON.parse(
        Buffer.from(accessToken.split(".")[1], "base64url").toString(),
      )
      preferredUsername = payload.preferred_username as string | undefined
    } catch {
      // ignore — fall back to email
    }
  }

  // Try preferred_username first, then email
  const candidates = [...new Set([preferredUsername, email].filter(Boolean))] as string[]

  for (const username of candidates) {
    try {
      const res = await fetch(`${kcIssuer}/protocol/openid-connect/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "password",
          client_id: clientId,
          client_secret: clientSecret,
          username,
          password,
        }),
      })

      if (res.ok) return true

      const errBody = await res.text().catch(() => "")
      console.warn(
        `[set-password] ROPC verify failed (client="${clientId}", username="${username}"): HTTP ${res.status}`,
        errBody.slice(0, 300),
      )
    } catch (err) {
      console.warn(`[set-password] ROPC verify error (username="${username}"):`, err)
    }
  }

  return false
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { currentPassword?: string; newPassword?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both current and new password are required" }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 })
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "New password must be different from the current password" }, { status: 400 })
  }

  // Step 1: Verify current password via ROPC — passes the access token so we
  // can extract preferred_username, which is what Keycloak expects in the
  // `username` field (not necessarily the email address).
  const accessToken = (session as { accessToken?: string }).accessToken
  const valid = await verifyCurrentPassword(session.user.email, currentPassword, accessToken)
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
  }

  // Step 2: Get admin token to set new password
  const adminToken = await getAdminToken()
  if (!adminToken) {
    return NextResponse.json(
      { error: "Unable to process your request right now. Please try again." },
      { status: 503 }
    )
  }

  const kcIssuer = env("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")
  const kcBase = kcIssuer.replace(/\/realms\/.*$/, "")
  const realm = env("KEYCLOAK_REALM", "afrotransact")

  try {
    const res = await fetch(
      `${kcBase}/admin/realms/${realm}/users/${encodeURIComponent(session.user.id)}/reset-password`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "password", value: newPassword, temporary: false }),
      }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error("[set-password] Keycloak reset-password failed", res.status, text.slice(0, 300))
      return NextResponse.json({ error: "Failed to update password. Please try again." }, { status: 500 })
    }

    // Step 3: Send security notification email (best-effort — never fails the request)
    void sendPasswordChangedEmail(accessToken ?? "", session.user.id, session.user.email, adminToken, kcBase, realm)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[set-password] Unexpected error", err)
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 })
  }
}

/**
 * Sends a "your password was changed" security notification.
 *
 * Strategy:
 *   1. Try our backend's notification endpoint first (keeps branding consistent)
 *   2. Fall back to Keycloak's built-in execute-actions-email with no required
 *      actions — which triggers Keycloak's "passwordUpdated" event email if the
 *      realm has that email event configured.
 *
 * Either way this is fire-and-forget; failure is logged but never bubbles up.
 */
async function sendPasswordChangedEmail(
  userAccessToken: string,
  userId: string,
  email: string,
  adminToken: string,
  kcBase: string,
  realm: string,
) {
  const apiBase = env("NEXT_PUBLIC_API_URL", "http://localhost:8080")
  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  // Attempt 1: our backend notification endpoint (authenticated as the user)
  try {
    const res = await fetch(`${apiBase}/api/v1/users/me/notify/password-changed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({ email }),
    })
    if (res.ok) return
    console.warn("[set-password] Backend notification endpoint returned", res.status, "— falling back to Keycloak")
  } catch (err) {
    console.warn("[set-password] Backend notification call failed (non-fatal):", err)
  }

  // Attempt 2: Keycloak execute-actions-email with empty actions list triggers
  // the "passwordUpdated" event email if the realm email event is enabled.
  try {
    await fetch(
      `${kcBase}/admin/realms/${realm}/users/${encodeURIComponent(userId)}/execute-actions-email` +
        `?redirect_uri=${encodeURIComponent(appUrl + "/account/settings")}&client_id=${env("KEYCLOAK_CLIENT_ID", "afrotransact-web")}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        // Empty array = no required actions; Keycloak still fires the event email
        // if "Send email on password update" is enabled in realm settings.
        body: JSON.stringify([]),
      }
    )
  } catch (err) {
    console.warn("[set-password] Keycloak fallback notification failed (non-fatal):", err)
  }
}