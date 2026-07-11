// AfroTransact's own first-party storefront identity. Products flowing in from
// the inventory system are listed under this store. It is not a normal seller
// store record, so resolve its display name + delivery locally rather than
// hitting the seller service (which 404s for it).
export const HOUSE_STORE_ID = "00000000-0000-0000-0000-00000000a710"
export const HOUSE_STORE_NAME = "AfroTransact"

export function isHouseStore(storeId: string | null | undefined): boolean {
  return storeId === HOUSE_STORE_ID
}

/**
 * Buyer-facing store name. First-party → "AfroTransact"; otherwise the fetched
 * seller name, falling back to a short label — never the raw UUID.
 */
export function storeDisplayName(storeId: string, fetchedName?: string | null): string {
  if (isHouseStore(storeId)) return HOUSE_STORE_NAME
  const name = fetchedName?.trim()
  if (name && name !== storeId) return name
  return storeId ? `Store ${storeId.slice(0, 8)}` : "Store"
}
