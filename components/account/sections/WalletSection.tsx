"use client"

/**
 * WalletSection — "Wallet & credit". Gated behind `referralEnabled`. No
 * wallet/ledger/referral backend exists yet, so this renders a static $0.00
 * balance hero, an empty ledger, and a disabled referral-link placeholder.
 * No live data fetch.
 */

import { Wallet, Receipt, Gift, Copy } from "lucide-react"

export function WalletSection() {
  return (
    <div className="space-y-6">
      {/* Balance hero */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-green-soft">
            <Wallet className="h-5 w-5 text-brand-green" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Available balance
            </p>
            <p className="font-display text-3xl font-bold tracking-tight text-brand-green">
              $0.00
            </p>
          </div>
        </div>
      </div>

      {/* Ledger */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Activity</h3>
        <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold/15">
            <Receipt className="h-5 w-5 text-brand-gold-ink" aria-hidden="true" />
          </div>
          <h4 className="mt-3 text-sm font-semibold text-foreground">No activity yet</h4>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Credits from referrals and refunds will show up here.
          </p>
        </div>
      </div>

      {/* Referral link */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Invite friends & family</h3>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 opacity-70">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gold/15">
            <Gift className="h-5 w-5 text-brand-gold-ink" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              Your referral link isn&apos;t ready yet
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Coming soon — share it to earn wallet credit.
            </p>
          </div>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="inline-flex shrink-0 cursor-not-allowed items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Copy
          </button>
        </div>
      </div>
    </div>
  )
}
