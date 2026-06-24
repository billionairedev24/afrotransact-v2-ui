import { NextResponse } from "next/server"

function apiBase(): string {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8080"
  )
}

async function safeJson(res: Response): Promise<unknown | null> {
  if (!res.ok) return null
  try {
    return await res.json()
  } catch (err) {
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      console.error("[API] Error parsing JSON response", err)
    }
    return null
  }
}

/**
 * Aggregates several public catalog/config GETs on the server so the browser makes
 * one request; Next.js caches upstream fetches via `next.revalidate`.
 */
export async function GET() {
  const base = apiBase()
  const long = { next: { revalidate: 120 } as const }
  const dealsTtl = { next: { revalidate: 60 } as const }

  try {
    const [catsRes, storesRes, dealsRes, platformRes] = await Promise.all([
      fetch(`${base}/api/v1/categories`, long),
      fetch(`${base}/api/v1/stores`, long),
      fetch(`${base}/api/v1/deals/featured`, dealsTtl),
      fetch(`${base}/api/v1/platform-deals`, long),
    ])

    const [categoriesRaw, storesRaw, dealsRaw, platformRaw] = await Promise.all([
      safeJson(catsRes),
      safeJson(storesRes),
      safeJson(dealsRes),
      safeJson(platformRes),
    ])

    const categories = Array.isArray(categoriesRaw) ? categoriesRaw : []
    const stores = Array.isArray(storesRaw) ? storesRaw : []
    const deals = Array.isArray(dealsRaw) ? dealsRaw : []
    const platformDeals = Array.isArray(platformRaw) ? platformRaw : []

    return NextResponse.json(
      {
        categories,
        stores,
        deals,
        platformDeals,
      },
      {
        // Reduced from s-maxage=60,s-w-r=300 to 30/60 so home page reflects
        // seller product/deal updates faster. Revalidation server actions
        // in lib/revalidate-actions.ts also bust this explicitly.
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    )
  } catch (err) {
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      console.error("[API] GET /api/public/home-data → network error", err)
    }
    return NextResponse.json(
      { categories: [], stores: [], deals: [], platformDeals: [] },
      { status: 200 }
    )
  }
}
