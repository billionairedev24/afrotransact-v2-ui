"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Star, MapPin, Leaf, ChevronRight, Loader2, ShoppingCart } from "lucide-react"
import { searchProducts, getProductById, type SearchResult } from "@/lib/api"
import { useCartStore } from "@/stores/cart-store"
import { toast } from "sonner"
import { ProductCardSkeleton } from "@/components/ui/Skeleton"

interface Props {
  title?: string
  subtitle?: string
  sortBy?: string
  size?: number
  viewAllHref?: string
  icon?: React.ReactNode
  /**
   * Products pre-fetched on the server. When provided, the client skips the
   * initial search call (removes one network round-trip per home section).
   */
  initialProducts?: SearchResult[]
}

function AddToCartButton({ item }: { item: SearchResult }) {
  const [loading, setLoading] = useState(false)
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const cartItem = useCartStore((s) => s.items.find((i) => i.productId === item.product_id))
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
        <button onClick={(e) => handleChange(e, -1)} className="flex h-7 w-7 items-center justify-center rounded-md text-[#0f0f10] font-black text-base hover:bg-black/10 transition-colors">−</button>
        <span className="text-sm font-black text-[#0f0f10] tabular-nums">{quantity}</span>
        <button onClick={(e) => handleChange(e, +1)} className="flex h-7 w-7 items-center justify-center rounded-md text-[#0f0f10] font-black text-base hover:bg-black/10 transition-colors">+</button>
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

export function FeaturedProducts({
  title = "Fresh Near You",
  subtitle,
  sortBy = "rating",
  size = 8,
  viewAllHref = "/search?sort=rating",
  icon,
  initialProducts,
}: Props) {
  const [products, setProducts] = useState<SearchResult[]>(initialProducts ?? [])
  const [loading, setLoading] = useState(initialProducts === undefined)

  useEffect(() => {
    if (initialProducts) return
    searchProducts({ size: String(size), sort_by: sortBy })
      .then((res) => setProducts(res.results))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sortBy, size, initialProducts])

  if (loading) {
    return (
      <section className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                {icon || <MapPin className="h-3.5 w-3.5 text-primary" />}
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </section>
    )
  }

  if (products.length === 0) return null

  return (
    <section className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              {icon || <MapPin className="h-3.5 w-3.5 text-primary" />}
              {subtitle}
            </p>
          )}
        </div>
        <Link href={viewAllHref} className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
        {products.map((product) => (
          <Link
            key={product.product_id}
            href={`/product/${product.slug || product.product_id}`}
            className="group rounded-xl sm:rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 flex flex-col"
          >
            <div className="h-[120px] sm:h-auto sm:aspect-square bg-gradient-to-br from-muted to-muted/50 relative overflow-hidden flex items-center justify-center">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                />
              ) : (
                <Leaf className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/30" />
              )}
              {!product.in_stock && (
                <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 text-[9px] sm:text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-red-500/90 text-white">
                  Out of Stock
                </span>
              )}
            </div>

            <div className="p-2 sm:p-3 space-y-1 sm:space-y-1.5 flex-1 flex flex-col">
              <h3 className="text-[11px] sm:text-[13px] font-semibold text-card-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2 flex-1">
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
                <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{product.store_name}</span>
                {product.distance_miles != null && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-secondary/10 border border-secondary/20 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium text-secondary shrink-0">
                    <MapPin className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                    {product.distance_miles.toFixed(1)} mi
                  </span>
                )}
              </div>
              <AddToCartButton item={product} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
