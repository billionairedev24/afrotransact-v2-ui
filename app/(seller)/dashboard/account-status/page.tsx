"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle, ShieldOff, CreditCard, Clock, Hourglass, XCircle,
  CheckCircle2, Loader2, ArrowRight, ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { getAccessToken } from "@/lib/auth-helpers"
import { getCurrentSeller, getStripeUpdateLink, type SellerInfo } from "@/lib/api"

const STAGE_META: Record<string, {
  label: string
  tone: string
  icon: typeof AlertTriangle
  headline: (s: SellerInfo) => string
  detail: (s: SellerInfo) => string
}> = {
  PAYOUTS_PAUSED: {
    label: "Payouts paused",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
    icon: ShieldOff,
    headline: () => "Your payouts are paused",
    detail: () => "You can still receive orders, but money won't transfer to your bank until you finish what Stripe is asking for.",
  },
  CHARGES_PAUSED: {
    label: "Charges paused",
    tone: "border-rose-300 bg-rose-50 text-rose-900",
    icon: CreditCard,
    headline: () => "Your store is offline",
    detail: () => "Stripe has paused new charges, so buyers can't check out from your store. Complete the required steps below to restore checkout.",
  },
  ACTION_REQUIRED: {
    label: "Action required",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
    icon: AlertTriangle,
    headline: () => "Stripe needs more information",
    detail: () => "Submit the requested information before the deadline to keep your account in good standing.",
  },
  PAST_DUE: {
    label: "Past due",
    tone: "border-rose-300 bg-rose-50 text-rose-900",
    icon: Clock,
    headline: () => "Information is past due",
    detail: () => "Stripe's deadline for this information has passed. Submit it now to avoid further restrictions.",
  },
  UNDER_REVIEW: {
    label: "Under review",
    tone: "border-blue-300 bg-blue-50 text-blue-900",
    icon: Hourglass,
    headline: () => "Your information is being reviewed",
    detail: () => "Stripe is reviewing what you submitted. You don't need to do anything right now — we'll email you when there's an update.",
  },
  REJECTED: {
    label: "Rejected",
    tone: "border-rose-400 bg-rose-100 text-rose-900",
    icon: XCircle,
    headline: () => "Your account was rejected",
    detail: () => "Stripe has rejected this account. Contact support so we can help.",
  },
}

function humanizeReq(req: string) {
  return req.replace(/^.*\./, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtDeadline(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  const ms = d.getTime() - Date.now()
  const days = Math.floor(ms / 86_400_000)
  const human = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  if (ms <= 0) return { human, relative: "past due", urgent: true }
  if (days <= 3) return { human, relative: days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`, urgent: true }
  return { human, relative: `in ${days} days`, urgent: false }
}

export default function AccountStatusPage() {
  const [openingLink, setOpeningLink] = useState(false)

  const sellerQ = useQuery({
    queryKey: ["seller", "me"],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      return getCurrentSeller(token)
    },
  })

  async function openStripe() {
    setOpeningLink(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      const { url } = await getStripeUpdateLink(token)
      window.location.href = url
    } catch {
      toast.error("Couldn't open Stripe. Try again in a moment.")
    } finally {
      setOpeningLink(false)
    }
  }

  if (sellerQ.isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  const seller = sellerQ.data
  if (!seller) {
    return <div className="p-8 text-sm text-rose-700">Couldn&rsquo;t load your seller profile.</div>
  }

  const stage = seller.lifecycleStage
  const isHealthy = !stage || stage === "ACTIVE"
  const meta = stage ? STAGE_META[stage] : undefined
  const Icon = meta?.icon ?? AlertTriangle
  const outstanding = (seller.currentlyDueItems ?? []).concat(seller.pastDueItems ?? [])
  const deadline = fmtDeadline(seller.currentDeadline)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Account status</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Where your Stripe Connect account stands, and what (if anything) you need to do.
        </p>
      </header>

      {isHealthy ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />
            <div>
              <h2 className="text-lg font-semibold text-emerald-900">Your account is in good standing</h2>
              <p className="mt-1 text-sm text-emerald-800">
                Charges and payouts are enabled. You don&rsquo;t need to do anything.
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-white/60 px-3 py-2">
              <dt className="text-emerald-700">Charges</dt>
              <dd className="font-semibold text-emerald-900">Enabled</dd>
            </div>
            <div className="rounded-lg bg-white/60 px-3 py-2">
              <dt className="text-emerald-700">Payouts</dt>
              <dd className="font-semibold text-emerald-900">Enabled</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className={`rounded-xl border p-6 ${meta?.tone ?? "border-amber-300 bg-amber-50 text-amber-900"}`}>
          <div className="flex items-start gap-3">
            <Icon className="mt-0.5 h-6 w-6 shrink-0" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold">{meta?.headline(seller) ?? "Action required"}</h2>
              <p className="mt-1 text-sm">{meta?.detail(seller) ?? "Stripe needs more information from you."}</p>
              {seller.stripeDisabledReason && (
                <p className="mt-2 text-xs opacity-80">
                  Stripe reason: <strong>{humanizeReq(seller.stripeDisabledReason)}</strong>
                </p>
              )}
            </div>
          </div>

          {deadline && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/60 px-3 py-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Deadline: <strong>{deadline.human}</strong>{" "}
                <span className={deadline.urgent ? "font-semibold" : "opacity-70"}>({deadline.relative})</span>
              </span>
            </div>
          )}

          {outstanding.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">What Stripe is asking for</p>
              <ul className="mt-2 space-y-1.5">
                {outstanding.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                    <span>{humanizeReq(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stage !== "UNDER_REVIEW" && stage !== "REJECTED" && (
            <button
              onClick={openStripe}
              disabled={openingLink}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-60"
            >
              {openingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Continue on Stripe
            </button>
          )}
          {stage === "REJECTED" && (
            <a
              href="mailto:support@afrotransact.com"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
            >
              <ArrowRight className="h-4 w-4" />
              Contact support
            </a>
          )}
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-input bg-white p-4">
          <div className="text-xs font-medium text-muted-foreground">Charges</div>
          <div className={`mt-1 text-lg font-semibold ${seller.chargesEnabled ? "text-emerald-700" : "text-rose-700"}`}>
            {seller.chargesEnabled ? "Enabled" : "Disabled"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {seller.chargesEnabled
              ? "Buyers can complete checkout on your store."
              : "Buyers can't check out right now."}
          </p>
        </div>
        <div className="rounded-xl border border-input bg-white p-4">
          <div className="text-xs font-medium text-muted-foreground">Payouts</div>
          <div className={`mt-1 text-lg font-semibold ${seller.payoutsEnabled ? "text-emerald-700" : "text-rose-700"}`}>
            {seller.payoutsEnabled ? "Enabled" : "Disabled"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {seller.payoutsEnabled
              ? "Money will transfer to your bank on schedule."
              : "Payouts to your bank are on hold."}
          </p>
        </div>
      </section>
    </div>
  )
}
