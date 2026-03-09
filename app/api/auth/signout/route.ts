import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

function clearAuthCookies(req: NextRequest, response: NextResponse) {
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
    response.cookies.set(name, "", { maxAge: 0, path: "/" })
  }

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
}

async function handleSignout(req: NextRequest) {
  const token = await getToken({ req })

  const issuer =
    process.env.KEYCLOAK_ISSUER ||
    "http://localhost:8180/realms/afrotransact"
  const publicIssuer =
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER || issuer
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001"
  const clientId = process.env.KEYCLOAK_CLIENT_ID || "afrotransact-web"

  const logoutUrl = new URL(`${publicIssuer}/protocol/openid-connect/logout`)
  logoutUrl.searchParams.set("client_id", clientId)
  logoutUrl.searchParams.set("post_logout_redirect_uri", baseUrl)

  // Always send id_token_hint — Keycloak accepts expired id_tokens for
  // logout session identification.  Without it, Keycloak shows a
  // confirmation page instead of silently ending the session.
  if (token?.idToken) {
    logoutUrl.searchParams.set("id_token_hint", String(token.idToken))
  }

  const response = NextResponse.redirect(logoutUrl.toString(), { status: 302 })
  clearAuthCookies(req, response)
  return response
}

export async function GET(req: NextRequest) {
  return handleSignout(req)
}

export async function POST(req: NextRequest) {
  return handleSignout(req)
}
