import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { kcIssuerPublic } from "@/lib/keycloak-issuers"

/**
 * Clears all NextAuth-related cookies on the response.
 */
function clearNextAuthCookies(req: NextRequest, response: NextResponse) {
  for (const cookie of req.cookies.getAll()) {
    if (
      cookie.name.startsWith("next-auth") ||
      cookie.name.startsWith("__Secure-next-auth") ||
      cookie.name.startsWith("__Host-next-auth")
    ) {
      response.cookies.set(cookie.name, "", {
        maxAge: 0,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      })
    }
  }

  const KNOWN_COOKIES = [
    "next-auth.session-token",
    "next-auth.csrf-token",
    "next-auth.callback-url",
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.csrf-token",
    "__Secure-next-auth.callback-url",
    "__Host-next-auth.csrf-token",
  ]
  for (const name of KNOWN_COOKIES) {
    response.cookies.set(name, "", {
      maxAge: 0,
      path: "/",
      secure: process.env.NODE_ENV === "production",
    })
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
