import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const BETA_COOKIE = "beta_access"
const ALLOWED_COOKIE_VALUE = "granted"

/** Paths reachable without a redeemed beta cohort cookie.
 *
 * The closed-beta gate exists to keep the **storefront purchase funnel**
 * (category browse → product → cart → checkout) invitation-only. Marketing
 * surfaces (homepage, seller pitch, legal, help) and auth bootstrap must
 * always be reachable so prospects can read about the product, sellers can
 * find onboarding info, and invitees can sign in.
 */
function isPublicBetaPath(pathname: string): boolean {
  const exact = [
    "/",                  // marketing landing
    "/favicon.ico",
    "/invite",
    "/robots.txt",
    "/sitemap.xml",
    "/terms",
    "/privacy",
    "/refund-policy",
    "/seller-agreement",
    "/cookies",
    "/help",
    "/about",
    "/sell",              // seller pitch landing
    "/auth/login",
    "/auth/register",
  ]
  if (exact.includes(pathname)) return true

  // Subtree prefixes that should always render:
  //   /invite/*   — invite redemption flow
  //   /auth/*     — sign in / sign up / verify / reset
  //   /sell/*     — seller pricing + apply pages
  //   /help/*     — FAQ subpages
  return ["/invite/", "/auth/", "/sell/", "/help/"].some((p) => pathname.startsWith(p))
}

function isWellKnownAsset(pathname: string): boolean {
  return /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff2?)$/i.test(pathname)
}

/** Authenticated dashboards / internals should not force the storefront invite gate. */
function bypassBuyerBetaGate(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true
  if (pathname.startsWith("/api/")) return true
  if (pathname.startsWith("/admin")) return true
  if (pathname.startsWith("/dashboard")) return true
  if (pathname.startsWith("/invite")) return true // include /invite and subpaths
  if (pathname.startsWith("/o/")) return true
  if (pathname === "/d" || pathname === "/ob") return true
  if (isPublicBetaPath(pathname)) return true
  if (isWellKnownAsset(pathname)) return true
  return false
}

/**
 * Next.js 16+ server proxy (replaces `middleware.ts`): seller routing + optional closed-beta gate.
 *
 * The exported entry wraps the logic in a try/catch that FAILS OPEN. A decode
 * hiccup or cold-start race inside getToken (or any unexpected edge error) must
 * never surface as "MIDDLEWARE_INVOCATION_FAILED" and take the whole site down.
 * Worst case we let the request through — the app's own route guards still
 * enforce auth/authz, so nothing sensitive is exposed by failing open.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  try {
    return await runProxy(request)
  } catch {
    return NextResponse.next()
  }
}

async function runProxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Closed-beta "buyer gate" — DISABLED by default.
  //
  // The closed beta is about SELLER signup (invite-only via admin), not buyer
  // access. Buyers should browse the storefront and purchase freely without any
  // cookie / invite redemption. If a future business decision requires gating
  // the buyer-side too, flip BETA_GATE_ENABLED=true; the redirect machinery
  // below is preserved but inert by default.
  const betaEnabled = process.env.BETA_GATE_ENABLED === "true"
  const inviteSecretConfigured =
    typeof process.env.BETA_INVITE_SECRET === "string" && process.env.BETA_INVITE_SECRET.length > 0

  if (betaEnabled && inviteSecretConfigured && !bypassBuyerBetaGate(pathname)) {
    if (request.cookies.get(BETA_COOKIE)?.value !== ALLOWED_COOKIE_VALUE) {
      const url = request.nextUrl.clone()
      url.pathname = "/invite"
      url.search = ""
      const nextPath = pathname + request.nextUrl.search
      url.searchParams.set("next", nextPath.startsWith("/") ? nextPath : `/${nextPath}`)
      return NextResponse.redirect(url)
    }
  }

  const skipSellerRedirect =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/sell") ||
    pathname.startsWith("/store/") ||
    pathname.startsWith("/stores") ||
    pathname.startsWith("/product/") ||
    pathname.startsWith("/category/") ||
    pathname.startsWith("/o/") ||
    pathname === "/d" ||
    pathname === "/ob"

  if (skipSellerRedirect) return NextResponse.next()

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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
}
