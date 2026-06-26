"use client"

import { useEffect, useState } from "react"
import { getRegions, getRegionConfig, type Region } from "@/lib/api"
import { resolveDefaultRegion } from "@/lib/regions"
import { useBuyerLocation } from "@/stores/buyer-location"

/** Default region storefront gates for cart/checkout (public regions + merged config/features). */
export function useDefaultRegionCommerceGates() {
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState<Region | null>(null)
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(true)
  const [stripeEnabled, setStripeEnabled] = useState(true)

  // Service Zones resolver output — preferred source for feature flags.
  const resolvedZone = useBuyerLocation((s) => s.resolvedZone)

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

        // Prefer the resolved zone's effective features when the buyer has a
        // location with zone-scoped flags. Otherwise fall through to the legacy
        // per-region config.
        const zoneFeats = resolvedZone?.effectiveFeatures
        const useZone = !!zoneFeats && Object.keys(zoneFeats).length > 0

        let feats: Record<string, boolean> = {}
        if (useZone && zoneFeats) {
          feats = zoneFeats
          // eslint-disable-next-line no-console
          console.debug("effective-features source=zone (commerce-gates)")
        } else {
          const cfg = await getRegionConfig(r.code).catch(() => null)
          if (cancelled) return
          feats = cfg?.features ?? {}
          // eslint-disable-next-line no-console
          console.debug("effective-features source=region (commerce-gates)")
        }

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
  }, [resolvedZone])

  return {
    loading,
    region,
    marketplaceEnabled,
    stripeEnabled,
    /** Convenience for disabling primary checkout CTAs outside /checkout when killing the marketplace kill-switch early. */
    canEnterCheckoutFlow: marketplaceEnabled,
  }
}
