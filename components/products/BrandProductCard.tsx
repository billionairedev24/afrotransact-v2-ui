"use client"

/**
 * Shared product/deal card. Faithful to:
 *   public/ux-designs/all-products.html lines 235-256
 *   public/ux-designs/deals.html       lines 264-292
 *
 * Used by /search (All Products) and /deals so the marketplace has ONE card
 * style. Brand colors are sourced from globals.css `--brand-gold*` tokens —
 * theme swaps stay config-only, no edits here required.
 *
 * Both DealData and SearchResult feed this via adapters defined in the page
 * itself; the shape this card consumes is intentionally narrow.
 */

import Link from "next/link"
import Image from "next/image"
import { Star, ShoppingCart, Loader2, Timer, Package } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getProductById } from "@/lib/api"
import { useCartStore } from "@/stores/cart-store"

export interface BrandProductCardItem {
  productId: string
  storeId?: string
  storeName?: string | null
  title: string
  slug?: string | null
  imageUrl?: string | null
  /** Current price in dollars (already discounted if applicable). */
  price: number
  /** Original "compare-at" price in dollars, > price when on sale. */
  originalPrice?: number | null
  /** 0–5. Omit (or 0) to hide. */
  avgRating?: number
  reviewCount?: number
  inStock?: boolean
  /** Show a top-left red discount badge when set. */
  discountPercent?: number | null
  /** Show a red "Deal of the Day" pill above the title. */
  dealOfTheDay?: boolean
  /** ISO end timestamp — renders a "Ends in HH:MM:SS" countdown above the title. */
  endsAt?: string | null
}

function Countdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const end = new Date(endsAt).getTime()
  const diff = Math.max(0, end - now)
  if (diff === 0) return null
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  const fmt = (n: number) => String(n).padStart(2, "0")
  return (
    <div className="flex items-center gap-1 text-red-600 text-xs font-bold mb-2">
      <Timer className="h-3.5 w-3.5" />
      <span>Ends in {fmt(h)}:{fmt(m)}:{fmt(s)}</span>
    </div>
  )
}

function StarRow({ rating, count }: { rating: number; count?: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <div className="flex items-center gap-1 mt-auto">
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-4 w-4",
              i < filled ? "fill-brand-gold text-brand-gold" : "fill-gray-200 text-gray-200",
            )}
          />
        ))}
      </div>
      {typeof count === "number" && count > 0 && (
        <span className="text-xs font-semibold text-gray-500">({count.toLocaleString()})</span>
      )}
    </div>
  )
}

interface Props {
  item: BrandProductCardItem
}

export function BrandProductCard({ item }: Props) {
  const href = `/product/${item.slug || item.productId}`
  const hasOriginal =
    typeof item.originalPrice === "number" &&
    item.originalPrice !== null &&
    item.originalPrice > item.price

  return (
    <div className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col relative">
      {/* Discount badge — mockup deals.html lines 265-267 */}
      {typeof item.discountPercent === "number" && item.discountPercent > 0 && (
        <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold uppercase px-2 py-1 rounded z-10">
          {item.discountPercent}% Off
        </div>
      )}

      <Link href={href} className="block">
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-12 w-12 text-gray-300" />
            </div>
          )}
          {item.inStock === false && (
            <span className="absolute left-3 top-3 rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              Out of Stock
            </span>
          )}
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1 gap-2">
        {/* Deal-of-the-day pill or countdown timer above title, per mockup */}
        {item.dealOfTheDay && (
          <div className="flex items-center gap-1">
            <span className="bg-gray-100 text-red-600 font-bold text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded">
              Deal of the Day
            </span>
          </div>
        )}
        {item.endsAt && !item.dealOfTheDay && <Countdown endsAt={item.endsAt} />}

        <Link href={href}>
          <h3 className="text-sm font-medium leading-tight text-foreground line-clamp-2 group-hover:text-brand-gold-hover transition-colors">
            {item.title}
          </h3>
        </Link>

        {typeof item.avgRating === "number" && item.avgRating > 0 && (
          <StarRow rating={item.avgRating} count={item.reviewCount} />
        )}

        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-xl font-bold text-foreground">
            ${item.price.toFixed(2)}
          </span>
          {hasOriginal && (
            <span className="text-sm text-gray-400 line-through">
              ${(item.originalPrice as number).toFixed(2)}
            </span>
          )}
        </div>

        {item.storeName && (
          <p className="text-xs text-gray-500 truncate">{item.storeName}</p>
        )}

        <div className="pt-1">
          <CardAddToCart item={item} />
        </div>
      </div>
    </div>
  )
}

/** Shared "Add to Cart" button — fetches default variant then writes to cart. */
function CardAddToCart({ item }: { item: BrandProductCardItem }) {
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const cartItems = useCartStore((s) => s.items)
  const [loading, setLoading] = useState(false)
  const cartItem = cartItems.find((i) => i.productId === item.productId)
  const quantity = cartItem?.quantity ?? 0

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (item.inStock === false || loading) return
    setLoading(true)
    try {
      const product = await getProductById(item.productId)
      const variant = product.variants?.[0]
      if (!variant) {
        toast.error("This product has no purchasable variant yet")
        return
      }
      addItem({
        productId: product.id,
        variantId: variant.id,
        storeId: product.storeId,
        storeName: item.storeName || product.storeId,
        title: product.title,
        variantName: variant.name || "Default",
        price: Math.round(variant.price * 100),
        quantity: 1,
        imageUrl: item.imageUrl || product.images?.[0]?.url || undefined,
        slug: product.slug,
        weightKg: variant.weightKg ?? null,
        lengthIn: variant.lengthIn ?? null,
        widthIn: variant.widthIn ?? null,
        heightIn: variant.heightIn ?? null,
      })
    } catch {
      toast.error("Could not add to cart")
    } finally {
      setLoading(false)
    }
  }

  function step(e: React.MouseEvent, delta: number) {
    e.preventDefault()
    e.stopPropagation()
    if (!cartItem) return
    updateQuantity(cartItem.variantId, quantity + delta)
  }

  if (item.inStock === false) {
    return (
      <button
        disabled
        className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gray-100 px-3 py-2 text-xs font-bold text-gray-400 cursor-not-allowed uppercase tracking-wider"
      >
        Out of Stock
      </button>
    )
  }

  if (quantity > 0) {
    return (
      <div
        onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
        className="flex w-full items-center justify-between rounded-full bg-brand-gold px-1 py-0.5"
      >
        <button
          onClick={(e) => step(e, -1)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-brand-gold-foreground font-black hover:bg-black/10 transition-colors"
        >
          −
        </button>
        <span className="text-sm font-black text-brand-gold-foreground tabular-nums">{quantity}</span>
        <button
          onClick={(e) => step(e, +1)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-brand-gold-foreground font-black hover:bg-black/10 transition-colors"
        >
          +
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-gold hover:bg-brand-gold-hover px-3 py-2 text-xs font-bold uppercase tracking-wider text-brand-gold-foreground transition-colors disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
      Add to Cart
    </button>
  )
}
