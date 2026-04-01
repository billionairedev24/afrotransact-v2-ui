"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  CreditCard,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  X,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogHeader, DialogBody, DialogFooter, ConfirmDialog } from "@/components/ui/Dialog"
import {
  getSubscription,
  startTrial,
  getPublicPlans,
  cancelSubscription,
  changePlan,
  getCurrentSeller,
  getPaymentInfo,
  type SellerSubscription,
  type SubscriptionPlan,
  type SellerInfo,
  type PaymentInfo,
} from "@/lib/api"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  trial:          { label: "Trial",          color: "text-sky-400",    bg: "bg-sky-500/10 border-sky-500/20",     icon: <Clock className="h-4 w-4" />        },
  trial_extended: { label: "Trial Extended", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <Zap className="h-4 w-4" />         },
  active:         { label: "Active",         color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <Check className="h-4 w-4" />        },
  past_due:       { label: "Payment Due",   color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",     icon: <AlertTriangle className="h-4 w-4" /> },
  cancelled:      { label: "Cancelled",      color: "text-gray-400",   bg: "bg-gray-500/10 border-gray-500/20",   icon: <X className="h-4 w-4" />             },
  suspended:      { label: "Suspended",      color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",     icon: <AlertTriangle className="h-4 w-4" /> },
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function daysUntil(iso: string | null): number {
  if (!iso) return 0
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function commissionLabel(plan: SubscriptionPlan): string {
  if (plan.commissionRateOverride != null) return `${plan.commissionRateOverride}%`
  return "Standard"
}

function buildBillingTimeline(sub: SellerSubscription | null): Array<{ label: string; date: string | null; value?: string }> {
  if (!sub) return []
  const items: Array<{ label: string; date: string | null; value?: string }> = []
  if (sub.trialStartedAt) items.push({ label: "Trial started", date: sub.trialStartedAt })
  if (sub.trialEndsAt) {
    const days = daysUntil(sub.trialEndsAt)
    items.push({ label: "Trial ends", date: sub.trialEndsAt, value: days > 0 ? `${days} days remaining` : "Expired" })
  }
  if (sub.billingStartsAt) items.push({ label: "Billing started", date: sub.billingStartsAt })
  if (sub.nextBillingDate && !sub.cancelAtPeriodEnd) items.push({ label: "Next billing", date: sub.nextBillingDate })
  if (sub.cancelledAt) items.push({ label: "Cancelled", date: sub.cancelledAt })
  return items
}

export default function SubscriptionPage() {
  const { status } = useSession()

  const [subscription, setSubscription] = useState<SellerSubscription | null>(null)
  const [seller, setSeller] = useState<SellerInfo | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trialLoading, setTrialLoading] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  const [changePlanOpen, setChangePlanOpen] = useState(false)
  const [changePlanLoading, setChangePlanLoading] = useState<string | null>(null)

  async function loadAll() {
    const token = await getAccessToken()
    if (!token) return
    try {
      setError(null)
      const [subRes, plansRes, sellerRes, payInfo] = await Promise.all([
        getSubscription(token).catch((e) => {
          if (e?.status === 404) return null
          throw e
        }),
        getPublicPlans(),
        getCurrentSeller(token).catch(() => null),
        getPaymentInfo(token).catch(() => null),
      ])
      setSubscription(subRes)
      setPlans(plansRes ?? [])
      setSeller(sellerRes)
      setPaymentInfo(payInfo)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load subscription")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false)
      return
    }
    loadAll()
  }, [status])

  async function handleStartTrial() {
    const token = await getAccessToken()
    if (!token) return
    setTrialLoading(true)
    setError(null)
    try {
      const sub = await startTrial(token, "starter")
      setSubscription(sub)
      toast.success("Free trial started!")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start trial")
    } finally {
      setTrialLoading(false)
    }
  }

  async function handleCancelSubscription() {
    const token = await getAccessToken()
    if (!token) return
    setCancelLoading(true)
    setError(null)
    try {
      const sub = await cancelSubscription(token)
      setSubscription(sub)
      setConfirmCancel(false)
      toast.success("Subscription cancellation requested")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to cancel subscription")
    } finally {
      setCancelLoading(false)
    }
  }

  async function handleChangePlan(planSlug: string) {
    const token = await getAccessToken()
    if (!token) return
    setChangePlanLoading(planSlug)
    try {
      const sub = await changePlan(token, planSlug)
      setSubscription(sub)
      setChangePlanOpen(false)
      toast.success(`Plan changed to ${sub.plan.name}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to change plan")
    } finally {
      setChangePlanLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-gray-500">Loading subscription...</p>
      </div>
    )
  }

  if (error && !subscription) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
        <div className="flex items-center gap-3 text-red-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">Please try again later or contact support.</p>
        <button onClick={() => { setLoading(true); loadAll() }} className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    )
  }

  const statusCfg = subscription ? (STATUS_CONFIG[subscription.status] ?? STATUS_CONFIG.active) : null
  const billingTimeline = buildBillingTimeline(subscription)
  const trialDays = subscription?.trialEndsAt ? daysUntil(subscription.trialEndsAt) : 0

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription & Billing</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your AfroTransact seller subscription</p>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-600">{error}</span>
        </div>
      )}

      {/* ── No subscription: Start Trial CTA ── */}
      {!subscription && (
        <>
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-8 text-center">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Start Your Free Trial</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
              Get full seller access with a free trial. No credit card required.
            </p>
            <button
              onClick={handleStartTrial}
              disabled={trialLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-header hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {trialLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting...</> : "Start Free Trial"}
            </button>
          </div>
          {plans.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" /> Available Plans
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} isCurrent={false} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Has subscription: Full management UI ── */}
      {subscription && statusCfg && (
        <>
          {/* Status header */}
          <div className={`rounded-2xl border ${statusCfg.bg} p-6`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${statusCfg.bg} ${statusCfg.color}`}>
                  {statusCfg.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${statusCfg.color}`}>{statusCfg.label}</span>
                    <span className="text-xs text-gray-500">·</span>
                    <span className="text-xs text-gray-500">{subscription.plan.name} Plan</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {subscription.statusMessage ?? `${subscription.plan.name} plan`}
                  </p>
                </div>
              </div>
              {(subscription.status === "trial" || subscription.status === "trial_extended") && trialDays > 0 && (
                <div className="rounded-lg bg-gray-50 px-3 py-1.5 border border-gray-200">
                  <span className="text-sky-400 font-semibold">{trialDays} days</span>
                  <span className="text-gray-500 text-xs ml-1">left in trial</span>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setChangePlanOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <TrendingUp className="h-3.5 w-3.5" /> Change Plan
                </button>
              </div>
            </div>
          </div>

          {/* Current plan + Billing timeline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Current Plan — {subscription.plan.name}
              </h2>
              <div className="space-y-2">
                {(subscription.plan.features ?? []).map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="text-gray-600">{f}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="text-gray-600">Up to {subscription.plan.maxProducts} products</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="text-gray-600">{subscription.plan.maxStores} store{subscription.plan.maxStores !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="text-gray-600">{commissionLabel(subscription.plan)} commission</span>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Monthly price</span>
                  <span className="font-bold text-gray-900">
                    {subscription.plan.priceDisplay || formatPrice(subscription.plan.priceCentsPerMonth)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Billing Timeline
              </h2>
              <div className="space-y-3 text-sm">
                {billingTimeline.length > 0 ? (
                  billingTimeline.map((item, i) => (
                    <div key={i} className="flex justify-between items-start gap-4">
                      <span className="text-gray-500">{item.label}</span>
                      <div className="text-right">
                        <span className="text-gray-900 block">{formatDate(item.date)}</span>
                        {item.value && <span className="text-sky-400 font-semibold text-xs">{item.value}</span>}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No billing events yet</p>
                )}
              </div>
              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 leading-relaxed">
                  You&apos;ll receive an email before your trial ends with billing details.
                </p>
              </div>
            </div>
          </div>

          {/* Billing history */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <CreditCard className="h-4 w-4 text-primary" /> Billing History
            </h2>
            <div className="space-y-2">
              {subscription.trialStartedAt && (
                <div className="flex items-center justify-between py-2.5 border-b border-gray-200 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-gray-900 font-medium">Trial started</p>
                      <p className="text-xs text-gray-500">{formatDate(subscription.trialStartedAt)}</p>
                    </div>
                  </div>
                  <span className="text-emerald-400 font-semibold">Free</span>
                </div>
              )}
              {subscription.cancelAtPeriodEnd && (
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20">
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-gray-900 font-medium">Cancellation requested</p>
                      <p className="text-xs text-gray-500">Effective at period end</p>
                    </div>
                  </div>
                </div>
              )}
              {!subscription.trialStartedAt && !subscription.cancelAtPeriodEnd && (
                <p className="text-sm text-gray-500 py-4">No billing events yet</p>
              )}
            </div>
          </div>

          {/* Payment & Payout Setup */}
          <PaymentMethodCard seller={seller} paymentInfo={paymentInfo} />

          {/* Danger zone: Cancel */}
          {!subscription.cancelAtPeriodEnd && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
              <h2 className="text-sm font-semibold text-red-400 mb-3">Danger Zone</h2>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-gray-500">
                  Cancelling will keep your store active until the end of the current period.
                </p>
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="text-sm font-medium text-red-600 hover:text-red-700 border border-red-500/30 rounded-lg px-4 py-2 hover:bg-red-500/10 transition-colors"
                >
                  Cancel Subscription
                </button>
              </div>
            </div>
          )}

          {/* Change Plan Dialog */}
          <ChangePlanDialog
            open={changePlanOpen}
            onClose={() => setChangePlanOpen(false)}
            plans={plans}
            currentPlanId={subscription.plan.id}
            loading={changePlanLoading}
            onSelect={handleChangePlan}
          />

          {/* Cancel Confirmation */}
          <ConfirmDialog
            open={confirmCancel}
            onClose={() => setConfirmCancel(false)}
            onConfirm={handleCancelSubscription}
            title="Cancel Subscription"
            description="Are you sure? Your store will remain active until the end of the current billing period. You can re-subscribe at any time."
            confirmLabel="Yes, Cancel"
            loading={cancelLoading}
          />
        </>
      )}
    </div>
  )
}

/* ================================================================ */
/*  Payment Method Card                                              */
/* ================================================================ */

function PaymentMethodCard({ seller, paymentInfo }: { seller: SellerInfo | null; paymentInfo: PaymentInfo | null }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <ShieldCheck className="h-4 w-4 text-primary" /> Payment & Payout Setup
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Stripe Connect (Payouts)</p>
          {paymentInfo?.stripeAccountId || seller?.stripeAccountId ? (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">Connected</span>
            </div>
          ) : (
            <span className="text-sm text-gray-500">Not connected</span>
          )}
          {(paymentInfo?.chargesEnabled || seller?.chargesEnabled) && <p className="text-xs text-gray-500 mt-1">Charges enabled</p>}
          {(paymentInfo?.payoutsEnabled || seller?.payoutsEnabled) && <p className="text-xs text-gray-500">Payouts enabled</p>}
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Payment Method (Billing)</p>
          {paymentInfo?.hasPaymentMethod ? (
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="text-sm text-gray-900 font-medium">Card on file</span>
            </div>
          ) : (
            <div>
              <span className="text-sm text-gray-500">No card on file</span>
              <p className="text-xs text-amber-400 mt-1">Add a payment method before your trial ends</p>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-600 flex items-start gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        Card data is stored securely by Stripe. AfroTransact never sees or stores your card details.
      </p>
    </div>
  )
}

/* ================================================================ */
/*  Plan Card                                                        */
/* ================================================================ */

function PlanCard({
  plan,
  isCurrent,
  onSelect,
  isLoading,
}: {
  plan: SubscriptionPlan
  isCurrent: boolean
  onSelect?: () => void
  isLoading?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-5 space-y-4 transition-colors ${
        isCurrent ? "border-primary/40 bg-primary/5" : "border-gray-200 bg-white hover:border-gray-300 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
        {isCurrent && (
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">Current</span>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {plan.priceDisplay || formatPrice(plan.priceCentsPerMonth)}
        <span className="text-sm font-normal text-gray-500">/month</span>
      </div>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2 text-gray-600">
          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          Up to {plan.maxProducts} products
        </li>
        <li className="flex items-center gap-2 text-gray-600">
          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          {plan.maxStores} store{plan.maxStores !== 1 ? "s" : ""}
        </li>
        <li className="flex items-center gap-2 text-gray-600">
          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          {commissionLabel(plan)} commission
        </li>
        {plan.features?.map((f) => (
          <li key={f} className="flex items-center gap-2 text-gray-600">
            <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      {onSelect && !isCurrent && (
        <button
          onClick={onSelect}
          disabled={isLoading}
          className="w-full rounded-lg border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-header hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Select Plan"}
        </button>
      )}
    </div>
  )
}

/* ================================================================ */
/*  Change Plan Dialog                                               */
/* ================================================================ */

function ChangePlanDialog({
  open,
  onClose,
  plans,
  currentPlanId,
  loading,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  plans: SubscriptionPlan[]
  currentPlanId: string
  loading: string | null
  onSelect: (planSlug: string) => void
}) {
  return (
    <Dialog open={open} onClose={onClose} className="max-w-3xl">
      <DialogHeader onClose={onClose}>Change Plan</DialogHeader>
      <DialogBody>
        <p className="text-sm text-gray-500 mb-4">
          Select a new plan. The change will take effect immediately. Your billing will be adjusted accordingly.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlanId}
              onSelect={() => onSelect(plan.slug)}
              isLoading={loading === plan.slug}
            />
          ))}
        </div>
      </DialogBody>
      <DialogFooter>
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
      </DialogFooter>
    </Dialog>
  )
}
