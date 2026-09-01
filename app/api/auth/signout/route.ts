import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { kcIssuerPublic } from "@/lib/keycloak-issuers"

// In production the session cookie is set with Domain=.afrotransact.com
// (lib/auth.ts, to share auth across subdomains). A cookie set with a Domain
// is a DISTINCT cookie from a host-only one of the same name, and can only be
// deleted by an expiring Set-Cookie carrying the SAME Domain. Keep this in sync
// with lib/auth.ts.
const useSecureCookies = (process.env.NEXTAUTH_URL ?? "").startsWith("https://")
const cookieDomain = useSecureCookies ? ".afrotransact.com" : undefined

/** Append a raw expiring Set-Cookie so we can emit multiple deletions for the
 *  same cookie name (host-only AND domain-scoped) — the NextResponse cookie
 *  jar is keyed by name and would otherwise overwrite. */
function appendExpiredCookie(response: NextResponse, name: string, domain?: string, httpOnly = true) {
  // __Host- cookies are host-only by spec and MUST NOT carry a Domain.
  if (domain && name.startsWith("__Host-")) return
  const parts = [`${name}=`, "Path=/", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "SameSite=Lax"]
  if (domain) parts.push(`Domain=${domain}`)
  if (useSecureCookies) parts.push("Secure")
  if (httpOnly) parts.push("HttpOnly")
  response.headers.append("Set-Cookie", parts.join("; "))
}

/**
 * Clears all NextAuth-related cookies on the response — both host-only AND the
 * domain-scoped (.afrotransact.com) variant, since the session cookie is set
 * with a Domain in production. Covers the session token, CSRF, callback-url,
 * and the OAuth transaction cookies (next-auth.state / pkce.code_verifier).
 */
function clearNextAuthCookies(req: NextRequest, response: NextResponse) {
  const names = new Set<string>([
    "next-auth.session-token",
    "next-auth.csrf-token",
    "next-auth.callback-url",
    "next-auth.state",
    "next-auth.pkce.code_verifier",
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.csrf-token",
    "__Secure-next-auth.callback-url",
    "__Secure-next-auth.state",
    "__Secure-next-auth.pkce.code_verifier",
    "__Host-next-auth.csrf-token",
    "__Host-next-auth.pkce.code_verifier",
  ])
  for (const cookie of req.cookies.getAll()) {
    if (cookie.name.startsWith("next-auth") || cookie.name.startsWith("__Secure-next-auth") || cookie.name.startsWith("__Host-next-auth")) {
      names.add(cookie.name)
    }
  }
  for (const name of names) {
    appendExpiredCookie(response, name)
    if (cookieDomain) appendExpiredCookie(response, name, cookieDomain)
  }
}

/**
 * Clears the app's own `atx_*` cookies so a sign-out leaves no stale
 * marketplace state behind — notably `atx_seller_intent` (which would otherwise
 * re-trigger the seller grant on the next login) and `atx_ref` (referral). These
 * are non-HttpOnly, host-only cookies set via document.cookie / route handlers.
 */
function clearAppCookies(req: NextRequest, response: NextResponse) {
  for (const cookie of req.cookies.getAll()) {
    if (cookie.name.startsWith("atx_")) {
      appendExpiredCookie(response, cookie.name, undefined, false)
      if (cookieDomain) appendExpiredCookie(response, cookie.name, cookieDomain, false)
    }
  }
}

/**
 * Builds Keycloak's RP-initiated (end-session) logout URL. Redirecting the
 * user's BROWSER here is the only way to delete Keycloak's own SSO cookie
 * (KEYCLOAK_IDENTITY) — a server-side fetch carries none of the browser's
 * cookies, so it can't. Keycloak accepts `client_id` + a registered
 * `post_logout_redirect_uri` and logs out silently (no confirmation page).
 * id_token_hint is optional and we don't persist the id_token (keeps the
 * session cookie small), so it's omitted.
 */
async function keycloakLogoutUrl(req: NextRequest, desiredReturn?: string): Promise<string> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001"
  const clientId = process.env.KEYCLOAK_CLIENT_ID || "afrotransact-web"

  // Only allow returning to a same-origin URL (relative path, or absolute under
  // baseUrl); anything else falls back to the home page. This keeps the
  // post_logout_redirect_uri within the client's registered origins.
  let postLogout = baseUrl.replace(/\/+$/, "") + "/"
  if (desiredReturn) {
    try {
      const resolved = new URL(desiredReturn, baseUrl)
      if (resolved.origin === new URL(baseUrl).origin) postLogout = resolved.toString()
    } catch {
      /* ignore malformed callbackUrl — use home */
    }
  }

  const token = await getToken({ req })
  const logoutUrl = new URL(`${kcIssuerPublic}/protocol/openid-connect/logout`)
  logoutUrl.searchParams.set("client_id", clientId)
  logoutUrl.searchParams.set("post_logout_redirect_uri", postLogout)
  if (token?.idToken) logoutUrl.searchParams.set("id_token_hint", String(token.idToken))
  return logoutUrl.toString()
}

/**
 * GET — used as a hard-navigation target (e.g. the VerifyEmailGate "sign out"
 * link, or a plain <a href>). Clears cookies and 302s the browser straight to
 * Keycloak's end-session endpoint, which deletes the SSO cookie and bounces
 * back to the home page.
 */
export async function GET(req: NextRequest) {
  const url = await keycloakLogoutUrl(req)
  const response = NextResponse.redirect(url, { status: 302 })
  clearNextAuthCookies(req, response)
  clearAppCookies(req, response)
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
  return response
}

/**
 * POST — hit by NextAuth's client `signOut()`. It reads `{ url }` from the JSON
 * response and sets `window.location.href = url`, so returning Keycloak's
 * end-session URL makes the BROWSER navigate there (clearing the SSO cookie) —
 * a plain 302 would be followed by fetch() cross-origin WITHOUT the KC cookie,
 * leaving the SSO session alive. The caller's `callbackUrl` becomes the
 * post-logout return target when it's same-origin.
 */
export async function POST(req: NextRequest) {
  let callbackUrl: string | undefined
  try {
    const form = await req.formData()
    const cb = form.get("callbackUrl")
    if (typeof cb === "string") callbackUrl = cb
  } catch {
    /* no/invalid body — default to home */
  }
  const url = await keycloakLogoutUrl(req, callbackUrl)
  const response = NextResponse.json({ url })
  clearNextAuthCookies(req, response)
  clearAppCookies(req, response)
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
  return response
}
