"use client"

/**
 * PreordersSection — "My preorders" list. Gated behind `preorderActive`.
 * Preorder campaign order data isn't surfaced to the account hub yet, so
 * this renders only the on-brand empty state. No live data fetch.
 */

import { Hourglass } from "lucide-react"

export function PreordersSection() {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gold/15">
        <Hourglass className="h-6 w-6 text-brand-gold-ink" aria-hidden="true" />
      </div>
      <h4 className="mt-4 text-sm font-semibold text-foreground">No active preorder campaigns yet.</h4>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
        Preorder a campaign item and track its status here — from reservation
        to ship date.
      </p>
    </div>
  )
}
