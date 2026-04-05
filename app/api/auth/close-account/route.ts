/**
 * POST /api/auth/close-account
 *
 * Permanently deletes the authenticated user's account:
 * 1. Calls the backend to purge user data
 * 2. Deletes the Keycloak user via Admin API
 *
 * The caller should call signOut() client-side after receiving { ok: true }.
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

function env(name: string, fallback: string) {
  return process.env[name] || fallback
}

async function getAdminToken(): Promise<string | null> {
  const kcIssuer = env("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")
  const kcBase = kcIssuer.replace(/\/realms\/.*$/, "")
  try {
    const res = await fetch(`${kcBase}/realms/master/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "admin-cli",
        username: env("KEYCLOAK_ADMIN_USERNAME", "admin"),
        password: env("KEYCLOAK_ADMIN_PASSWORD", "admin"),
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
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessToken = (session as { accessToken?: string }).accessToken
  const apiBase = env("NEXT_PUBLIC_API_URL", "http://localhost:8080")

  // Step 1: Delete user data from our backend (best-effort)
  if (accessToken) {
    try {
      await fetch(`${apiBase}/api/v1/users/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    } catch (err) {
      console.error("[close-account] Backend user delete failed (non-fatal)", err)
    }
  }

  // Step 2: Delete from Keycloak (authoritative)
  const adminToken = await getAdminToken()
  if (!adminToken) {
    return NextResponse.json(
      { error: "Unable to process your request right now. Please contact support." },
      { status: 503 }
    )
  }

  const kcIssuer = env("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")
  const kcBase = kcIssuer.replace(/\/realms\/.*$/, "")
  const realm = env("KEYCLOAK_REALM", "afrotransact")

  try {
    const res = await fetch(
      `${kcBase}/admin/realms/${realm}/users/${encodeURIComponent(session.user.id)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    )

    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "")
      console.error("[close-account] Keycloak delete user failed", res.status, text.slice(0, 300))
      return NextResponse.json(
        { error: "Failed to close account. Please contact support." },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[close-account] Unexpected error", err)
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 })
  }
}