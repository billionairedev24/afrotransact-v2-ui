"use client"

import { useBuyerLocation } from "@/stores/buyer-location"

type FeatureMap = Record<string, boolean>

/** No "region" any more — there is exactly one source. */
export type EffectiveFeaturesSource = "zone" | "none"

export interface EffectiveFeaturesResult {
  features: FeatureMap
  source: EffectiveFeaturesSource
  loading: boolean
}

/**
 * Resolve feature flags for the current buyer.
 *
 * ONE source: `resolvedZone.effectiveFeatures`, set by the Service Zones
 * resolver. There is deliberately no second source.
 *
 * There used to be a fallback to `getRegionConfig(code).features`, the
 * per-region config that predates zones. It caused a production bug that was
 * hard to see: every zone returned `coupons_enabled: true` while every region
 * still returned `coupons_enabled: false`, so whether a buyer saw the coupon
 * box depended on whether their device happened to have resolved a zone. A
 * desktop that had browsed before carried one in its persisted store and kept
 * the box; a real phone that denied location, or a fresh device, fell through
 * to the stale region config and lost it. It looked like an iOS bug and was
 * two disagreeing config sources.
 *
 * Two sources for one answer will always eventually disagree, and the one that
 * loses will be whichever the reader forgot about. So a resolver miss now
 * returns an EMPTY map — "we do not know yet" — and callers default a missing
 * flag to its safe value rather than being handed stale data.
 */
export function useEffectiveFeatures(): EffectiveFeaturesResult {
  const resolved = useBuyerLocation((s) => s.resolvedZone)

  const zoneHasFeatures =
    !!resolved && Object.keys(resolved.effectiveFeatures ?? {}).length > 0

  if (zoneHasFeatures && resolved) {
    return { features: resolved.effectiveFeatures, source: "zone", loading: false }
  }
  // No zone resolved yet. Deliberately returns EMPTY rather than falling back
  // to per-region config: callers default a missing flag to its safe value, and
  // "we do not know yet" must never be answered with stale data from a second
  // source. See the note above for what that cost in production.
  return { features: {}, source: "none", loading: false }
}
