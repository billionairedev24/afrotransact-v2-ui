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
 * caches upstream briefly. Kept short (15s) so an admin who creates/edits a
 * promotion — especially a POPUP or TICKER — sees it on the storefront within
 * seconds rather than minutes. On a low-traffic site a longer
 * stale-while-revalidate window can keep serving a stale (empty) list because
 * nothing hits it to trigger a refresh, so we cap staleness tightly.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const placement = searchParams.get("placement") ?? ""
  const qs = placement ? `?placement=${encodeURIComponent(placement)}` : ""

  try {
    const res = await fetch(`${apiBase()}/api/v1/promotions${qs}`, {
      next: { revalidate: 15, tags: ["promotions", `promotions:${placement || "all"}`] },
    })
    if (!res.ok) {
      return NextResponse.json({ promotions: [] }, { status: 200 })
    }
    const data = (await res.json()) as { promotions?: unknown[] }
    return NextResponse.json(
      { promotions: Array.isArray(data.promotions) ? data.promotions : [] },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15",
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
