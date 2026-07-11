"use client"

// Service-zone-sourced storefront gates. Effective features come from the
// resolved zone in `useBuyerLocation`. Defaults are PRESENCE-based:
//   - If a key is explicitly set on the zone (or any ancestor) → use that.
//   - If a key is absent OR no zone resolved yet → treat as ENABLED.
//
// The prior "default OFF when features empty" stance accidentally blocked
// every buyer whose location either hadn't resolved yet OR resolved to a
// zone that simply hadn't been configured with a feature row. Marketplace
// is the baseline experience; admins explicitly turn it OFF when they want
// to kill checkout in a region.

import { useEffect, useState } from "react"
import { useBuyerLocation } from "@/stores/buyer-location"

/** Default region storefront gates for cart/checkout (zone-sourced). */
export function useDefaultRegionCommerceGates() {
  const [loading, setLoading] = useState(true)
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(true)
  const [stripeEnabled, setStripeEnabled] = useState(true)

  const resolvedZone = useBuyerLocation((s) => s.resolvedZone)

  useEffect(() => {
    const feats = resolvedZone?.effectiveFeatures ?? {}
    // Presence-based: undefined key → enabled (baseline); explicit false → off.
    setMarketplaceEnabled(feats["marketplace_enabled"] !== false)
    setStripeEnabled(feats["stripe"] !== false)
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
