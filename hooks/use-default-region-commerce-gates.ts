"use client"

import { useEffect, useState } from "react"
import { getRegions, getRegionConfig, type Region } from "@/lib/api"
import { resolveDefaultRegion } from "@/lib/regions"

/** Default region storefront gates for cart/checkout (public regions + merged config/features). */
export function useDefaultRegionCommerceGates() {
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState<Region | null>(null)
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(true)
  const [stripeEnabled, setStripeEnabled] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const regions = await getRegions("", true)
        const r = resolveDefaultRegion(regions)
        if (!r || cancelled) {
          setLoading(false)
          return
        }
        setRegion(r)
        const cfg = await getRegionConfig(r.code).catch(() => null)
        if (cancelled) return
        const feats = cfg?.features ?? {}
        const mk =
          feats["marketplace_enabled"] !== undefined ? feats["marketplace_enabled"] === true : undefined
        const st =
          feats["stripe"] !== undefined ? feats["stripe"] === true : undefined
        if (mk !== undefined) setMarketplaceEnabled(mk)
        else setMarketplaceEnabled(true)
        if (st !== undefined) setStripeEnabled(st)
        else setStripeEnabled(true)
      } catch {
        if (!cancelled) {
          setRegion(null)
          setMarketplaceEnabled(true)
          setStripeEnabled(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    loading,
    region,
    marketplaceEnabled,
    stripeEnabled,
    /** Convenience for disabling primary checkout CTAs outside /checkout when killing the marketplace kill-switch early. */
    canEnterCheckoutFlow: marketplaceEnabled,
  }
}
