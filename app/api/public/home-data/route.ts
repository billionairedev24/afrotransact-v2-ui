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
  } catch {
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

  const [catsRes, storesRes, dealsRes, platformRes, heroRes] = await Promise.all([
    fetch(`${base}/api/v1/categories`, long),
    fetch(`${base}/api/v1/stores`, long),
    fetch(`${base}/api/v1/deals/featured`, dealsTtl),
    fetch(`${base}/api/v1/platform-deals`, long),
    fetch(`${base}/api/v1/config/hero-carousel`, long),
  ])

  const [categoriesRaw, storesRaw, dealsRaw, platformRaw, heroRaw] = await Promise.all([
    safeJson(catsRes),
    safeJson(storesRes),
    safeJson(dealsRes),
    safeJson(platformRes),
    safeJson(heroRes),
  ])

  const categories = Array.isArray(categoriesRaw) ? categoriesRaw : []
  const stores = Array.isArray(storesRaw) ? storesRaw : []
  const deals = Array.isArray(dealsRaw) ? dealsRaw : []
  const platformDeals = Array.isArray(platformRaw) ? platformRaw : []
  const heroSlidesRaw =
    heroRaw &&
    typeof heroRaw === "object" &&
    heroRaw !== null &&
    "slides" in heroRaw &&
    Array.isArray((heroRaw as { slides: unknown }).slides)
      ? (heroRaw as { slides: unknown[] }).slides
      : []
  const heroSlides = heroSlidesRaw

  return NextResponse.json(
    {
      categories,
      stores,
      deals,
      platformDeals,
      heroSlides,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  )
}
