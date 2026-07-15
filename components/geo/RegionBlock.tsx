"use client"

/**
 * RegionBlock hides cart / checkout UIs when the buyer's resolved zone is
 * non-operational. Mounted at the top of cart + checkout pages so we never
 * even render the cart shell for buyers we can't fulfil — they'd otherwise
 * hit a 422 at submit.
 *
 * Unresolved state (null) is treated as "allow" — we don't want to flash a
 * block panel for buyers whose location resolver hasn't responded yet.
 */

import type { ReactNode } from "react"
import Link from "next/link"
import { useBuyerLocation } from "@/stores/buyer-location"

export function RegionBlock({ children }: { children: ReactNode }) {
  const resolvedZone = useBuyerLocation((s) => s.resolvedZone)
  const status = resolvedZone?.status
  const blocked = status === "coming_soon" || status === "disabled" || status === "not_serviced"
  if (!blocked) return <>{children}</>

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full rounded-2xl border border-input bg-card p-8 shadow-sm text-center">
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Cart not available in your region
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          AfroTransact hasn&apos;t launched in your area yet. You can keep browsing,
          but checkout is disabled until we go live.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Browse products
        </Link>
      </div>
    </div>
  )
}
