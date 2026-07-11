import { NextResponse } from "next/server"

/**
 * Buyer-facing proxy for /api/v1/cart/resume. The actual JWT verification +
 * cart payload assembly lives in the order-service; this route exists only
 * so the browser doesn't hit the order-service directly (CORS + we keep the
 * INTERNAL_API_URL contract uniform across the app).
 */
function apiBase(): string {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8080"
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 })
  }

  try {
    const res = await fetch(
      `${apiBase()}/api/v1/cart/resume?token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    )
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(body, { status: res.status })
  } catch (err) {
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      console.error("[API] /api/public/cart/resume → network error", err)
    }
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 })
  }
}
