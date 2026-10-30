import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { grantSellerEntitlements } from "@/lib/keycloak-admin"

export const dynamic = "force-dynamic"

const SELLER_INTENT_COOKIE = "atx_seller_intent"

/**
 * POST /api/auth/grant-seller — grants the current user seller entitlements
 * (the `seller` realm role + a durable `registration_role=seller` Keycloak
 * attribute), then clears the seller-intent cookie.
 *
 * This is the app-side replacement for the retired Keycloak SPI role inference:
 * "Start Selling" sets the `atx_seller_intent` cookie before registration, and
 * once the (now-soft-verify) registration produces a session, this route makes
 * the intent durable on the Keycloak ACCOUNT — so it survives email
 * verification even on a different device/browser. Idempotent: a no-op if
 * already a seller.
 *
 * Seller signup is SELF-SERVICE: any authenticated user may become a seller, so
 * being signed in is the only gate. The intent cookie is an optimisation (it
 * tells us to grant eagerly right after registration), NOT an authorization
 * check — requiring it was a prod bug. A user who registered as a buyer first,
 * or who lost the cookie (different browser, cleared cookies, or reaching
 * /dashboard/onboarding by link instead of through "Start Selling"), got
 * `400 no_seller_intent` here, was never granted the `seller` realm role, and
 * then hit "Access Denied" on every role-guarded onboarding endpoint — surfacing
 * as "Failed to save business info" with no usable signal.
 */
export async function POST(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }
  const userId = (token.id as string | undefined) ?? (token.sub as string | undefined)
  if (!userId) {
    return NextResponse.json({ error: "no_user" }, { status: 400 })
  }
  const roles = (token.roles as string[] | undefined) ?? []
  const clearCookie = (res: NextResponse) => {
    res.cookies.set(SELLER_INTENT_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax" })
    return res
  }

  if (roles.includes("seller")) {
    return clearCookie(NextResponse.json({ ok: true, alreadySeller: true }))
  }

  const { registrationOk, realmRoleOk } = await grantSellerEntitlements(userId)
  const ok = registrationOk || realmRoleOk
  // Clear the cookie only on success so a transient failure retries next load.
  const res = NextResponse.json({ ok }, { status: ok ? 200 : 502 })
  return ok ? clearCookie(res) : res
}
