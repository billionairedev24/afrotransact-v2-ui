"use client"

import { useEffect, useState } from "react"
import { getRegionConfig } from "@/lib/api"
import { useBuyerLocation } from "@/stores/buyer-location"

type FeatureMap = Record<string, boolean>

export type EffectiveFeaturesSource = "zone" | "region" | "none"

export interface EffectiveFeaturesResult {
  features: FeatureMap
  source: EffectiveFeaturesSource
  loading: boolean
}

/**
 * Resolve feature flags for the current buyer.
 *
 * Order of precedence:
 *  1. `resolvedZone.effectiveFeatures` from the buyer-location store (set
 *     by the Service Zones resolver when a location is chosen).
 *  2. `getRegionConfig(fallbackRegionCode).features` — legacy per-region
 *     config path used before zones existed.
 *  3. Empty map.
 *
 * The hook is intentionally tolerant: resolver miss, network errors, or
 * a missing fallback region all collapse silently to `source: "none"` so
 * downstream callers can default-on / default-off as they see fit.
 */
export function useEffectiveFeatures(
  fallbackRegionCode?: string | null,
): EffectiveFeaturesResult {
  const resolved = useBuyerLocation((s) => s.resolvedZone)
  const [regionFeatures, setRegionFeatures] = useState<FeatureMap | null>(null)
  const [loading, setLoading] = useState(false)

  const zoneHasFeatures =
    !!resolved && Object.keys(resolved.effectiveFeatures ?? {}).length > 0

  useEffect(() => {
    if (zoneHasFeatures) {
      setRegionFeatures(null)
      return
    }
    if (!fallbackRegionCode) {
      setRegionFeatures(null)
      return
    }
    let cancelled = false
    setLoading(true)
    getRegionConfig(fallbackRegionCode)
      .then((cfg) => {
        if (!cancelled) setRegionFeatures(cfg?.features ?? null)
      })
      .catch(() => {
        if (!cancelled) setRegionFeatures(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [zoneHasFeatures, fallbackRegionCode])

  if (zoneHasFeatures && resolved) {
    return { features: resolved.effectiveFeatures, source: "zone", loading: false }
  }
  if (regionFeatures) {
    return { features: regionFeatures, source: "region", loading }
  }
  return { features: {}, source: "none", loading }
}
