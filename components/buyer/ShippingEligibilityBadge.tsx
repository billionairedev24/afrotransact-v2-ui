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
 *
 * Layout: every state renders as an icon + a single flowing text span
 * (`flex items-start`, icon `shrink-0`). Keeping all copy in ONE span is
 * deliberate — the earlier `inline-flex` over separate text fragments made
 * the narrow buy-box column shrink each fragment to min-content and stack
 * its words ("Delivers" / "to" · "Georgetown" · "$7.99" / "shipping"),
 * which read as three disjoint columns. A single span wraps as one phrase.
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
        <Line tone="muted" icon={<MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-gray-400" />}>
          Pick a delivery location to check availability.
        </Line>
      )
    }
    const zoneStatus = resolvedZone?.status
    const outsideAreaOfOperation =
      zoneStatus === "coming_soon" || zoneStatus === "disabled" || zoneStatus === "not_serviced"
    const cityLabel = location.city?.trim() || location.postalCode
    if (outsideAreaOfOperation) {
      return (
        <Line tone="error" icon={<AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}>
          Not available in <span className="font-semibold">{cityLabel}</span> yet
        </Line>
      )
    }
    // Only claim "Free delivery" when the zone actually ships free — i.e. it
    // has the always-free override (freeShippingThresholdCents === -1). A
    // flat-rate / per-lb zone (e.g. Georgetown at $7.99) is serviceable but NOT
    // free, so it shows "Delivers to …" with the flat rate when known.
    const settings = resolvedZone?.effectiveSettings
    if (settings?.freeShippingThresholdCents === -1) {
      return (
        <Line tone="ok" icon={<CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />}>
          Free delivery to <span className="font-semibold">{cityLabel}</span>
        </Line>
      )
    }
    const flatCents =
      settings?.shippingMode === "flat" && settings.flatShippingCents && settings.flatShippingCents > 0
        ? settings.flatShippingCents
        : null
    return (
      <Line tone="ok" icon={<CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />}>
        Delivers to <span className="font-semibold">{cityLabel}</span>
        {flatCents != null && (
          <span className="text-gray-500"> · ${(flatCents / 100).toFixed(2)} shipping</span>
        )}
      </Line>
    )
  }

  if (!location) {
    return (
      <Line tone="muted" icon={<MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-gray-400" />}>
        Pick a delivery location to check availability.
      </Line>
    )
  }

  if (loading || !decision) {
    return (
      <Line tone="muted" icon={<Loader2 className="h-3.5 w-3.5 shrink-0 mt-0.5 animate-spin" />}>
        Checking delivery to {location.city?.trim() || location.postalCode}…
      </Line>
    )
  }

  const cityLabel = location.city?.trim() || location.postalCode

  if (decision.result === "eligible") {
    return (
      <Line tone="ok" icon={<CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />}>
        Delivers to <span className="font-semibold">{cityLabel}</span>
        {decision.distanceMeters != null && (
          <span className="text-gray-500"> · {(decision.distanceMeters / 1000).toFixed(0)} km away</span>
        )}
      </Line>
    )
  }

  if (decision.result === "not_eligible") {
    return (
      <Line tone="error" icon={<AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}>
        Not available in <span className="font-semibold">{cityLabel}</span>
        {decision.reason && <span className="text-red-700/80"> · {decision.reason}</span>}
      </Line>
    )
  }

  // unknown — never alarm the buyer; delivery is confirmed at checkout.
  return (
    <Line tone="muted" icon={<MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-gray-400" />}>
      Delivery confirmed at checkout.
    </Line>
  )
}

/**
 * One delivery-status line: a fixed icon plus a single flowing text span.
 * `items-start` + `mt-0.5` on the icon keeps it aligned to the first text
 * line when the copy wraps to two lines.
 */
function Line({
  tone,
  icon,
  children,
}: {
  tone: "ok" | "error" | "muted"
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const toneClass =
    tone === "ok" ? "text-emerald-700" : tone === "error" ? "text-red-700" : "text-gray-500"
  return (
    <p className={`flex items-start gap-1.5 text-xs leading-relaxed ${toneClass}`}>
      {icon}
      <span>{children}</span>
    </p>
  )
}
