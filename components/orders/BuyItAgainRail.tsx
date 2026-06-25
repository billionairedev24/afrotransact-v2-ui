"use client"

/**
 * Home-page "Buy It Again" rail. Client component — it gates on the next-auth
 * session (no point asking the server to render a buyer-personalized rail for
 * guests, and the home page is heavily ISR-cached) and owns the click handler
 * for the per-card "Buy Again" button.
 *
 * Per-card click semantics: we do NOT call the order-level /reorder endpoint
 * here. That endpoint takes an orderNumber and exists to replay a whole
 * order; single-product "Buy Again" is just an add-to-cart + redirect. Using
 * /reorder here would lose semantic clarity (which order? — none) and ship
 * unnecessary work.
 *
 * Hidden cases (return null):
 *   - the buyer is not signed in
 *   - the API returns an empty list
 *   - the API call errors (we degrade silently rather than breaking the home page)
 */

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getAccessToken } from "@/lib/auth-helpers"
import { getBuyAgainProducts, type BuyAgainProduct } from "@/lib/api"
import { useCartStore } from "@/stores/cart-store"

export function BuyItAgainRail() {
  const { status } = useSession()
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const [items, setItems] = useState<BuyAgainProduct[] | null>(null)

  useEffect(() => {
    let cancelled = false
    if (status !== "authenticated") return
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const data = await getBuyAgainProducts(token)
        if (!cancelled) setItems(data)
      } catch {
        // Silent degrade — the rail is non-essential; logging a toast every
        // home-page load on a transient blip would be noisier than useful.
        if (!cancelled) setItems([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status])

  if (status !== "authenticated") return null
  if (items === null) return null
  if (items.length === 0) return null

  function handleBuyAgain(p: BuyAgainProduct) {
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
      price: (p.currentPriceCents ?? 0) / 100,
      quantity: 1,
      imageUrl: p.imageUrl ?? undefined,
      slug: p.slug ?? "",
    })
    router.push("/checkout")
  }

  return (
    <section className="mx-4 md:mx-6 lg:mx-8">
      <h2 className="text-lg md:text-xl font-semibold mb-3">Buy it again</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {items.map((p) => (
          <div
            key={`${p.productId}-${p.variantId ?? ""}`}
            className="snap-start shrink-0 w-40 md:w-44 rounded-lg border border-border bg-card p-3 flex flex-col gap-2"
          >
            <div className="w-full aspect-square overflow-hidden rounded-md bg-muted">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
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
              onClick={() => handleBuyAgain(p)}
              className="text-xs rounded-md bg-primary text-primary-foreground py-1.5 hover:bg-primary/90"
            >
              Buy Again
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
