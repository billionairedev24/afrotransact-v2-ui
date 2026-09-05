import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const REFERRAL_COOKIE = "atx_ref"
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60

/**
 * Short referral link → registration.
 *
 * The referral service hands out links shaped `https://<host>/r/{code}`
 * (see `GET /api/v1/referral/me`). The whole point of the link is to bring a
 * NEW person in, so we send it straight to the register flow (`/auth/register`,
 * which threads the code through to Keycloak as `referralCode`) rather than the
 * home page. We also stamp the `atx_ref` cookie (30-day, path=/, SameSite=Lax)
 * so the code survives even if the visitor wanders off and registers later, and
 * pass it as `?ref=<code>` (captured by `components/referral/ReferralCapture`).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: raw } = await params
  const code = decodeURIComponent(raw ?? "").trim()
  const valid = Boolean(code) && !code.includes("/") && !code.includes("..")

  const dest = valid
    ? `/auth/register?ref=${encodeURIComponent(code)}`
    : "/"
  const res = NextResponse.redirect(new URL(dest, req.url))

  if (valid) {
    res.cookies.set(REFERRAL_COOKIE, code, {
      path: "/",
      maxAge: THIRTY_DAYS_SECONDS,
      sameSite: "lax",
    })
  }

  return res
}
