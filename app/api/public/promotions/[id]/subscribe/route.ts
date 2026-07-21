import { NextResponse } from "next/server"

function apiBase(): string {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8080"
  )
}

/**
 * Public proxy for the promotion email-capture endpoint. The browser posts an
 * email here; we forward it to the gateway which issues a unique single-use
 * coupon and emails it to the visitor. The upstream status + JSON pass through
 * unchanged so the client can surface success / validation / transient errors.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { email?: unknown }
  const email = typeof body.email === "string" ? body.email : ""

  try {
    const res = await fetch(
      `${apiBase()}/api/v1/promotions/${encodeURIComponent(id)}/subscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        cache: "no-store",
      },
    )
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      console.error("[API] POST /api/public/promotions/[id]/subscribe → network error", err)
    }
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 })
  }
}
