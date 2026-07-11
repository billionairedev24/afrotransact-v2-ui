"use client"

import { useEffect, useState } from "react"

import { checkShippingEligibility, type ShippingEligibility } from "@/lib/api"
import { useBuyerLocation } from "@/stores/buyer-location"
import { isHouseStore } from "@/lib/house-store"

/**
 * Resolves shipping eligibility for each distinct storeId in the cart
 * against the buyer's chosen Deliver-to location. Per-store, not per-item:
 * one cart group shares a reach decision.
 *
 * Returns a Map<storeId, ShippingEligibility | null>. `null` means the
 * buyer hasn't picked a location yet (we can't decide), so the cart
 * should fall back to a soft "Set delivery location" prompt rather than
 * blocking checkout.
 */
export function useCartEligibility(storeIds: string[]) {
  const location = useBuyerLocation((s) => s.location)
  const resolvedZone = useBuyerLocation((s) => s.resolvedZone)
  const [decisions, setDecisions] = useState<Map<string, ShippingEligibility | null>>(new Map())

  const key = storeIds.slice().sort().join(",")
  const zoneStatus = resolvedZone?.status

  useEffect(() => {
    if (!location || storeIds.length === 0) {
      setDecisions(new Map(storeIds.map((id) => [id, null])))
      return
    }
    let cancelled = false
    // First-party (house store) eligibility comes from AfroTransact's areas of
    // operation — the resolved service zone — not a seller serviceability call.
    const houseOutside =
      zoneStatus === "coming_soon" || zoneStatus === "disabled" || zoneStatus === "not_serviced"
    const houseDecision: ShippingEligibility = houseOutside
      ? { result: "not_eligible", reason: "Outside AfroTransact's delivery areas" }
      : { result: "eligible" }
    Promise.all(
      storeIds.map((storeId) => {
        if (isHouseStore(storeId)) {
          return Promise.resolve([storeId, houseDecision] as const)
        }
        return checkShippingEligibility({
          storeId,
          lat: location.lat,
          lng: location.lng,
          country: location.country,
          state: location.state,
          postalCode: location.postalCode,
        })
          .then((d) => [storeId, d] as const)
          .catch(() => [storeId, null] as const)
      }),
    ).then((entries) => {
      if (cancelled) return
      setDecisions(new Map(entries))
    })
    return () => {
      cancelled = true
    }
  }, [key, location, zoneStatus])

  const hasBlocker = Array.from(decisions.values()).some(
    (d) => d?.result === "not_eligible",
  )

  return { decisions, hasBlocker, locationSet: !!location }
}
