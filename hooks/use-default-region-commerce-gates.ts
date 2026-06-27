"use client"

// Pass 3 of regions→service_zones migration: the legacy `getRegions()`/
// `getRegionConfig()` fallback has been removed. Effective features now come
// solely from the resolved Service Zone in `useBuyerLocation`. When no zone
// is resolved (or its effective-features map is empty), commerce gates
// default to OFF — we'd rather block a non-resolved buyer from checking out
// than accidentally let a payment through against a missing rollout context.

import { useEffect, useState } from "react"
import { useBuyerLocation } from "@/stores/buyer-location"

/** Default region storefront gates for cart/checkout (zone-sourced). */
export function useDefaultRegionCommerceGates() {
  const [loading, setLoading] = useState(true)
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(false)
  const [stripeEnabled, setStripeEnabled] = useState(false)

  const resolvedZone = useBuyerLocation((s) => s.resolvedZone)

  useEffect(() => {
    const feats = resolvedZone?.effectiveFeatures ?? {}
    if (Object.keys(feats).length === 0) {
      // Conservative default: gates OFF when zone features are empty.
      setMarketplaceEnabled(false)
      setStripeEnabled(false)
      setLoading(false)
      return
    }
    setMarketplaceEnabled(feats["marketplace_enabled"] === true)
    setStripeEnabled(feats["stripe"] === true)
    setLoading(false)
  }, [resolvedZone])

  return {
    loading,
    region: null,
    marketplaceEnabled,
    stripeEnabled,
    /** Convenience for disabling primary checkout CTAs outside /checkout when killing the marketplace kill-switch early. */
    canEnterCheckoutFlow: marketplaceEnabled,
  }
}
