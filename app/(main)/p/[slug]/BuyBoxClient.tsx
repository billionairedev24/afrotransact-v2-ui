"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useCartStore } from "@/stores/cart-store"
import type { CatalogItemBuyBox, OfferSummary } from "@/lib/api"

/**
 * Client island for the catalog PDP — Phase 9.6c.
 *
 * The page itself stays a server component (good for ISR + SEO); only
 * the cart-attached UI lives here. addItem hits the zustand store the
 * same way the legacy PDP does, so the cart icon and checkout flow
 * pick up the new entry automatically.
 */
export function BuyBoxClient({
  item,
  primaryImageUrl,
}: {
  item: CatalogItemBuyBox
  primaryImageUrl: string | null
}) {
  const addItem = useCartStore((s) => s.addItem)
  const router = useRouter()
  const [adding, setAdding] = useState<string | null>(null)

  function add(offer: OfferSummary, qty: number = 1) {
    setAdding(offer.offerId)
    try {
      addItem({
        // productId = offerId in V1 (1:1 with catalog.products row).
        productId: offer.offerId,
        variantId: offer.variantId,
        storeId: offer.storeId,
        storeName: offer.storeId.slice(0, 8), // fallback — proper store name resolution is a follow-up
        title: item.title,
        variantName: offer.variantName ?? "Default",
        // CartStore.price is in cents. OfferSummary.price is in major units.
        price: Math.round(offer.price * 100),
        quantity: qty,
        imageUrl: primaryImageUrl ?? undefined,
        slug: item.slug,
      })
      toast.success(`Added ${item.title} to cart`)
    } finally {
      setAdding(null)
    }
  }

  function buyNow(offer: OfferSummary) {
    add(offer, 1)
    router.push("/checkout")
  }

  if (!item.buyBox) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
        <p className="text-sm font-semibold text-amber-900">Currently unavailable</p>
        <p className="mt-1 text-xs text-amber-800">
          No seller has stock of this item right now. Check back soon.
        </p>
      </div>
    )
  }
  const bb = item.buyBox
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-bold text-foreground tabular-nums">
            {formatPrice(bb.price, bb.currency)}
          </p>
          {bb.compareAtPrice && bb.compareAtPrice > bb.price && (
            <p className="text-sm line-through text-muted-foreground tabular-nums">
              {formatPrice(bb.compareAtPrice, bb.currency)}
            </p>
          )}
        </div>
        <p className="mt-2 text-sm">
          <span className="text-emerald-700 font-semibold">In stock</span>
          <span className="text-muted-foreground"> · sold by store </span>
          <span className="font-mono text-[11px] text-foreground">{bb.storeId.slice(0, 8)}</span>
        </p>
        {item.totalOffers > 1 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Featured offer of {item.totalOffers} available from different sellers
            {item.buyBoxDecision?.eligibleCount != null &&
              item.buyBoxDecision.eligibleCount < item.totalOffers
              ? <> ({item.buyBoxDecision.eligibleCount} qualify for the featured slot)</>
              : null}
            .
            {(() => {
              const txt = humanizeDecisionReason(item.buyBoxDecision?.reason)
              return txt ? <> <span className="text-muted-foreground/80">{txt}</span>.</> : null
            })()}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={adding === bb.offerId}
            onClick={() => add(bb)}
            className="w-full rounded-xl bg-brand-gold py-3 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors disabled:opacity-60"
          >
            {adding === bb.offerId ? "Adding…" : "Add to cart"}
          </button>
          <button
            type="button"
            disabled={adding === bb.offerId}
            onClick={() => buyNow(bb)}
            className="w-full rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-60"
          >
            Buy now
          </button>
        </div>
      </div>

      {item.otherOffers.length > 0 && (
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <header className="border-b border-border bg-muted/40 px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              {item.otherOffers.length} other seller{item.otherOffers.length === 1 ? "" : "s"}
            </h2>
          </header>
          <ul className="divide-y divide-border">
            {item.otherOffers.map((o) => {
              const ineligibleReason = item.buyBoxDecision?.ineligible?.[o.offerId]
              return (
              <li key={o.offerId} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] text-muted-foreground">store {o.storeId.slice(0, 8)}</p>
                  <p className="text-sm text-foreground">
                    {o.stockQuantity > 0 ? (
                      <span className="text-emerald-700 font-semibold">In stock</span>
                    ) : (
                      <span className="text-amber-700">Out of stock</span>
                    )}
                    {o.variantName ? <span className="text-muted-foreground"> · {o.variantName}</span> : null}
                  </p>
                  {ineligibleReason && (
                    <p className="mt-0.5 text-[11px] text-amber-700">
                      Not featured: {humanizeReason(ineligibleReason)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground tabular-nums">
                    {formatPrice(o.price, o.currency)}
                  </p>
                  {o.compareAtPrice && o.compareAtPrice > o.price && (
                    <p className="text-xs line-through text-muted-foreground tabular-nums">
                      {formatPrice(o.compareAtPrice, o.currency)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={o.stockQuantity === 0 || adding === o.offerId}
                  onClick={() => add(o)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {adding === o.offerId ? "Adding…" : "Add"}
                </button>
              </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

/**
 * Convert a Buy Box ineligibility reason token from the backend into a
 * short buyer-friendly phrase. Tokens we know about:
 *   "out_of_stock"
 *   "price_not_positive"
 *   "currency_mismatch:NGN_vs_USD"
 *   "missing_variant"
 * Unknown tokens pass through unchanged so we never hide diagnostic info.
 */
function humanizeReason(token: string): string {
  if (token === "out_of_stock") return "out of stock"
  if (token === "price_not_positive") return "price not set"
  if (token === "missing_variant") return "no purchasable variant"
  if (token.startsWith("currency_mismatch:")) {
    const parts = token.slice("currency_mismatch:".length).split("_vs_")
    if (parts.length === 2) return `priced in ${parts[0]}, platform uses ${parts[1]}`
  }
  return token
}

/**
 * Phase 9.9 — translate the top-level Buy Box decision reason for the
 * "X qualify for the featured slot" line. Composite outcomes get their
 * own short copy.
 */
function humanizeDecisionReason(token: string | undefined): string | null {
  if (!token) return null
  switch (token) {
    case "cheapest_in_stock":
      return "ranked by lowest price"
    case "composite_winner":
      return "ranked by price, seller performance, and fulfillment speed"
    case "composite_no_metrics_fallback_price":
      return "ranked by lowest price (seller performance data unavailable)"
    case "no_offers":
    case "no_eligible_offers":
      return null
    default:
      return token
  }
}
