"use client"

import { useSession } from "next-auth/react"
import { Store, ArrowRight } from "lucide-react"

import { StartSellingLink } from "@/components/selling/StartSellingLink"

/**
 * Marketing band that invites guests + buyers to open a seller store.
 * Visibility is controlled by <StartSellingLink>: admins and existing
 * sellers see nothing (the component returns null + the surrounding band
 * disappears with it via the empty-children check below).
 *
 * Drop into the buyer landing surfaces (home, category, search). Do not
 * place on admin or seller-side routes — they aren't accessible from the
 * shell anyway.
 */
export function SellOnAfrotransactBand() {
  const { data: session, status } = useSession()
  if (status === "loading") return null
  const roles: string[] = (session?.user as { roles?: string[] })?.roles ?? []
  if (roles.includes("admin") || roles.includes("seller")) return null

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-5 mt-12">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-yellow-950/30 p-6 sm:p-10 overflow-hidden relative">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 opacity-10 pointer-events-none">
          <Store className="h-56 w-56" strokeWidth={1} />
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-amber-700 dark:text-amber-300">
              <Store className="h-3.5 w-3.5" /> For sellers
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Start selling on AfroTransact
            </h2>
            <p className="text-base text-muted-foreground">
              Reach customers who are searching for authentic African and Black-owned
              products. Open your store in minutes — keep your prices, your branding,
              and most of every sale.
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-foreground mt-4">
              <li className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                Free to open · pay only on sales
              </li>
              <li className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                Stripe payouts, no card details required
              </li>
              <li className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                Human onboarding support
              </li>
            </ul>
          </div>

          <div className="flex flex-col items-stretch sm:items-end gap-2">
            <StartSellingLink variant="button">
              Start selling
              <ArrowRight className="h-4 w-4" />
            </StartSellingLink>
            <p className="text-[11px] text-muted-foreground text-center sm:text-right">
              Cancel anytime · No credit card to start
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
