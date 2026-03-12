import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

/**
 * Clears all NextAuth-related cookies on the response.
 */
function clearNextAuthCookies(req: NextRequest, response: NextResponse) {
  // Enumerate the request cookies and expire anything next-auth related.
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
        sameSite: "lax",
      })
    }
  }

  // Also explicitly delete the well-known cookie names in case the
  // request jar is empty (e.g. race condition).
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
    })
  }
}

async function handleSignout(req: NextRequest) {
  const token = await getToken({ req })

  const issuer =
    process.env.KEYCLOAK_ISSUER ||
    "http://localhost:8180/realms/afrotransact"
  const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || "http://localhost:3001"
  const clientId = process.env.KEYCLOAK_CLIENT_ID || "afrotransact-web"

  // Build the Keycloak OIDC logout URL.
  // id_token_hint is critical — without it Keycloak cannot identify the
  // session to destroy and the SSO browser cookie survives, causing the
  // user to be silently re-authenticated on the next page load.
  const logoutUrl = new URL(`${issuer}/protocol/openid-connect/logout`)
  logoutUrl.searchParams.set("client_id", clientId)
  logoutUrl.searchParams.set("post_logout_redirect_uri", baseUrl)

  if (token?.idToken) {
    logoutUrl.searchParams.set("id_token_hint", String(token.idToken))
  }

  const redirectTarget = logoutUrl.toString()
  const response = NextResponse.redirect(redirectTarget, { status: 302 })

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
