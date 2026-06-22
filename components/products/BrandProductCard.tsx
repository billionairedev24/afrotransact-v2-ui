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
import { Star, ShoppingCart, Loader2, Timer, Package, MapPin } from "lucide-react"
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
  /**
   * Distance in miles from the buyer's Deliver-to location to the store.
   * Only populated by geo-aware search calls (lat/lon passed). Null/omitted
   * from non-geo contexts (homepage strips), so the badge stays absent there.
   */
  distanceMiles?: number | null
}

/**
 * Render a human-readable "ends in" label.
 *   >= 2 days  -> "Ends in 5d"          (drop hours below the day scale)
 *   >= 1 day   -> "Ends in 1d 4h"       (one-and-some, hours still relevant)
 *   >= 1 hour  -> "Ends in 3h 12m"
 *   >= 1 min   -> "Ends in 12m 34s"
 *   < 1 min    -> "Ends in 45s"
 * No more "Ends in 371:48:49" — shoppers shouldn't have to parse that.
 */
function formatRemaining(diffMs: number): string {
  const totalSec = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (days >= 2) return `${days}d`
  if (days >= 1) return `${days}d ${hours}h`
  if (hours >= 1) return `${hours}h ${minutes}m`
  if (minutes >= 1) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function Countdown({ endsAt, compact = false }: { endsAt: string; compact?: boolean }) {
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const end = new Date(endsAt).getTime()
  const diff = Math.max(0, end - now)
  if (diff === 0) return null
  return (
    <div className={cn("flex items-center gap-1 text-red-600 font-bold", compact ? "text-[11px]" : "text-xs mb-2")}>
      <Timer className="h-3.5 w-3.5" />
      <span>Ends in {formatRemaining(diff)}</span>
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

        {(item.storeName || (typeof item.distanceMiles === "number" && item.distanceMiles >= 0)) && (
          <div className="flex items-center justify-between gap-1">
            {item.storeName ? (
              <p className="text-xs text-gray-500 truncate">{item.storeName}</p>
            ) : <span />}
            {typeof item.distanceMiles === "number" && item.distanceMiles >= 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 shrink-0">
                <MapPin className="h-2.5 w-2.5" />
                {item.distanceMiles.toFixed(1)} mi
              </span>
            )}
          </div>
        )}

        <div className="pt-1">
          <CardAddToCart item={item} />
        </div>
      </div>
    </div>
  )
}

/**
 * Horizontal list-row variant used by /deals + /search list view. Same data
 * model as BrandProductCard, but the image is capped to a 160px square on
 * the left so a single deal can't blow up to full-content-width like the
 * grid card does (which assumes it's one of N siblings in a grid).
 */
export function BrandProductRow({ item }: { item: BrandProductCardItem }) {
  const href = `/product/${item.slug || item.productId}`
  const hasOriginal =
    typeof item.originalPrice === "number" &&
    item.originalPrice !== null &&
    item.originalPrice > item.price

  return (
    <div className="group flex bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <Link href={href} className="relative block shrink-0 w-32 sm:w-40 aspect-square bg-gray-100 overflow-hidden">
        {typeof item.discountPercent === "number" && item.discountPercent > 0 && (
          <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded z-10">
            {item.discountPercent}% Off
          </div>
        )}
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            sizes="160px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-gray-300" />
          </div>
        )}
        {item.inStock === false && (
          <span className="absolute left-2 bottom-2 rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
            Out of Stock
          </span>
        )}
      </Link>

      <div className="flex-1 min-w-0 p-4 flex flex-col gap-2">
        {item.dealOfTheDay && (
          <span className="self-start bg-gray-100 text-red-600 font-bold text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded">
            Deal of the Day
          </span>
        )}
        {item.endsAt && !item.dealOfTheDay && <Countdown endsAt={item.endsAt} compact />}

        <Link href={href}>
          <h3 className="text-sm sm:text-base font-medium leading-tight text-foreground line-clamp-2 group-hover:text-brand-gold-hover transition-colors">
            {item.title}
          </h3>
        </Link>

        {typeof item.avgRating === "number" && item.avgRating > 0 && (
          <StarRow rating={item.avgRating} count={item.reviewCount} />
        )}

        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-foreground">${item.price.toFixed(2)}</span>
          {hasOriginal && (
            <span className="text-sm text-gray-400 line-through">
              ${(item.originalPrice as number).toFixed(2)}
            </span>
          )}
        </div>

        {item.storeName && (
          <p className="text-xs text-gray-500 truncate">{item.storeName}</p>
        )}

        <div className="mt-auto sm:max-w-[200px]">
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
