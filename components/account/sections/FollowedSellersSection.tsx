"use client"

/**
 * FollowedSellersSection — "Followed sellers". There is no follow-a-seller
 * backend yet, so this renders only the on-brand empty state. No live data
 * fetch, no fabricated sellers.
 */

import { Store } from "lucide-react"

export function FollowedSellersSection() {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gold/15">
        <Store className="h-6 w-6 text-brand-gold-ink" aria-hidden="true" />
      </div>
      <h4 className="mt-4 text-sm font-semibold text-foreground">No followed sellers yet</h4>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
        Follow shops you love to get first word on new drops, restocks, and
        campaigns. Coming soon.
      </p>
    </div>
  )
}
