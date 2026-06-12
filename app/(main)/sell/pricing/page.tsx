"use client"

import { useState } from "react"
import Link from "next/link"
import { StartSellingLink } from "@/components/selling/StartSellingLink"
import {
  AlertTriangle,
  Check,
  ChevronRight,
  HelpCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Zap,
} from "lucide-react"
import { useSubscriptionPlans } from "@/hooks/use-subscription-plans"
import { useTrialBonusFlag } from "@/hooks/use-trial-bonus-flag"
import type { SubscriptionPlan } from "@/lib/api"

/* ─────────────────────────────────────────────────────────────
 * Presentation helpers
 * ─────────────────────────────────────────────────────────────
 * Plan content (price, name, features, commission) is server-driven via
 * getPublicPlans(). Purely visual flourishes (badge, accent colours) are
 * derived locally from the plan's displayOrder so the marketing page keeps
 * its tiered look without re-introducing a hardcoded list.
 */

type PlanAccent = {
  badge: string | null
  badgeColor: string
  accentClass: string
  headerClass: string
  isPrimaryCta: boolean
}

function getPlanAccent(index: number, total: number): PlanAccent {
  // Highlight the middle tier when there are >=3 plans, otherwise the last.
  const highlightIndex = total >= 3 ? 1 : total - 1
  const topIndex = total - 1

  if (index === highlightIndex) {
    return {
      badge: "Most Popular",
      badgeColor: "bg-brand-gold text-brand-gold-foreground",
      accentClass: "border-primary/50 ring-1 ring-primary/30",
      headerClass: "bg-primary/10",
      isPrimaryCta: true,
    }
  }
  if (index === topIndex && topIndex !== highlightIndex) {
    return {
      badge: "Full Power",
      badgeColor: "bg-violet-500 text-white",
      accentClass: "border-violet-500/40 ring-1 ring-violet-500/20",
      headerClass: "bg-violet-500/10",
      isPrimaryCta: false,
    }
  }
  return {
    badge: null,
    badgeColor: "",
    accentClass: "border-gray-200",
    headerClass: "bg-gray-50",
    isPrimaryCta: false,
  }
}

/**
 * Backend stores commissionRateOverride as a *fraction* (0.080 = 8%). When
 * we surface it to the marketer we have to multiply by 100 — otherwise the
 * Growth plan renders as "0.08%" instead of "8%".
 */
function commissionPercent(plan: SubscriptionPlan): number | null {
  return plan.commissionRateOverride != null
    ? Number((plan.commissionRateOverride * 100).toFixed(2))
    : null
}

function commissionLabel(plan: SubscriptionPlan): string {
  const pct = commissionPercent(plan)
  return pct != null ? `${pct}%` : "Standard"
}

function monthlyPriceDisplay(plan: SubscriptionPlan): string {
  if (plan.priceCentsPerMonth === 0) return "Free"
  // Prefer the server-formatted priceDisplay when present so currency/cadence
  // copy stays consistent with what the admin set. Strip the trailing "/mo"
  // because the UI renders that label separately next to the number.
  if (plan.priceDisplay) return plan.priceDisplay.replace(/\s*\/\s*mo\b/i, "")
  return `$${(plan.priceCentsPerMonth / 100).toFixed(2)}`
}

const FAQ_TRIAL_BONUS_Q = "How do I get a second free month?"

