"use client"

/**
 * RecipientsSection — a family/recipient address book for ship-to-family
 * checkout flows. Gated behind `recipientsEnabled`; there is no backend for
 * recipients yet, so this renders only the on-brand empty state and a
 * disabled "Add recipient" affordance. No live data fetch.
 */

import { Users, Plus } from "lucide-react"

export function RecipientsSection() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground opacity-70"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add recipient
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gold/15">
          <Users className="h-6 w-6 text-brand-gold-ink" aria-hidden="true" />
        </div>
        <h4 className="mt-4 text-sm font-semibold text-foreground">No recipients yet</h4>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          Save the people you ship to — family back home or anywhere else — so
          checkout remembers their address next time.
        </p>
      </div>
    </div>
  )
}
