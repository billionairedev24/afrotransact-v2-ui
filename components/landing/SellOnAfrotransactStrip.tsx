"use client"

import Link from "next/link"
import { ArrowRight, Store } from "lucide-react"

import { SellBandClientGate } from "./SellBandClientGate"

/**
 * Slim one-line "Are you a maker? Sell on AfroTransact →" strip for
 * mid-page placement between product rows. Lower-pressure than the full
 * Amazon-style band; gives a second conversion entry point further down
 * the homepage.
 */
export function SellOnAfrotransactStrip() {
  return (
    <SellBandClientGate>
      <section className="max-w-page mx-auto px-4 sm:px-5">
        <Link
          href="/auth/register?role=seller&callbackUrl=/dashboard/onboarding"
          className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-brand-green/15 bg-gradient-to-r from-brand-green-soft via-card to-card px-5 py-5 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:gap-6 sm:px-7"
        >
          {/* soft gold glow, anchored top-right — adds warmth without noise */}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-brand-gold/10 blur-2xl"
          />

          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-green text-brand-green-foreground shadow-sm">
            <Store className="h-5 w-5" />
          </span>

          <div className="relative min-w-0 flex-1">
            <p className="text-base font-bold tracking-tight text-foreground sm:text-lg">
              Are you a maker, importer, or shop owner?
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Open your storefront on AfroTransact in minutes —{" "}
              <span className="font-semibold text-brand-green">plans start free</span>.
            </p>
          </div>

          <span className="relative inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-gold-foreground shadow-sm transition-transform group-hover:-translate-y-0.5">
            Start selling
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>
    </SellBandClientGate>
  )
}
