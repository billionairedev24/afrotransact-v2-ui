"use client"

import { useState } from "react"
import { AlertTriangle, ArrowRight, Loader2, X } from "lucide-react"
import { getAccessToken } from "@/lib/auth-helpers"
import { getStripeUpdateLink, type SellerInfo } from "@/lib/api"
import { toast } from "sonner"

interface Props {
  seller: SellerInfo
}

/**
 * Persistent banner shown when Stripe needs the seller to take action —
 * either because requirements are due, charges are disabled, or payouts are disabled.
 * Clicking "Fix on Stripe" generates a one-time ACCOUNT_UPDATE link and redirects.
 */
export function StripeActionBanner({ seller }: Props) {
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const needsAction =
    seller.stripeRequirementsDue ||
    !seller.chargesEnabled ||
    !seller.payoutsEnabled

  if (!needsAction || dismissed) return null

  const message = seller.stripeDisabledReason
    ? `Your Stripe account is restricted: ${humanizeReason(seller.stripeDisabledReason)}.`
    : !seller.chargesEnabled
      ? "Your Stripe account cannot accept payments yet. Complete the required steps to start selling."
      : !seller.payoutsEnabled
        ? "Your Stripe account cannot receive payouts yet. Complete the required steps to get paid."
        : "Stripe needs additional information from you to keep your account active."

  async function handleFix() {
    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error("Session expired — please sign in again.")
        return
      }
      const { url } = await getStripeUpdateLink(token)
      window.location.href = url
    } catch {
      toast.error("Could not generate Stripe link. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900">Action required on your Stripe account</p>
        <p className="mt-0.5 text-sm text-amber-800">{message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleFix}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
          Fix on Stripe
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-600 hover:text-amber-800 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function humanizeReason(reason: string): string {
  return reason
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
