import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"

const BETA_COOKIE = "beta_access"

/**
 * Validates a cohort invite token and sets the beta gate cookie enforced in `proxy.ts`.
 *
 * Intended for Wave 1 / closed beta cohorts alongside Keycloak access policy.
 */
export async function POST(req: NextRequest) {
  const enabled = process.env.BETA_GATE_ENABLED === "true"
  const secretEnv = process.env.BETA_INVITE_SECRET
  const secret =
    typeof secretEnv === "string" && secretEnv.length > 0 ? secretEnv : null

  if (!enabled || !secret) {
    return NextResponse.json({ ok: false, error: "beta_gate_disabled" }, { status: 404 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const token =
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as { token?: unknown }).token === "string"
      ? String((raw as { token?: string }).token).trim()
      : ""

  const a = Buffer.from(token, "utf8")
  const b = Buffer.from(secret, "utf8")
  const valid = a.length === b.length && a.length > 0 && timingSafeEqual(a, b)

  if (!valid) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(BETA_COOKIE, "granted", {
    path: "/",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 90,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  return res
}
