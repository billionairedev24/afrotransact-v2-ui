"use client"

import { useEffect, useState } from "react"
import { getRegions, getRegionConfig } from "@/lib/api"
import { resolveDefaultRegion } from "@/lib/regions"
import { useBuyerLocation } from "@/stores/buyer-location"

/**
 * "Get a free second trial month by listing 9+ products" is a marketing
 * promotion we may want to switch on/off without a deploy. Backed by the
 * existing per-region feature-flag table (config service) under the key
 * {@code seller_trial_bonus_enabled} so ops can flip it from the admin
 * feature-flags page like any other gate.
 *
 * Defaults to `true` — if the flag isn't set or the config service is
 * unreachable, behaviour matches what shipped today (the bonus is shown).
 * Admins flip it to `false` to hide the offer everywhere the hook is
 * consumed.
 *
 * Source precedence:
 *  1. Buyer-location resolved Service Zone (`effectiveFeatures`).
 *  2. Legacy region config (`getRegionConfig().features`).
 */
export const TRIAL_BONUS_FLAG_KEY = "seller_trial_bonus_enabled"

export function useTrialBonusFlag(): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const resolvedZone = useBuyerLocation((s) => s.resolvedZone)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const zoneFeats = resolvedZone?.effectiveFeatures
        if (zoneFeats && Object.keys(zoneFeats).length > 0) {
          // eslint-disable-next-line no-console
          console.debug("effective-features source=zone (trial-bonus)")
          const value = zoneFeats[TRIAL_BONUS_FLAG_KEY]
          if (value === false) setEnabled(false)
          return
        }
        const regions = await getRegions("", true)
        const region = resolveDefaultRegion(regions)
        if (!region || cancelled) return
        const cfg = await getRegionConfig(region.code).catch(() => null)
        if (cancelled) return
        // eslint-disable-next-line no-console
        console.debug("effective-features source=region (trial-bonus)")
        const value = cfg?.features?.[TRIAL_BONUS_FLAG_KEY]
        if (value === false) setEnabled(false)
        // Any other shape (undefined, true, non-boolean) -> default to on.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [resolvedZone])

  return { enabled, loading }
}
