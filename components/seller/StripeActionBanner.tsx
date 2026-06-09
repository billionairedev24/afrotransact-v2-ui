"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, ArrowRight, Loader2, X, ShieldOff, CreditCard, Clock, Hourglass, XCircle } from "lucide-react"
import { getAccessToken } from "@/lib/auth-helpers"
import { getStripeUpdateLink, type SellerInfo } from "@/lib/api"
import { toast } from "sonner"

interface Props {
  seller: SellerInfo
}

const STAGE_META: Record<string, {
  short: string
  tone: string
  border: string
  icon: typeof AlertTriangle
  cta: string
}> = {
  PAYOUTS_PAUSED:  { short: "Payouts paused — finish a Stripe step to keep getting paid.",       tone: "bg-amber-50 text-amber-900",  border: "border-amber-300", icon: ShieldOff,     cta: "Fix on Stripe" },
  CHARGES_PAUSED:  { short: "Your store is offline — buyers can't check out.",                   tone: "bg-rose-50  text-rose-900",   border: "border-rose-300",  icon: CreditCard,    cta: "Restore store" },
  ACTION_REQUIRED: { short: "Stripe needs more information from you.",                            tone: "bg-amber-50 text-amber-900",  border: "border-amber-300", icon: AlertTriangle, cta: "Continue on Stripe" },
  PAST_DUE:        { short: "Information is past due. Submit it now to avoid restrictions.",     tone: "bg-rose-50  text-rose-900",   border: "border-rose-300",  icon: Clock,         cta: "Submit now" },
  UNDER_REVIEW:    { short: "Stripe is reviewing your information. We'll email you with updates.", tone: "bg-blue-50  text-blue-900",   border: "border-blue-300",  icon: Hourglass,     cta: "View status" },
  REJECTED:        { short: "Your Stripe account was rejected. Contact support.",                 tone: "bg-rose-100 text-rose-900",   border: "border-rose-400",  icon: XCircle,       cta: "Contact support" },
}

export function StripeActionBanner({ seller }: Props) {
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const stage = seller.lifecycleStage
  // Fallback to the legacy boolean checks when lifecycleStage isn't populated
  // (older seller rows pre-Phase A).
  const needsAction = stage
    ? stage !== "ACTIVE"
    : (seller.stripeRequirementsDue || !seller.chargesEnabled || !seller.payoutsEnabled)

  if (!needsAction || dismissed) return null

  const meta = (stage ? STAGE_META[stage] : undefined) ?? {
    short: !seller.chargesEnabled
      ? "Your Stripe account cannot accept payments yet."
      : !seller.payoutsEnabled
        ? "Your Stripe account cannot receive payouts yet."
        : "Stripe needs additional information to keep your account active.",
    tone: "bg-amber-50 text-amber-900",
    border: "border-amber-300",
    icon: AlertTriangle,
    cta: "Fix on Stripe",
  }
  const Icon = meta.icon
  const noStripeRedirect = stage === "UNDER_REVIEW" || stage === "REJECTED"

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
    <div className={`mb-6 flex items-start gap-3 rounded-xl border ${meta.border} ${meta.tone} px-4 py-3`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Action required on your Stripe account</p>
        <p className="mt-0.5 text-sm opacity-90">{meta.short}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {noStripeRedirect ? (
          <Link
            href="/dashboard/account-status"
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            {meta.cta}
          </Link>
        ) : (
          <button
            onClick={handleFix}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
            {meta.cta}
          </button>
        )}
        <Link
          href="/dashboard/account-status"
          className="text-xs underline opacity-80 hover:opacity-100"
          title="See full details and required items"
        >
          Details
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
