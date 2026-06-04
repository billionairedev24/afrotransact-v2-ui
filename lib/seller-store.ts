import type { StoreDetail } from "@/lib/api"

/**
 * Picks the store used for payouts, orders listing, analytics, etc.
 * Prefer active storefronts and fall back deterministically when a seller owns several.
 */
export function pickPrimarySellerStoreId(stores: StoreDetail[] | undefined | null): string | null {
  if (!stores?.length) return null
  const activePreferred = stores.filter((s) => s.active !== false)
  const pool = activePreferred.length > 0 ? activePreferred : [...stores]
  pool.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  return pool[0]?.id ?? null
}
