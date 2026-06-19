"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"
import { useCallback } from "react"
import { signIn } from "next-auth/react"
import { ArrowRight, Check } from "lucide-react"

/**
 * Amazon-style "Become a seller" band on the buyer landing page.
 * Three-column trust strip + headline + numbered value props + primary
 * CTA. Visible to guests + buyers, hidden from admin + existing sellers.
 *
 * Guests go through the seller-flavoured Keycloak registration;
 * authenticated buyers skip straight to onboarding.
 */
export function SellOnAfrotransactBand() {
  const { data: session, status } = useSession()

  const onStartSelling = useCallback(() => {
    // Guests: route through Keycloak's "register seller" flow so the
    // account is provisioned with the seller role from the start.
    if (!session) {
      void signIn("keycloak-register-seller", {
        callbackUrl: "/dashboard/onboarding",
      })
    }
  }, [session])

  if (status === "loading") return null

  const roles: string[] = (session?.user as { roles?: string[] })?.roles ?? []
  if (roles.includes("admin") || roles.includes("seller")) return null

  const ctaHref = session
    ? "/dashboard/onboarding"
    : "/auth/register?role=seller&callbackUrl=/dashboard/onboarding"

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-5 mt-12">
      {/* Card */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Top stat strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-gray-200 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 bg-gray-50">
          <Stat number="200+" label="Active sellers" />
          <Stat number="$0" label="Cost to open a store" />
          <Stat number="2-3 days" label="Time to first listing" />
        </div>

        {/* Main */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12 p-6 sm:p-10">
          {/* Left — pitch */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-orange-600 mb-2">
              Become a Seller
            </p>
            <h2 className="text-[28px] sm:text-[32px] leading-tight font-bold text-gray-900 mb-3">
              Sell on AfroTransact
            </h2>
            <p className="text-base text-gray-700 mb-6 max-w-xl">
              Reach customers searching for authentic African and Black-owned products.
              Open your store today — pay only when you make a sale.
            </p>

            <Link
              href={ctaHref}
              onClick={!session ? onStartSelling : undefined}
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full bg-[#F5C518] hover:bg-[#E5B100] text-gray-900 font-bold text-[15px] shadow-sm hover:shadow transition-all"
            >
              Start selling
              <ArrowRight className="h-4 w-4" />
            </Link>

            <p className="text-xs text-gray-500 mt-3">
              No credit card required &middot; Cancel anytime
            </p>
          </div>

          {/* Right — benefits checklist */}
          <div className="lg:border-l lg:pl-12 lg:border-gray-200">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-500 mb-4">
              What you get
            </p>
            <ul className="space-y-3.5">
              <Benefit
                title="Free to list"
                desc="No monthly fees or listing fees. We take a small commission only when an item sells."
              />
              <Benefit
                title="Fast Stripe payouts"
                desc="Payments settle directly to your bank — usually within 2 business days of fulfillment."
              />
              <Benefit
                title="Built-in marketing"
                desc="Your products appear in search, deals, and category browsing alongside our top sellers."
              />
              <Benefit
                title="Human onboarding"
                desc="A real person walks you through Stripe verification, your first listing, and shipping setup."
              />
            </ul>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <Link
                href="/sell"
                className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 hover:text-orange-600"
              >
                Learn more about selling
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="px-6 py-4 text-center">
      <div className="text-2xl font-bold text-gray-900">{number}</div>
      <div className="text-xs text-gray-600 mt-0.5">{label}</div>
    </div>
  )
}

function Benefit({ title, desc }: { title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 mt-0.5 flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100">
        <Check className="h-3 w-3 text-emerald-700" strokeWidth={3} />
      </span>
      <div>
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </li>
  )
}
