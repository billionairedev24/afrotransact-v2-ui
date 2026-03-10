"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Check,
  ChevronRight,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  X,
  Zap,
} from "lucide-react"

/* ─── Plan data (mirrors DB seed — will be fetched from API in production) ─ */

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    slug: "starter",
    description: "Perfect for new sellers getting started on AfroTransact.",
    priceCents: 2999,
    priceDisplay: "$29.99",
    maxProducts: 50,
    maxStores: 1,
    commissionRate: "10%",
    badge: null,
    badgeColor: "",
    accentClass: "border-gray-200",
    headerClass: "bg-gray-50",
    features: [
      "Up to 50 products",
      "1 store",
      "10% platform commission",
      "Email support",
      "Basic analytics dashboard",
      "Delivery tracking",
    ],
    notIncluded: [
      "Multiple stores",
      "Reduced commission",
      "Featured store badge",
      "Priority support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    slug: "growth",
    description: "Scale your business with more reach and a lower commission.",
    priceCents: 7999,
    priceDisplay: "$79.99",
    maxProducts: 500,
    maxStores: 3,
    commissionRate: "8%",
    badge: "Most Popular",
    badgeColor: "bg-primary text-header",
    accentClass: "border-primary/50 ring-1 ring-primary/30",
    headerClass: "bg-primary/10",
    features: [
      "Up to 500 products",
      "Up to 3 stores",
      "Reduced 8% commission",
      "Priority email & chat support",
      "Advanced analytics & reports",
      "Featured store badge",
      "Delivery tracking",
      "Bulk product import",
    ],
    notIncluded: [
      "Unlimited products",
      "Dedicated account manager",
      "Custom store domain",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    slug: "pro",
    description: "Full power for high-volume sellers and serious businesses.",
    priceCents: 14999,
    priceDisplay: "$149.99",
    maxProducts: -1,
    maxStores: 10,
    commissionRate: "6%",
    badge: "Full Power",
    badgeColor: "bg-violet-500 text-white",
    accentClass: "border-violet-500/40 ring-1 ring-violet-500/20",
    headerClass: "bg-violet-500/10",
    features: [
      "Unlimited products",
      "Up to 10 stores",
      "Lowest 6% commission",
      "Dedicated account manager",
      "Full analytics suite",
      "Top placement in search results",
      "Custom store domain",
      "Bulk product import",
      "API access",
      "White-glove onboarding",
    ],
    notIncluded: [],
  },
]

