import { type NextRequest, NextResponse } from "next/server"

/**
 * /signup — vanity entry to registration for promos/campaigns.
 *
 * Redirects to the existing Keycloak-backed signup page (`/auth/register`),
 * which initiates NextAuth's `keycloak-register` provider (that provider's
 * authorization URL is Keycloak's `/registrations` endpoint). NextAuth owns
 * the OAuth cruft — client_id, redirect_uri, response_type, scope, state,
 * PKCE — so we never hand-build the long Keycloak URL.
 *
 * `?promo=<code>` is carried through to the post-signup landing as
 * `/?promo=<code>` (via NextAuth's callbackUrl, which survives the Keycloak
 * round-trip), so a campaign tag is readable after signup for attribution.
 *
 * Environment-aware for free: the redirect is same-origin/relative
 * (localhost in dev, the prod domain in prod), and the downstream Keycloak
 * host is resolved per-environment by `kcIssuerPublic` in `lib/auth.ts`.
 *
 * Examples:
 *   /signup              → /auth/register?callbackUrl=%2F
 *   /signup?promo=SUMMER → /auth/register?callbackUrl=%2F%3Fpromo%3DSUMMER
 */
export function GET(req: NextRequest): NextResponse {
  const promo = req.nextUrl.searchParams.get("promo")?.trim()
  const landing = promo ? `/?promo=${encodeURIComponent(promo)}` : "/"

  const dest = new URL("/auth/register", req.url)
  dest.searchParams.set("callbackUrl", landing)

  return NextResponse.redirect(dest, 302)
}
