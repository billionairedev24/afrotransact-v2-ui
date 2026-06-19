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
      <section className="max-w-[1440px] mx-auto px-4 sm:px-5">
        <Link
          href="/auth/register?role=seller&callbackUrl=/dashboard/onboarding"
          className="group flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 sm:px-6 py-3 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex items-center justify-center h-9 w-9 rounded-full bg-orange-100 shrink-0">
              <Store className="h-4 w-4 text-orange-700" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm sm:text-base">
                Are you a maker, importer, or shop owner?
              </p>
              <p className="text-xs sm:text-sm text-gray-600 truncate">
                Open your storefront on AfroTransact in minutes. Plans start free.
              </p>
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-gray-900 group-hover:text-orange-600">
            Start selling
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </section>
    </SellBandClientGate>
  )
}
