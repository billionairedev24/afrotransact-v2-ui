import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

function clearAuthCookies(req: NextRequest, response: NextResponse) {
  const isSecure = req.url.startsWith("https")

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
        secure: isSecure || cookie.name.startsWith("__Secure-") || cookie.name.startsWith("__Host-"),
      })
    }
  }

  // Browsers require `secure: true` to clear __Secure- prefixed cookies
  const KNOWN_COOKIES: Array<{ name: string; secure: boolean }> = [
    { name: "next-auth.session-token", secure: false },
    { name: "next-auth.csrf-token", secure: false },
    { name: "next-auth.callback-url", secure: false },
    { name: "__Secure-next-auth.session-token", secure: true },
    { name: "__Secure-next-auth.csrf-token", secure: true },
    { name: "__Secure-next-auth.callback-url", secure: true },
    { name: "__Host-next-auth.csrf-token", secure: true },
  ]
  for (const { name, secure } of KNOWN_COOKIES) {
    response.cookies.set(name, "", {
      maxAge: 0,
      path: "/",
      ...(secure && { secure: true, httpOnly: true, sameSite: "lax" as const }),
    })
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