const FAQ = [
  {
    q: "Is the first month really free?",
    a: "Yes — every new seller gets their first full month free, regardless of which plan you choose. No credit card required to start.",
  },
  {
    q: FAQ_TRIAL_BONUS_Q,
    a: "If you list at least 9 active products in your store before your first trial month ends, we automatically extend your free period for another 30 days. This threshold is our way of ensuring you're set up for success.",
  },
  {
    q: "When does billing start?",
    a: "Billing begins on the first day after your trial period ends. You will receive an email reminder 7 days before your trial ends.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. You can upgrade or downgrade at any time from your seller dashboard. Changes take effect at the start of your next billing cycle.",
  },
  {
    q: "What is the platform commission?",
    a: "AfroTransact charges a percentage of each sale to cover payment processing, platform infrastructure, and marketing. The rate depends on your plan. This is separate from Stripe's payment processing fee.",
  },
  {
    q: "What happens if my payment fails?",
    a: "We give you a 7-day grace period and automatically retry the payment 3 times. If payment still cannot be processed, your store will be temporarily suspended until the balance is settled. You can reactivate at any time.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your dashboard at any time. Your subscription and store remain active until the end of the current billing period.",
  },
]

function PlanCard({
  plan,
  accent,
  isAnnual,
}: {
  plan: SubscriptionPlan
  accent: PlanAccent
  isAnnual: boolean
}) {
  const monthly = plan.priceCentsPerMonth / 100
  // Annual = 10 months billed once = 2 months free. Display the monthly
  // equivalent ("$xx.xx") so the value next to "/month" stays apples-to-apples
  // with the monthly toggle. The "2 months free" copy below makes the savings
  // explicit.
  const price = isAnnual && plan.priceCentsPerMonth > 0
    ? `$${((monthly * 10) / 12).toFixed(2)}`
    : monthlyPriceDisplay(plan)

  return (
    <div
      className={`relative flex flex-col rounded-2xl border ${accent.accentClass} overflow-hidden transition-all duration-200 hover:scale-[1.01] bg-white`}
    >
      {accent.badge && (
        <div className="absolute top-0 right-0">
          <span
            className={`inline-flex items-center gap-1 rounded-bl-xl rounded-tr-2xl px-3 py-1 text-[11px] font-bold ${accent.badgeColor}`}
          >
            <Star className="h-3 w-3" />
            {accent.badge}
          </span>
        </div>
      )}

      <div className={`p-6 ${accent.headerClass}`}>
        <h3 className="text-xl font-black text-gray-900">{plan.name}</h3>
        {plan.description && (
          <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
        )}

        <div className="mt-5 flex items-end gap-1">
          <span className="text-4xl font-black text-gray-900">{price}</span>
          <span className="text-gray-500 mb-1">
            {plan.priceCentsPerMonth === 0 ? "" : "/month"}
          </span>
        </div>
        {isAnnual && plan.priceCentsPerMonth > 0 && (
          <p className="text-xs text-emerald-400 mt-1">
            2 months free with annual billing
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-gray-50 border border-input px-3 py-2 text-center">
            <p className="text-xs text-gray-500">Products</p>
            <p className="text-sm font-bold text-gray-900">
              {plan.maxProducts === -1 ? "Unlimited" : `${plan.maxProducts}`}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-input px-3 py-2 text-center">
            <p className="text-xs text-gray-500">Commission</p>
            <p className="text-sm font-bold text-gray-900">{commissionLabel(plan)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-4">
        <div className="space-y-2">
          {/* Feature list comes straight from the API. The product / store /
              commission summary already lives in the metrics grid above, so
              we no longer auto-derive a redundant row from maxProducts /
              maxStores / commissionRateOverride — that was producing six
              duplicate rows per card. Admins control the feature copy via
              the subscription-plans admin page. */}
          {(plan.features ?? []).length === 0 && (
            <p className="text-xs text-gray-500 italic">No features listed yet.</p>
          )}
          {(plan.features ?? []).map((f) => (
            <div key={f} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <span className="text-gray-600">{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 pt-0">
        <StartSellingLink
          variant="bare"
          planSlug={plan.slug}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all active:scale-[0.98] ${
            accent.isPrimaryCta
              ? "bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold-hover shadow-lg shadow-primary/20"
              : "border border-input bg-gray-50 text-gray-900 hover:bg-gray-100"
          }`}
        >
          Start Free Trial
          <ChevronRight className="h-4 w-4" />
        </StartSellingLink>
        <p className="text-center text-[11px] text-gray-600 mt-2">
          1st month free · No credit card required
        </p>
      </div>
    </div>
  )
}

function PlanCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="p-6 bg-gray-50 animate-pulse space-y-4">
        <div className="h-6 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-40 bg-gray-200 rounded" />
        <div className="h-10 w-32 bg-gray-200 rounded" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="p-6 space-y-3 animate-pulse">
        <div className="h-4 w-3/4 bg-gray-200 rounded" />
        <div className="h-4 w-2/3 bg-gray-200 rounded" />
        <div className="h-4 w-3/5 bg-gray-200 rounded" />
        <div className="h-4 w-1/2 bg-gray-200 rounded" />
      </div>
      <div className="p-6 pt-0 animate-pulse">
        <div className="h-11 w-full bg-gray-200 rounded-xl" />
      </div>
    </div>
  )
}

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const { data: rawPlans, isLoading, error } = useSubscriptionPlans()
  // Region feature flag — admins disable the 9-product → free month 2
  // promo from the admin feature-flags page when we want to stop the offer.
  // Defaults to true so the offer keeps showing if the config service is
  // unreachable or the flag is unset.
  const { enabled: trialBonusEnabled } = useTrialBonusFlag()
  const visibleFaq = trialBonusEnabled
    ? FAQ
    : FAQ.filter((item) => item.q !== FAQ_TRIAL_BONUS_Q)

  const plans = (rawPlans ?? [])
    .filter((p) => p.active)
    .sort((a, b) => a.displayOrder - b.displayOrder)

  // Commission table renders only plans whose admin-set override is known.
  // Plans on the "standard" rate (commissionRateOverride == null) are
  // omitted rather than guessed — the table is meant to be precise, and we
  // don't currently surface the standard platform rate to this page.
  const commissionRows = plans
    .map((p) => ({ name: p.name, rate: commissionPercent(p) }))
    .filter((r): r is { name: string; rate: number } => r.rate != null)

  return (
    <main className="min-h-screen">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden py-20 px-4 sm:px-6 text-center">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(212,168,83,0.08) 0%, transparent 60%)",
          }}
        />
        <div className="relative max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-foreground uppercase tracking-wider mb-6">
            <Store className="h-3 w-3" />
            Simple, transparent pricing
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 leading-tight">
            Grow your business.<br />
            <span className="text-foreground">Pay only when you&apos;re ready.</span>
          </h1>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            {trialBonusEnabled
              ? "First month always free. Second month free if you list 9+ products. Then choose the plan that fits your stage."
              : "First month always free. Then choose the plan that fits your stage."}
          </p>

          {/* Trial highlight */}
          <div className="mt-8 inline-flex flex-col sm:flex-row gap-3 items-center justify-center">
            {[
              { icon: <Sparkles className="h-4 w-4 text-foreground" />, text: "Month 1: Always free", show: true },
              { icon: <Zap className="h-4 w-4 text-emerald-400" />,  text: "Month 2: Free with 9+ products", show: trialBonusEnabled },
              { icon: <ShieldCheck className="h-4 w-4 text-sky-400" />, text: trialBonusEnabled ? "Month 3+: Pay your chosen plan" : "Month 2+: Pay your chosen plan", show: true },
            ].filter(({ show }) => show).map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-2 rounded-xl border border-input bg-gray-50 px-4 py-2 text-sm text-gray-600">
                {icon}
                {text}
              </div>
            ))}
          </div>

          {/* Billing toggle */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <span className={`text-sm ${!isAnnual ? "text-gray-900 font-semibold" : "text-gray-500"}`}>Monthly</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative h-6 w-11 rounded-full transition-colors ${isAnnual ? "bg-primary" : "bg-gray-200"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isAnnual ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
            <span className={`text-sm ${isAnnual ? "text-gray-900 font-semibold" : "text-gray-500"}`}>
              Annual
              <span className="ml-1.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 font-bold">
                2 months free
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="mx-auto max-w-6xl">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <PlanCardSkeleton key={i} />
              ))}
            </div>
          ) : error || plans.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center max-w-lg mx-auto">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Plans are temporarily unavailable
              </p>
              <p className="text-sm text-gray-600">
                We couldn&apos;t load our subscription plans right now. Please try
                again in a moment, or{" "}
                <Link href="/help" className="underline hover:text-foreground">
                  contact support
                </Link>
                .
              </p>
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-foreground mx-auto mt-3" />
              )}
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 gap-5 ${
                plans.length >= 3 ? "md:grid-cols-3" : plans.length === 2 ? "md:grid-cols-2" : ""
              }`}
            >
              {plans.map((plan, i) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  accent={getPlanAccent(i, plans.length)}
                  isAnnual={isAnnual}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Commission comparison ── */}
      {commissionRows.length > 0 && (
        <section className="border-y border-border bg-card/40 px-4 sm:px-6 py-12">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Commission breakdown
            </h2>
            <p className="text-gray-500 text-center text-sm mb-8">
              Understand exactly how much you keep from each sale.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-3 font-semibold text-gray-500">Plan</th>
                    <th className="text-right pb-3 font-semibold text-gray-500">Commission</th>
                    <th className="text-right pb-3 font-semibold text-gray-500">On a $100 sale, you keep</th>
                    <th className="text-right pb-3 font-semibold text-gray-500">On $10k/mo GMV, you keep</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionRows.map((row) => {
                    const rate = Number(row.rate)
                    const keep100 = (100 * (1 - rate / 100) - 2.9 - 0.30).toFixed(2)
                    const keep10k = ((10000 * (1 - rate / 100)) - (10000 / 100) * (2.9 + 0.30)).toFixed(0)
                    return (
                      <tr key={row.name} className="border-b border-border/50">
                        <td className="py-3 font-semibold text-foreground">{row.name}</td>
                        <td className="py-3 text-right text-gray-600">{rate}%</td>
                        <td className="py-3 text-right font-bold text-gray-900">${keep100}</td>
                        <td className="py-3 text-right font-bold text-gray-900">
                          ${parseInt(keep10k).toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-600 mt-3">
                * Stripe processing fee (~2.9% + $0.30 per transaction) deducted from seller payout.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      <section className="px-4 sm:px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8 flex items-center justify-center gap-2">
            <HelpCircle className="h-6 w-6 text-foreground" />
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {visibleFaq.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-border overflow-hidden bg-white"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  {item.q}
                  <ChevronRight
                    className={`h-4 w-4 text-gray-500 transition-transform shrink-0 ml-3 ${openFaq === i ? "rotate-90" : ""}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed border-t border-border">
                    <p className="pt-3">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="border-t border-border bg-gradient-to-br from-primary/10 to-transparent px-4 sm:px-6 py-16 text-center">
        <h2 className="text-3xl font-black text-gray-900 mb-4">
          Ready to start selling?
        </h2>
        <p className="text-gray-500 max-w-md mx-auto mb-8">
          Join 200+ immigrant entrepreneurs already earning on AfroTransact. Your first month is on us.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <StartSellingLink variant="button">
            Start Free Trial
            <ChevronRight className="h-4 w-4" />
          </StartSellingLink>
          <Link
            href="/sell"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-input bg-gray-50 px-8 text-[15px] font-semibold text-gray-900 hover:bg-gray-100 transition-all"
          >
            Learn More
          </Link>
        </div>
        <p className="text-xs text-gray-600 mt-4">
          By signing up you agree to our{" "}
          <Link href="/terms" className="underline hover:text-gray-400">Terms of Service</Link>,{" "}
          <Link href="/seller-agreement" className="underline hover:text-gray-400">Seller Agreement</Link>, and{" "}
          <Link href="/privacy" className="underline hover:text-gray-400">Privacy Policy</Link>.
        </p>
      </section>
    </main>
  )
}
