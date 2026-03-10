import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

/**
 * POST /api/auth/set-seller-intent
 *
 * Called by PostLoginRedirect when it detects the afro_seller_intent cookie.
 * Sets registration_role="seller" on the user in Keycloak via Admin API.
 * After this, every token on ANY device will contain registration_role: "seller".
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const adminToken = await getKeycloakAdminToken()
    if (!adminToken) {
      return NextResponse.json({ error: "Failed to get admin token" }, { status: 500 })
    }

    const kcBase = process.env.KEYCLOAK_ADMIN_URL || process.env.KEYCLOAK_ISSUER?.replace(/\/realms\/.*$/, "") || "http://localhost:8180"
    const realm = process.env.KEYCLOAK_REALM || "afrotransact"

    // Set registration_role attribute on the user
    const res = await fetch(`${kcBase}/admin/realms/${realm}/users/${userId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attributes: {
          registration_role: ["seller"],
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[set-seller-intent] Keycloak PUT failed: ${res.status} ${text}`)
      return NextResponse.json({ error: "Failed to set attribute" }, { status: 500 })
    }

    console.log(`[set-seller-intent] Set registration_role=seller for user ${userId}`)

    const response = NextResponse.json({ success: true })
    // Clear the cookie now that the intent is persisted in Keycloak
    response.cookies.set("afro_seller_intent", "", { path: "/", maxAge: 0 })
    return response
  } catch (e) {
    console.error("[set-seller-intent] Error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

async function getKeycloakAdminToken(): Promise<string | null> {
  const kcBase = process.env.KEYCLOAK_ADMIN_URL || process.env.KEYCLOAK_ISSUER?.replace(/\/realms\/.*$/, "") || "http://localhost:8180"
  const adminUser = process.env.KEYCLOAK_ADMIN_USERNAME || "admin"
  const adminPass = process.env.KEYCLOAK_ADMIN_PASSWORD || "admin"

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
    const data = await res.json()
    return data.access_token ?? null
  } catch {
    return null
  }
}
