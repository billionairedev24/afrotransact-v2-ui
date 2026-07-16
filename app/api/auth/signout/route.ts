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
function appendExpiredCookie(response: NextResponse, name: string, domain?: string) {
  // __Host- cookies are host-only by spec and MUST NOT carry a Domain.
  if (domain && name.startsWith("__Host-")) return
  const parts = [`${name}=`, "Path=/", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "SameSite=Lax"]
  if (domain) parts.push(`Domain=${domain}`)
  if (useSecureCookies) parts.push("Secure")
  parts.push("HttpOnly")
  response.headers.append("Set-Cookie", parts.join("; "))
}

/**
 * Clears all NextAuth-related cookies on the response — both host-only AND the
 * domain-scoped (.afrotransact.com) variant, since the session cookie is set
 * with a Domain in production.
 */
function clearNextAuthCookies(req: NextRequest, response: NextResponse) {
  const names = new Set<string>([
    "next-auth.session-token",
    "next-auth.csrf-token",
    "next-auth.callback-url",
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.csrf-token",
    "__Secure-next-auth.callback-url",
    "__Host-next-auth.csrf-token",
  ])
  for (const cookie of req.cookies.getAll()) {
    if (cookie.name.startsWith("next-auth") || cookie.name.startsWith("__Secure-next-auth") || cookie.name.startsWith("__Host-next-auth")) {
      names.add(cookie.name)
    }
  }
  for (const name of names) {
    // Host-only deletion (covers dev + any host-scoped cookie).
    appendExpiredCookie(response, name)
    // Domain-scoped deletion — this is what actually removes the live
    // production session cookie set with Domain=.afrotransact.com.
    if (cookieDomain) appendExpiredCookie(response, name, cookieDomain)
  }
}

async function handleSignout(req: NextRequest) {
  const token = await getToken({ req })

  const publicIssuer = kcIssuerPublic
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001"
  const clientId = process.env.KEYCLOAK_CLIENT_ID || "afrotransact-web"

  // Best-effort Keycloak SSO logout from the SERVER (not via browser
  // redirect). If the id_token_hint refers to a session Keycloak no longer
  // tracks (e.g. Keycloak was restarted, JWKS rotated, session timed out),
  // Keycloak responds with a session_expired error. We silently swallow it
  // — the user's local NextAuth cookies are about to be cleared anyway, so
  // their signed-in state on this app is gone either way. Doing this
  // server-side means the buyer never sees Keycloak's error page.
  // Keycloak accepts client_id alone for RP-initiated logout; id_token_hint is
  // optional (we no longer persist the id_token to keep the session cookie
  // small). The refresh-token revocation in the NextAuth signOut event is the
  // primary SSO terminator; this browser-level logout is belt-and-suspenders.
  {
    const logoutUrl = new URL(`${publicIssuer}/protocol/openid-connect/logout`)
    logoutUrl.searchParams.set("client_id", clientId)
    if (token?.idToken) logoutUrl.searchParams.set("id_token_hint", String(token.idToken))
    try {
      await fetch(logoutUrl.toString(), {
        method: "GET",
        redirect: "manual",
        // Short timeout — we don't want a hung Keycloak to delay the user.
        signal: AbortSignal.timeout(2500),
      })
    } catch {
      // Network blip, timeout, or session_expired — local cleanup proceeds.
    }
  }

  // Always land the buyer on the app's home page. Never on a Keycloak page.
  const response = NextResponse.redirect(baseUrl, { status: 302 })
  clearNextAuthCookies(req, response)
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
  return response
}

export async function GET(req: NextRequest) {
  return handleSignout(req)
}

export async function POST(req: NextRequest) {
  return handleSignout(req)
}
