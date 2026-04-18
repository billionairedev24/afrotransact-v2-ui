import type { CategoryRef, StoreInfo, DealData, HeroSlideConfig } from "@/lib/api"

export interface StorefrontHomePayload {
  categories: CategoryRef[]
  stores: StoreInfo[]
  deals: DealData[]
  platformDeals: unknown[]
  heroSlides: HeroSlideConfig[]
}

/**
 * One client round-trip: categories, stores, deals, platform promos, and hero configs.
 * Backed by `/api/public/home-data` (Next fetch cache + CDN Cache-Control).
 */
export async function fetchStorefrontHomeData(): Promise<StorefrontHomePayload> {
  const res = await fetch("/api/public/home-data", {
    priority: "high",
  })
  if (!res.ok) {
    return {
      categories: [],
      stores: [],
      deals: [],
      platformDeals: [],
      heroSlides: [],
    }
  }
  try {
    return (await res.json()) as StorefrontHomePayload
  } catch {
    return {
      categories: [],
      stores: [],
      deals: [],
      platformDeals: [],
      heroSlides: [],
    }
  }
}
