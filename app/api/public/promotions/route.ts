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
 * Public proxy for the promotions feed. The browser hits this route, which
 * caches upstream for 60s — matches the storefront ISR cadence for marketing
 * surfaces. Returns `{ promotions: [...] }`.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const placement = searchParams.get("placement") ?? ""
  const qs = placement ? `?placement=${encodeURIComponent(placement)}` : ""

  try {
    const res = await fetch(`${apiBase()}/api/v1/promotions${qs}`, {
      next: { revalidate: 60, tags: ["promotions", `promotions:${placement || "all"}`] },
    })
    if (!res.ok) {
      return NextResponse.json({ promotions: [] }, { status: 200 })
    }
    const data = (await res.json()) as { promotions?: unknown[] }
    return NextResponse.json(
      { promotions: Array.isArray(data.promotions) ? data.promotions : [] },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    )
  } catch (err) {
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      console.error("[API] GET /api/public/promotions → network error", err)
    }
    return NextResponse.json({ promotions: [] }, { status: 200 })
  }
}
