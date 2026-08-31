import { NextRequest, NextResponse } from "next/server"

/**
 * Clears NextAuth's short-lived OAuth *transaction* cookies (state + PKCE)
 * BEFORE a fresh sign-in/sign-up flow starts.
 *
 * Why: the app registers three Keycloak providers (`keycloak`,
 * `keycloak-register`, `keycloak-register-seller`) against the same issuer, but
 * NextAuth v4 stores the OAuth `state` in a SINGLE, non-provider-namespaced
 * cookie. If a stale `state`/`pkce` cookie from one provider survives into
 * another provider's callback (easy to hit when a login and a register flow
 * interleave, or after abandoned attempts), NextAuth rejects it with
 * "state cookie was created for a different provider than the one handling the
 * callback" → an OAuthCallback error. Wiping these two cookies right before
 * `signIn()` guarantees the next flow starts clean.
 *
 * Deliberately does NOT touch the CSRF token (signIn needs it) or the session.
 */
const useSecureCookies = (process.env.NEXTAUTH_URL ?? "").startsWith("https://")
const cookieDomain = useSecureCookies ? ".afrotransact.com" : undefined

// Both unprefixed and __Secure-/__Host- prefixed names, since the prefix depends
// on the deployment (https vs http).
const OAUTH_TXN_COOKIES = [
  "next-auth.state",
  "next-auth.pkce.code_verifier",
  "__Secure-next-auth.state",
  "__Secure-next-auth.pkce.code_verifier",
  "__Host-next-auth.pkce.code_verifier",
]

function expire(res: NextResponse, name: string, domain?: string) {
  if (domain && name.startsWith("__Host-")) return // __Host- cookies must be host-only
  const parts = [`${name}=`, "Path=/", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "SameSite=Lax", "HttpOnly"]
  if (domain) parts.push(`Domain=${domain}`)
  if (useSecureCookies) parts.push("Secure")
  res.headers.append("Set-Cookie", parts.join("; "))
}

function handle(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 })
  for (const cookie of req.cookies.getAll()) {
    if (/^(?:__Secure-|__Host-)?next-auth\.(state|pkce\.)/.test(cookie.name)) {
      expire(res, cookie.name)
      if (cookieDomain) expire(res, cookie.name, cookieDomain)
    }
  }
  // Belt-and-suspenders: expire the known names even if not currently present.
  for (const name of OAUTH_TXN_COOKIES) {
    expire(res, name)
    if (cookieDomain) expire(res, name, cookieDomain)
  }
  res.headers.set("Cache-Control", "no-store")
  return res
}

export async function POST(req: NextRequest) {
  return handle(req)
}