const FAQ = [
  {
    q: "Is the first month really free?",
    a: "Yes — every new seller gets their first full month free, regardless of which plan you choose. No credit card required to start.",
  },
  {
    q: "How do I get a second free month?",
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
    a: "AfroTransact charges a percentage of each sale to cover payment processing, platform infrastructure, and marketing. The rate depends on your plan (6–10%). This is separate from Stripe's payment processing fee.",
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

function PlanCard({ plan, isAnnual }: { plan: typeof PLANS[0]; isAnnual: boolean }) {
  const price = isAnnual
    ? `$${((plan.priceCents * 10) / 100).toFixed(2)}`
    : plan.priceDisplay

  return (
    <div
      className={`relative flex flex-col rounded-2xl border ${plan.accentClass} overflow-hidden transition-all duration-200 hover:scale-[1.01] bg-white`}
    >
      {plan.badge && (
        <div className="absolute top-0 right-0">
          <span className={`inline-flex items-center gap-1 rounded-bl-xl rounded-tr-2xl px-3 py-1 text-[11px] font-bold ${plan.badgeColor}`}>
            <Star className="h-3 w-3" />
            {plan.badge}
          </span>
        </div>
      )}

      <div className={`p-6 ${plan.headerClass}`}>
        <h3 className="text-xl font-black text-gray-900">{plan.name}</h3>
        <p className="text-sm text-gray-500 mt-1">{plan.description}</p>

        <div className="mt-5 flex items-end gap-1">
          <span className="text-4xl font-black text-gray-900">{price}</span>
          <span className="text-gray-500 mb-1">/month</span>
        </div>
        {isAnnual && (
          <p className="text-xs text-emerald-400 mt-1">2 months free with annual billing</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-center">
            <p className="text-xs text-gray-500">Products</p>
            <p className="text-sm font-bold text-gray-900">
              {plan.maxProducts === -1 ? "Unlimited" : `${plan.maxProducts}`}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-center">
            <p className="text-xs text-gray-500">Commission</p>
            <p className="text-sm font-bold text-gray-900">{plan.commissionRate}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-4">
        <div className="space-y-2">
          {plan.features.map((f) => (
            <div key={f} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <span className="text-gray-600">{f}</span>
            </div>
          ))}
          {plan.notIncluded.map((f) => (
            <div key={f} className="flex items-start gap-2 text-sm">
              <X className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
              <span className="text-gray-600">{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 pt-0">
        <Link
          href={`/auth/register?role=seller&plan=${plan.slug}`}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all active:scale-[0.98] ${
            plan.badge === "Most Popular"
              ? "bg-primary text-header hover:bg-primary/90 shadow-lg shadow-primary/20"
              : "border border-gray-300 bg-gray-50 text-gray-900 hover:bg-gray-100"
          }`}
        >
          Start Free Trial
          <ChevronRight className="h-4 w-4" />
        </Link>
        <p className="text-center text-[11px] text-gray-600 mt-2">
          1st month free · No credit card required
        </p>
      </div>
    </div>
  )
}

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider mb-6">
            <Store className="h-3 w-3" />
            Simple, transparent pricing
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 leading-tight">
            Grow your business.<br />
            <span className="text-primary">Pay only when you&apos;re ready.</span>
          </h1>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            First month always free. Second month free if you list 9+ products.
            Then choose the plan that fits your stage.
          </p>

          {/* Trial highlight */}
          <div className="mt-8 inline-flex flex-col sm:flex-row gap-3 items-center justify-center">
            {[
              { icon: <Sparkles className="h-4 w-4 text-primary" />, text: "Month 1: Always free" },
              { icon: <Zap className="h-4 w-4 text-emerald-400" />,  text: "Month 2: Free with 9+ products" },
              { icon: <ShieldCheck className="h-4 w-4 text-sky-400" />, text: "Month 3+: Pay your chosen plan" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
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
              className={`relative h-6 w-11 rounded-full transition-colors ${isAnnual ? "bg-primary" : "bg-white/15"}`}
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
        <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} isAnnual={isAnnual} />
          ))}
        </div>
      </section>

      {/* ── Commission comparison ── */}
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
                {[
                  { name: "Starter", rate: 10, color: "text-gray-600" },
                  { name: "Growth",  rate: 8,  color: "text-primary"  },
                  { name: "Pro",     rate: 6,  color: "text-violet-400" },
                ].map((row) => {
                  const keep100 = (100 * (1 - row.rate / 100) - 2.9 - 0.30).toFixed(2)
                  const keep10k = ((10000 * (1 - row.rate / 100)) - (10000 / 100) * (2.9 + 0.30)).toFixed(0)
                  return (
                    <tr key={row.name} className="border-b border-border/50">
                      <td className={`py-3 font-semibold ${row.color}`}>{row.name}</td>
                      <td className="py-3 text-right text-gray-600">{row.rate}%</td>
                      <td className="py-3 text-right font-bold text-gray-900">${keep100}</td>
                      <td className="py-3 text-right font-bold text-gray-900">${parseInt(keep10k).toLocaleString()}</td>
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

      {/* ── FAQ ── */}
      <section className="px-4 sm:px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8 flex items-center justify-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
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
          <Link
            href="/auth/register?role=seller"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-8 text-[15px] font-bold text-header hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            Start Free Trial
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/sell"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 px-8 text-[15px] font-semibold text-gray-900 hover:bg-gray-100 transition-all"
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
