export type FeatureCategory = "commerce" | "marketing" | "beta" | "shipping"

export interface FeatureCatalogEntry {
  key: string
  name: string
  description: string
  category: FeatureCategory
}

// Static fallback — mirrors backend handler/feature_catalog.go so the UI
// can render synchronously without a network round-trip. The
// /zones/feature-catalog endpoint is the source of truth at runtime; if the
// server returns a newer list, prefer that.
export const FEATURE_CATALOG: FeatureCatalogEntry[] = [
  {
    key: "coupons_enabled",
    name: "Coupons",
    description: "Allow buyers to redeem promo codes at checkout.",
    category: "commerce",
  },
  {
    key: "marketplace_enabled",
    name: "Marketplace",
    description:
      "Enable the marketplace surface (cart, checkout, orders). When off the zone is in soft-launch read-only mode.",
    category: "commerce",
  },
  {
    key: "seller_trial_bonus_enabled",
    name: "Seller trial bonus",
    description: "Give new sellers a 30-day commission-free trial.",
    category: "marketing",
  },
  {
    key: "realtime_shipping_enabled",
    name: "Real-time shipping",
    description:
      "Show live carrier rates from Shippo/EasyPost; falls back to platform estimates when off.",
    category: "shipping",
  },
  {
    key: "coming_soon_waitlist_enabled",
    name: "Coming-soon waitlist",
    description:
      "When the zone status is coming_soon, collect buyer emails for the launch.",
    category: "beta",
  },
]

export function featureMeta(key: string): FeatureCatalogEntry | undefined {
  return FEATURE_CATALOG.find((f) => f.key === key)
}
