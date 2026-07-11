"use client"

// Pass 3 of regions→service_zones migration: the legacy region-config
// fallback has been removed. The flag now comes solely from the resolved
// Service Zone in `useBuyerLocation`. When no zone is resolved (or its
// effective-features map is empty), the trial bonus defaults to FALSE so
// we never show the offer in an unknown rollout context.

import { useEffect, useState } from "react"
import { useBuyerLocation } from "@/stores/buyer-location"

export const TRIAL_BONUS_FLAG_KEY = "seller_trial_bonus_enabled"

export function useTrialBonusFlag(): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const resolvedZone = useBuyerLocation((s) => s.resolvedZone)

  useEffect(() => {
    const feats = resolvedZone?.effectiveFeatures ?? {}
    if (Object.keys(feats).length === 0) {
      setEnabled(false)
      setLoading(false)
      return
    }
    setEnabled(feats[TRIAL_BONUS_FLAG_KEY] === true)
    setLoading(false)
  }, [resolvedZone])

  return { enabled, loading }
}
