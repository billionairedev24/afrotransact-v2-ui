import { NextRequest, NextResponse } from "next/server"

/**
 * A lightweight proxy/redirector for Keycloak action tokens.
 * Shortens the URL appearance in emails from:
 * http://localhost:8180/realms/afrotransact/login-actions/action-token?key=...&client_id=...
 * To:
 * http://localhost:3001/auth/verify?key=...
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")
  
  if (!key) {
    return NextResponse.redirect(new URL("/auth/error?error=Verification", request.url))
  }

  const kcIssuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER
  if (!kcIssuer) {
    console.error("NEXT_PUBLIC_KEYCLOAK_ISSUER is not defined")
    return NextResponse.redirect(new URL("/auth/error?error=Configuration", request.url))
  }

  // Debug log for verification
  if (process.env.NODE_ENV === "development") {
    console.log(`[AuthVerify] Redirecting to Keycloak. Key present: ${!!key}`)
  }

  const targetUrl = new URL(`${kcIssuer}/login-actions/action-token`)
  
  // Pass through all search params
  searchParams.forEach((value, name) => {
    targetUrl.searchParams.set(name, value)
  })

  // Ensure client_id is set if it was omitted in the short link
  if (!targetUrl.searchParams.has("client_id")) {
    targetUrl.searchParams.set("client_id", process.env.KEYCLOAK_CLIENT_ID || "afrotransact-web")
  }
  
  // Also pass through execution if it exists (sometimes used in Keycloak flows)
  // and other common params. The loop above handles most.

  return NextResponse.redirect(targetUrl.toString())
}
