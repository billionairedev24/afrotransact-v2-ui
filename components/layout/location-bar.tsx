"use client"

import { MapPin } from "lucide-react"

interface LocationBarProps {
  /** Optional supplemental line shown after the baseline beta copy */
  subtitle?: string
}

/** Static notice — no browser geolocation. Kept so older layouts stay composable until a real picker ships. */
export function LocationBar({ subtitle }: LocationBarProps) {
  return (
    <div className="border-b border-border bg-muted/50">
      <div className="container flex min-h-9 flex-wrap items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-secondary" aria-hidden />
        <span>
          Delivery radius and timelines are confirmed with each seller{" "}
          <span className="font-medium text-foreground">at checkout</span>.
        </span>
        {subtitle ? <span className="text-muted-foreground/90">{subtitle}</span> : null}
      </div>
    </div>
  )
}
