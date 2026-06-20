"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, AlertTriangle, MapPin, Loader2 } from "lucide-react"

import { checkShippingEligibility, type ShippingEligibility } from "@/lib/api"
import { useBuyerLocation } from "@/stores/buyer-location"

/**
 * "Delivers to 78701 ✓" / "Not available in your area" / soft prompt to
 * pick a delivery location. Mounted on PDP under the buy box and in the
 * cart drawer.
 */
export function ShippingEligibilityBadge({ storeId }: { storeId: string }) {
  const location = useBuyerLocation((s) => s.location)
  const [decision, setDecision] = useState<ShippingEligibility | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
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
        <Loader2 className="h-3 w-3 animate-spin" /> Checking delivery to {location.postalCode}…
      </p>
    )
  }

  if (decision.result === "eligible") {
    return (
      <p className="text-xs text-emerald-700 inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Delivers to <span className="font-semibold">{location.postalCode}</span>
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
        Not available in <span className="font-semibold">{location.postalCode}</span>
        {decision.reason && <span className="text-red-700/80">· {decision.reason}</span>}
      </p>
    )
  }

  // unknown
  return (
    <p className="text-xs text-amber-700 inline-flex items-center gap-1.5">
      <MapPin className="h-3 w-3" />
      Delivery to {location.postalCode} couldn't be verified.
    </p>
  )
}
