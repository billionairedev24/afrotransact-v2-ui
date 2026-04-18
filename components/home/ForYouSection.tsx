"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, Loader2, Sparkles, Star, MapPin, Leaf, ShoppingCart } from "lucide-react"
import { getRecommendations, getProductById, type SearchResult, type RecommendationsResponse } from "@/lib/api"
import { useCartStore } from "@/stores/cart-store"
import { toast } from "sonner"

function AddToCartButton({ item }: { item: SearchResult }) {
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const cartItems = useCartStore((s) => s.items)
  const [loading, setLoading] = useState(false)

  const cartItem = cartItems.find((i) => i.productId === item.product_id)
  const quantity = cartItem?.quantity ?? 0

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!item.in_stock || loading) return
    setLoading(true)
    try {
      const product = await getProductById(item.product_id)
      const variant = product.variants?.[0]
      if (!variant) { toast.error("No purchasable variant"); return }
      addItem({
        productId: product.id,
        variantId: variant.id,
        storeId: product.storeId,
        storeName: item.store_name || product.storeId,
        title: product.title,
        variantName: variant.name || "Default",
        price: Math.round(variant.price * 100),
        quantity: 1,
        imageUrl: item.image_url || product.images?.[0]?.url,
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

  function handleChange(e: React.MouseEvent, delta: number) {
    e.preventDefault()
    e.stopPropagation()
    if (!cartItem) return
    updateQuantity(cartItem.variantId, quantity + delta)
  }

  if (!item.in_stock) {
    return (
      <button disabled className="mt-1 flex w-full items-center justify-center rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-400 cursor-not-allowed">
        Out of Stock
      </button>
    )
  }

  if (quantity > 0) {
    return (
      <div
        onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
        className="mt-1 flex w-full items-center justify-between rounded-lg bg-primary px-1 py-0.5"
      >
        <button
          onClick={(e) => handleChange(e, -1)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#0f0f10] font-black text-base hover:bg-black/10 transition-colors"
        >
          −
        </button>
        <span className="text-sm font-black text-[#0f0f10] tabular-nums">{quantity}</span>
        <button
          onClick={(e) => handleChange(e, +1)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#0f0f10] font-black text-base hover:bg-black/10 transition-colors"
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
      className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
      Add to Cart
    </button>
  )
}

function ProductCard({ product }: { product: SearchResult }) {
  const path = (product.slug?.trim()) || product.product_id
  return (
    <Link
      href={`/product/${encodeURIComponent(path)}`}
      className="group relative flex flex-col rounded-xl sm:rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
    >
      <div className="relative aspect-square w-full shrink-0 bg-muted/50">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain object-center p-2 sm:p-3 group-hover:scale-[1.02] transition-transform duration-200"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Leaf className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        {!product.in_stock && (
          <span className="absolute top-2 right-2 z-[1] text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-red-500/90 text-white">
            Out of stock
          </span>
        )}
      </div>
      <div className="p-2 sm:p-3 space-y-1 sm:space-y-1.5 flex-1 min-w-0">
        <h3 className="text-[11px] sm:text-[13px] font-semibold text-card-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2">
          {product.title}
        </h3>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-sm sm:text-[15px] font-bold text-primary">${product.min_price.toFixed(2)}</span>
          {product.max_price > product.min_price && (
            <span className="text-[10px] sm:text-[11px] text-muted-foreground">– ${product.max_price.toFixed(2)}</span>
          )}
        </div>
        {product.avg_rating > 0 && (
          <div className="hidden sm:flex items-center gap-1">
            <Star className="h-3 w-3 fill-primary text-primary" />
            <span className="text-[11px] font-medium text-foreground">{product.avg_rating.toFixed(1)}</span>
            <span className="text-[11px] text-muted-foreground">({product.review_count})</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-0.5 gap-1">
          {product.store_name && (
            <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{product.store_name}</span>
          )}
          {product.distance_miles != null && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-secondary/10 border border-secondary/20 px-1.5 py-0.5 text-[10px] font-medium text-secondary shrink-0">
              <MapPin className="h-2.5 w-2.5" />{product.distance_miles.toFixed(1)} mi
            </span>
          )}
        </div>
        <AddToCartButton item={product} />
      </div>
    </Link>
  )
}

export function ForYouSection({ token }: { token?: string }) {
  const [data, setData] = useState<RecommendationsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRecommendations(token, 8)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [token])

  // Don't render at all until loaded — avoids layout shift on first visit (no history)
  if (loading || !data || data.results.length === 0) return null

  const label = data.based_on?.length ? `Based on your interest in ${data.based_on[0]}` : "Popular on AfroTransact"

  return (
    <section className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            For You
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>
        <Link
          href="/search?sort=rating"
          className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          See more <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
        {data.results.map((product) => (
          <ProductCard key={product.product_id} product={product} />
        ))}
      </div>
    </section>
  )
}
