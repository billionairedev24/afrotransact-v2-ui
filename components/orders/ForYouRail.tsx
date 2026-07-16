"use client"

/**
 * Home-page "For You" rail. Successor to the old BuyItAgainRail — same
 * client-side gating (next-auth session + empty-response hide), but the API
 * now mixes three sources:
 *   - BUY_AGAIN — the buyer has bought this before (chip + "Buy Again" CTA).
 *   - CO_PURCHASE — other buyers bought this alongside the buyer's purchases.
 *   - CATEGORY — top-rated active products in the buyer's past categories.
 *
 * The title flips between "Buy it again" and "For you" depending on how
 * dense the BUY_AGAIN segment is — if most cards are repeat purchases, the
 * old title is still the most honest one. Otherwise we call it what it is.
 *
 * Per-card click semantics unchanged: add to cart + redirect to /checkout.
 * The /reorder endpoint is for whole-order replay; single-product "buy
 * again" or "add to cart" is just a cart insert.
 *
 * Hidden cases (return null):
 *   - the buyer is not signed in
 *   - the API returns an empty list (the buyer has no past activity)
 *   - the API call errors (we degrade silently rather than break the page)
 */

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getAccessToken } from "@/lib/auth-helpers"
import { getForYouProducts, type ForYouProduct } from "@/lib/api"
import { useCartStore } from "@/stores/cart-store"

export function ForYouRail() {
  const { status } = useSession()
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const [items, setItems] = useState<ForYouProduct[] | null>(null)

  useEffect(() => {
    let cancelled = false
    if (status !== "authenticated") return
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const data = await getForYouProducts(token, 12)
        if (!cancelled) setItems(data)
      } catch {
        // Silent degrade — the rail is non-essential; a toast on every home
        // load on a transient blip would be noisier than useful.
        if (!cancelled) setItems([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status])

  if (status !== "authenticated") return null
  if (items === null) return null
  if (items.length < 1) return null

  // Title flips on the mix. If most of the rail is repeat purchases, "Buy it
  // again" is still the most honest framing — the buyer trusts that label.
  // Otherwise we own that it's a recommendation rail.
  const buyAgainCount = items.filter((p) => p.source === "BUY_AGAIN").length
  const title =
    buyAgainCount === items.length || buyAgainCount >= 3
      ? "Buy it again"
      : "For you"

  function handleAddToCart(p: ForYouProduct) {
    if (!p.variantId) {
      toast.error("This item is no longer available in the same variant")
      return
    }
    addItem({
      productId: p.productId,
      variantId: p.variantId,
      storeId: p.storeId ?? "",
      storeName: "",
      title: p.name,
      variantName: "",
      // Cart store stores price in cents (see FeaturedProducts.tsx where it
      // does Math.round(variant.price * 100)). Passing dollars caused the
      // "0.38 at checkout for a $38 item" bug.
      price: p.currentPriceCents ?? 0,
      quantity: 1,
      imageUrl: p.imageUrl ?? undefined,
      slug: p.slug ?? "",
    })
    router.push("/checkout")
  }

  return (
    <section className="max-w-page mx-auto px-4 sm:px-5">
      <div className="bg-card border border-border p-4 sm:p-5 rounded-xl">
        <h2 className="font-display text-2xl md:text-[1.7rem] font-semibold tracking-tight text-foreground mb-6">{title}</h2>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x">
          {items.map((p) => {
            const isBuyAgain = p.source === "BUY_AGAIN"
            // Per-card chip copy. CATEGORY is the soft fallback; chipping it
            // would feel noisy because the buyer hasn't asked for it explicitly.
            const chip =
              p.source === "BUY_AGAIN"
                ? "Bought before"
                : p.source === "SEMANTIC"
                  ? "You might like"
                  : p.source === "CO_PURCHASE"
                    ? "Often bought together"
                    : null
            return (
              <div
                key={`${p.productId}-${p.variantId ?? ""}-${p.source}`}
                className="snap-start shrink-0 w-[240px] flex flex-col gap-2"
              >
                <div className="relative w-full aspect-square overflow-hidden rounded-lg bg-muted">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-woven flex items-center justify-center">
                      <img src="/brand/logo-mark.svg" alt="" aria-hidden className="h-10 w-10 opacity-50" />
                    </div>
                  )}
                  {chip ? (
                    <span className="absolute top-2 left-2 text-[10px] font-semibold rounded-full bg-background/90 text-foreground px-2 py-0.5 border border-border">
                      {chip}
                    </span>
                  ) : null}
                </div>
                <div className="text-sm line-clamp-2 min-h-[2.2rem] text-foreground" title={p.name}>
                  {p.name}
                </div>
                <div className="text-lg font-bold text-foreground">
                  ${((p.currentPriceCents ?? 0) / 100).toFixed(2)}
                </div>
                {p.inStock === false ? (
                  <button
                    type="button"
                    disabled
                    className="mt-2 w-full bg-muted text-muted-foreground py-1.5 rounded-full text-xs font-bold text-center cursor-not-allowed uppercase tracking-wider"
                  >
                    Out of Stock
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAddToCart(p)}
                    className="mt-2 w-full bg-brand-gold text-brand-gold-foreground border border-brand-gold-hover py-1.5 rounded-full text-xs font-bold text-center hover:bg-brand-gold-hover transition-colors"
                  >
                    {isBuyAgain ? "Buy Again" : "Add to cart"}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
