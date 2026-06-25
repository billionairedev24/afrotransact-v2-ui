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
    <section className="mx-4 md:mx-6 lg:mx-8">
      <h2 className="text-lg md:text-xl font-semibold mb-3">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {items.map((p) => {
          const isBuyAgain = p.source === "BUY_AGAIN"
          return (
            <div
              key={`${p.productId}-${p.variantId ?? ""}-${p.source}`}
              className="snap-start shrink-0 w-40 md:w-44 rounded-lg border border-border bg-card p-3 flex flex-col gap-2"
            >
              <div className="relative w-full aspect-square overflow-hidden rounded-md bg-muted">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : null}
                {isBuyAgain ? (
                  <span className="absolute top-1 left-1 text-[10px] font-medium rounded-sm bg-background/90 text-foreground px-1.5 py-0.5 border border-border">
                    Bought before
                  </span>
                ) : null}
              </div>
              <div className="text-xs line-clamp-2 min-h-[2.2rem]" title={p.name}>
                {p.name}
              </div>
              <div className="text-sm font-medium">
                ${((p.currentPriceCents ?? 0) / 100).toFixed(2)}
              </div>
              <button
                type="button"
                onClick={() => handleAddToCart(p)}
                className="text-xs rounded-md bg-primary text-primary-foreground py-1.5 hover:bg-primary/90"
              >
                {isBuyAgain ? "Buy Again" : "Add to cart"}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
