/**
 * POST /api/auth/change-password
 *
 * Triggers a Keycloak "UPDATE_PASSWORD" execute-actions-email for the
 * currently authenticated user. This is the same mechanism as "forgot password"
 * — Keycloak sends a secure one-time link to the user's email address.
 *
 * The user never interacts with Keycloak directly. All they see is our UI.
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback
}

async function getAdminToken(): Promise<string | null> {
  const kcIssuer = optionalEnv("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")
  const kcBase = kcIssuer.replace(/\/realms\/.*$/, "")
  const adminUser = optionalEnv("KEYCLOAK_ADMIN_USERNAME", "admin")
  const adminPass = optionalEnv("KEYCLOAK_ADMIN_PASSWORD", "admin")

  try {
    const res = await fetch(`${kcBase}/realms/master/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "admin-cli",
        username: adminUser,
        password: adminPass,
      }),
    })
    if (!res.ok) return null
    const { access_token } = (await res.json()) as { access_token?: string }
    return access_token ?? null
  } catch {
    return null
  }
}

export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminToken = await getAdminToken()
  if (!adminToken) {
    return NextResponse.json(
      { error: "Unable to process your request at this time. Please try again later." },
      { status: 503 }
    )
  }

  const kcIssuer = optionalEnv("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")
  const kcBase = kcIssuer.replace(/\/realms\/.*$/, "")
  const realm = optionalEnv("KEYCLOAK_REALM", "afrotransact")

  const appUrl =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"

  try {
    const res = await fetch(
      `${kcBase}/admin/realms/${realm}/users/${encodeURIComponent(userId)}/execute-actions-email?redirect_uri=${encodeURIComponent(appUrl + "/auth/login?reason=password_updated")}&client_id=${optionalEnv("KEYCLOAK_CLIENT_ID", "afrotransact-web")}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["UPDATE_PASSWORD"]),
      }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error("[change-password] Keycloak execute-actions-email failed", res.status, text.slice(0, 300))
      return NextResponse.json(
        { error: "Failed to send password reset email. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[change-password] Unexpected error", err)
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    )
  }
}
