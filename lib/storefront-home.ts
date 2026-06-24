import type { CategoryRef, StoreInfo, DealData } from "@/lib/api"

export interface StorefrontHomePayload {
  categories: CategoryRef[]
  stores: StoreInfo[]
  deals: DealData[]
  platformDeals: unknown[]
}

/**
 * One client round-trip: categories, stores, deals, platform promos.
 * Backed by `/api/public/home-data` (Next fetch cache + CDN Cache-Control).
 */
export async function fetchStorefrontHomeData(): Promise<StorefrontHomePayload> {
  const res = await fetch("/api/public/home-data", {
    priority: "high",
  })
  if (!res.ok) {
    return { categories: [], stores: [], deals: [], platformDeals: [] }
  }
  try {
    return (await res.json()) as StorefrontHomePayload
  } catch {
    return { categories: [], stores: [], deals: [], platformDeals: [] }
  }
}
