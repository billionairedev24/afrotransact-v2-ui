"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, AlertTriangle, MapPin, Loader2 } from "lucide-react"

import { checkShippingEligibility, type ShippingEligibility } from "@/lib/api"
import { useBuyerLocation } from "@/stores/buyer-location"
import { isHouseStore } from "@/lib/house-store"

/**
 * "Delivers to 78701 ✓" / "Not available in your area" / soft prompt to
 * pick a delivery location. Mounted on PDP under the buy box and in the
 * cart drawer.
 */
export function ShippingEligibilityBadge({ storeId }: { storeId: string }) {
  const location = useBuyerLocation((s) => s.location)
  const resolvedZone = useBuyerLocation((s) => s.resolvedZone)
  const [decision, setDecision] = useState<ShippingEligibility | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // First-party eligibility is decided from the resolved service zone
    // (areas of operation), not a seller serviceability call.
    if (isHouseStore(storeId)) return
    if (!location) {
      setDecision(null)
      return
    }
    setLoading(true)
    void checkShippingEligibility({
      storeId,
      lat: location.lat,
      lng: location.lng,
      country: location.country,
      state: location.state,
      postalCode: location.postalCode,
    })
      .then(setDecision)
      .catch(() => setDecision(null))
      .finally(() => setLoading(false))
  }, [storeId, location])

  // First-party: ship only to AfroTransact's areas of operation. The buyer's
  // resolved service zone is the source of truth (enabled = we operate there).
  if (isHouseStore(storeId)) {
    if (!location) {
      return (
        <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
          <MapPin className="h-3 w-3" />
          Pick a delivery location to check availability.
        </p>
      )
    }
    const zoneStatus = resolvedZone?.status
    const outsideAreaOfOperation =
      zoneStatus === "coming_soon" || zoneStatus === "disabled" || zoneStatus === "not_serviced"
    if (outsideAreaOfOperation) {
      return (
        <p className="text-xs text-red-700 inline-flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          Not available in <span className="font-semibold">{location.city?.trim() || location.postalCode}</span> yet
        </p>
      )
    }
    // Only claim "Free delivery" when the zone actually ships free — i.e. it
    // has the always-free override (freeShippingThresholdCents === -1). A
    // flat-rate / per-lb zone (e.g. Georgetown at $7.99) is serviceable but NOT
    // free, so it shows "Delivers to …" with the flat rate when known.
    const settings = resolvedZone?.effectiveSettings
    const cityLabel = location.city?.trim() || location.postalCode
    if (settings?.freeShippingThresholdCents === -1) {
      return (
        <p className="text-xs text-emerald-700 inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Free delivery to <span className="font-semibold">{cityLabel}</span>
        </p>
      )
    }
    const flatCents =
      settings?.shippingMode === "flat" && settings.flatShippingCents && settings.flatShippingCents > 0
        ? settings.flatShippingCents
        : null
    return (
      <p className="text-xs text-emerald-700 inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Delivers to <span className="font-semibold">{cityLabel}</span>
        {flatCents != null && (
          <span className="text-gray-500">· ${(flatCents / 100).toFixed(2)} shipping</span>
        )}
      </p>
    )
  }

  if (!location) {
    return (
      <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
        <MapPin className="h-3 w-3" />
        Pick a delivery location to check availability.
      </p>
    )
  }

  if (loading || !decision) {
    return (
      <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking delivery to {location.city?.trim() || location.postalCode}…
      </p>
    )
  }

  if (decision.result === "eligible") {
    return (
      <p className="text-xs text-emerald-700 inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Delivers to <span className="font-semibold">{location.city?.trim() || location.postalCode}</span>
        {decision.distanceMeters != null && (
          <span className="text-gray-500">· {(decision.distanceMeters / 1000).toFixed(0)} km away</span>
        )}
      </p>
    )
  }

  if (decision.result === "not_eligible") {
    return (
      <p className="text-xs text-red-700 inline-flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" />
        Not available in <span className="font-semibold">{location.city?.trim() || location.postalCode}</span>
        {decision.reason && <span className="text-red-700/80">· {decision.reason}</span>}
      </p>
    )
  }

  // unknown — never alarm the buyer; delivery is confirmed at checkout.
  return (
    <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
      <MapPin className="h-3 w-3" />
      Delivery confirmed at checkout.
    </p>
  )
}
