"use client"

/**
 * Horizontal product carousel — faithful port of public/ux-designs/code.html
 * lines 267-326 (Today's Deals) and 360-end (New Arrivals).
 *
 * Card composition per the mockup:
 *   • Square product image with corner badge slot ("20% Off", "Out of stock")
 *   • 2-line title
 *   • Filled stars from avg_rating + gray stars to 5, with "(review_count)"
 *   • Price (large/bold/brand-gold). Strikethrough secondary price when
 *     `max_price > min_price` is used as the "list" reference.
 *   • Delivery line (static text — backend has no per-product delivery ETA yet)
 *   • Full-width "Add to Cart" button. Tonight it routes to the PDP since the
 *     real add-to-cart handler lives on the PDP; future task wires a true
 *     one-click add.
 *
 * Carousel UX: smooth horizontal scroll with chevrons appearing on hover.
 * Hides itself entirely when products is empty (emptyHide=true default).
 */

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getProductById, type SearchResult } from "@/lib/api"
import { useCartStore } from "@/stores/cart-store"
import { StarRating } from "@/components/products/StarRating"

interface ProductRowProps {
  title: string
  products: SearchResult[]
  viewAllHref?: string
  viewAllLabel?: string
  /** Pill rendered next to the title (e.g. "Ending soon"). */
  badge?: string
  /** Default true: render null when products is empty. */
  emptyHide?: boolean
}

function MiniProductCard({ product }: { product: SearchResult }) {
  const href = `/product/${product.slug || product.product_id}`
  const hasRange = product.max_price > product.min_price
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const [, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)

  // Search index doesn't carry variants, so on click we fetch the product and
  // pick its first/default variant. If the product has multiple variants we
  // bounce to the PDP so the buyer can choose.
  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!product.in_stock) {
      toast.error("Out of stock")
      return
    }
    setAdding(true)
    try {
      const full = await getProductById(product.product_id)
      if (!full.variants?.length) {
        toast.error("Unavailable")
        return
      }
      if (full.variants.length > 1) {
        startTransition(() => router.push(href))
        return
      }
      const v = full.variants[0]
      if (v.stockQuantity <= 0) {
        toast.error("Out of stock")
        return
      }
      addItem({
        productId: full.id,
        variantId: v.id,
        storeId: full.storeId,
        storeName: product.store_name || full.storeId,
        title: full.title,
        variantName: v.name || "Default",
        price: Math.round(v.price * 100),
        quantity: 1,
        imageUrl: full.images[0]?.url ?? product.image_url ?? undefined,
        slug: full.slug,
        weightKg: v.weightKg ?? null,
        lengthIn: v.lengthIn ?? null,
        widthIn: v.widthIn ?? null,
        heightIn: v.heightIn ?? null,
      })
      toast.success("Added to cart", { description: full.title })
    } catch {
      toast.error("Couldn't add to cart")
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="min-w-[240px] max-w-[240px] flex flex-col gap-2 group">
      <Link href={href} className="block">
        <div className="aspect-square bg-muted relative overflow-hidden rounded-lg">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.title}
              fill
              sizes="240px"
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-woven flex items-center justify-center">
              <img src="/brand/logo-mark.svg" alt="" aria-hidden className="h-10 w-10 opacity-50" />
            </div>
          )}
          {!product.in_stock && (
            <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-1 uppercase rounded-sm">
              Out of stock
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-col gap-1">
        <Link href={href}>
          <h4 className="text-sm font-medium text-foreground line-clamp-2 hover:text-foreground transition-colors">
            {product.title}
          </h4>
        </Link>

        <StarRating rating={product.avg_rating} count={product.review_count} />

        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-foreground">
            ${product.min_price.toFixed(2)}
          </span>
          {hasRange && (
            <span className="text-[11px] text-muted-foreground line-through">
              ${product.max_price.toFixed(2)}
            </span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">Get it by Tomorrow</p>

        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !product.in_stock}
          className="mt-2 w-full bg-brand-gold text-brand-gold-foreground border border-brand-gold-hover py-1.5 rounded-full text-xs font-bold text-center hover:bg-brand-gold-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
        >
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {adding ? "Adding…" : "Add to Cart"}
        </button>
      </div>
    </div>
  )
}

export function ProductRow({
  title,
  products,
  viewAllHref,
  viewAllLabel = "See all",
  badge,
  emptyHide = true,
}: ProductRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (emptyHide && products.length === 0) return null

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === "left" ? -600 : 600,
        behavior: "smooth",
      })
    }
  }

  return (
    <section className="max-w-page mx-auto px-4 sm:px-5">
      <div className="bg-card border border-border p-4 sm:p-5 rounded-xl">
        <div className="flex items-end justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl md:text-[1.7rem] font-semibold tracking-tight text-foreground">{title}</h2>
            {badge && (
              <span className="inline-flex items-center gap-1 text-destructive font-semibold text-[11px] px-2 py-0.5 bg-destructive/10 rounded-full">
                {badge}
              </span>
            )}
          </div>
          {viewAllHref && (
            <Link href={viewAllHref} className="shrink-0 inline-flex items-center gap-1 text-brand-green font-semibold text-sm hover:underline">
              {viewAllLabel}
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        <div className="relative group">
          <button
            type="button"
            onClick={() => scroll("left")}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-card shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted border border-border"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {products.map((product) => (
              <MiniProductCard key={product.product_id} product={product} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => scroll("right")}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-card shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted border border-border"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </div>
    </section>
  )
}
