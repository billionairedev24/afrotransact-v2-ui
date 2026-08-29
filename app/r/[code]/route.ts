import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const REFERRAL_COOKIE = "atx_ref"
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60

/**
 * Short referral link → home page.
 *
 * The referral service hands out links shaped `https://<host>/r/{code}`
 * (see `GET /api/v1/referral/me`). Visiting one stamps the `atx_ref` cookie
 * (30-day, path=/, SameSite=Lax) so the register flow can thread the code
 * through as `referralCode`, then bounces to the home page. `?ref=<code>`
 * query params on any other landing page are captured the same way by
 * `components/referral/ReferralCapture.tsx`.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: raw } = await params
  const code = decodeURIComponent(raw ?? "").trim()

  const res = NextResponse.redirect(new URL("/", req.url))

  if (code && !code.includes("/") && !code.includes("..")) {
    res.cookies.set(REFERRAL_COOKIE, code, {
      path: "/",
      maxAge: THIRTY_DAYS_SECONDS,
      sameSite: "lax",
    })
  }

  return res
}
