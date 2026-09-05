import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { sendVerifyEmail } from "@/lib/keycloak-admin"

export const dynamic = "force-dynamic"

/**
 * POST /api/auth/send-verify-email — (re)send the current user's verification
 * email. No-ops (200) if the user is already verified. Used by the verify gate
 * on first unverified load and by the "Resend" button in the banner.
 */
export async function POST(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }
  if (token.emailVerified === true) {
    return NextResponse.json({ ok: true, alreadyVerified: true })
  }
  const userId = (token.id as string | undefined) ?? (token.sub as string | undefined)
  if (!userId) {
    return NextResponse.json({ error: "no_user" }, { status: 400 })
  }
  const sent = await sendVerifyEmail(userId)
  return NextResponse.json({ ok: sent }, { status: sent ? 200 : 502 })
}
