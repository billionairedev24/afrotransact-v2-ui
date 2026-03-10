import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

/**
 * Server-side middleware: redirects sellers to /dashboard before the
 * page renders so they never see a flash of the customer-facing site.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const skip =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/sell")

  if (skip) return NextResponse.next()

  const token = await getToken({ req: request })
  if (!token) return NextResponse.next()

  const roles = (token.roles as string[]) ?? []
  const isAdmin = roles.includes("admin") || roles.includes("realm-admin")
  if (isAdmin) return NextResponse.next()

  const registrationRole = ((token.registrationRole as string) ?? "").toLowerCase()
  const isSeller = registrationRole === "seller" || roles.includes("seller")

  if (isSeller) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/search/:path*", "/store/:path*", "/account/:path*", "/cart/:path*"],
}
