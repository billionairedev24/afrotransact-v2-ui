import { NextRequest, NextResponse } from "next/server"

/**
 * Proxy for /api/v1/checkout-sessions/{id}/result. The post-Stripe confirmation
 * page polls this endpoint until the session converts to an order, fails, or
 * times out. The endpoint is public on the order-service side (opaque UUID).
 */
function apiBase(): string {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8080"
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const res = await fetch(
      `${apiBase()}/api/v1/checkout-sessions/${encodeURIComponent(id)}/result`,
      { cache: "no-store" },
    )
    if (!res.ok) return new NextResponse(null, { status: res.status })
    return NextResponse.json(await res.json())
  } catch (err) {
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      console.error("[API] /api/public/checkout-sessions/:id/result → network error", err)
    }
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 })
  }
}
