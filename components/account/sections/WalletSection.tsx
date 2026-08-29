"use client"

/**
 * WalletSection — "Wallet & credit". Fetches the buyer's referral program
 * status + store-credit balance/ledger and renders real data:
 *  - Available balance hero (store credit, in whole dollars from cents).
 *  - Activity ledger (newest-first, friendly labels per `reason`).
 *  - Invite friends & family card with the referral link + Copy/Share.
 *
 * When the referral program is disabled (`enabled: false`), the section
 * stays visible per the account-hub design but shows a tasteful empty
 * state instead of the invite card. Store credit still renders if present.
 */

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getReferralMe,
  getStoreCreditMe,
  type ReferralMeDto,
  type StoreCreditMeDto,
} from "@/lib/api"
import { logError } from "@/lib/errors"
import { Wallet, Receipt, Gift, Copy, Share2, Loader2, AlertCircle, Users } from "lucide-react"

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const REASON_LABELS: Record<string, string> = {
  referral_referrer: "Referral reward — friend joined",
  referral_referred: "Welcome credit — you were referred",
  checkout_redeem: "Redeemed at checkout",
  refund_reverse: "Refund reversal",
}

function reasonLabel(reason: string) {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ")
}

export function WalletSection() {
  const { status } = useSession()
  const [referral, setReferral] = useState<ReferralMeDto | null>(null)
  const [credit, setCredit] = useState<StoreCreditMeDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const token = await getAccessToken()
      if (!token) {
        setLoading(false)
        return
      }
      try {
        setError(null)
        const [referralData, creditData] = await Promise.all([
          getReferralMe(token),
          getStoreCreditMe(token),
        ])
        if (cancelled) return
        setReferral(referralData)
        setCredit(creditData)
      } catch (e) {
        if (cancelled) return
        logError(e, "loading wallet")
        setError("Failed to load your wallet")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status])

  async function handleCopy(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      toast.success("Referral link copied")
    } catch {
      toast.error("Couldn't copy the link")
    }
  }

  async function handleShare(link: string) {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Join me on AfroTransact", url: link })
      } catch {
        // User cancelled the share sheet — no-op.
      }
    } else {
      handleCopy(link)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16 gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
        <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
        <p className="text-sm text-red-700 flex-1">{error}</p>
      </div>
    )
  }

  const currency = credit?.currency || referral?.currency || "USD"
  const entries = [...(credit?.entries ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

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
              {formatCents(credit?.balanceCents ?? 0, currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Ledger */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Activity</h3>
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold/15">
              <Receipt className="h-5 w-5 text-brand-gold-ink" aria-hidden="true" />
            </div>
            <h4 className="mt-3 text-sm font-semibold text-foreground">No activity yet</h4>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              Credits from referrals and refunds will show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry, i) => {
              const positive = entry.deltaCents >= 0
              return (
                <li
                  key={`${entry.createdAt}-${i}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {reasonLabel(entry.reason)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(entry.createdAt)}
                      {entry.orderNumber ? ` · Order #${entry.orderNumber}` : ""}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-bold ${
                      positive ? "text-brand-green" : "text-muted-foreground"
                    }`}
                  >
                    {positive ? "+" : "−"}
                    {formatCents(Math.abs(entry.deltaCents), currency)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Referral link */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Invite friends & family</h3>
        {!referral?.enabled ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold/15">
              <Gift className="h-5 w-5 text-brand-gold-ink" aria-hidden="true" />
            </div>
            <h4 className="mt-3 text-sm font-semibold text-foreground">
              Referral program isn&apos;t active right now
            </h4>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              Check back soon — we&apos;ll let you know when invites are open.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gold/15">
                <Gift className="h-5 w-5 text-brand-gold-ink" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                {typeof referral.rewardCents === "number" && (
                  <p className="text-sm font-semibold text-foreground">
                    Give {formatCents(referral.rewardCents, currency)}, get{" "}
                    {formatCents(referral.rewardCents, currency)}
                  </p>
                )}
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Share your link — you both get store credit when they place their first order.
                </p>
                {typeof referral.referredCount === "number" && (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {referral.referredCount} friend{referral.referredCount === 1 ? "" : "s"} referred
                  </p>
                )}
              </div>
            </div>

            {referral.link && (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={referral.link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-11 w-full min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 transition"
                />
                <button
                  onClick={() => handleCopy(referral.link!)}
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand-gold px-4 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
                >
                  <Copy className="h-4 w-4" /> Copy
                </button>
                <button
                  onClick={() => handleShare(referral.link!)}
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                  aria-label="Share referral link"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
