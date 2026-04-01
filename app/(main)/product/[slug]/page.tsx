"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Heart, Share2, Minus, Plus, ShoppingCart, Store, ChevronRight,
  Truck, Shield, RotateCcw, Leaf, Check, Loader2, Zap, Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
import ProductReviews from "@/components/reviews/ProductReviews"
import { useCartStore } from "@/stores/cart-store"
import {
  getProductBySlug,
  getProductById,
  getStoreById,
  getRegions,
  getRegionFeatures,
  type Product,
  type ProductVariant,
  type FeatureFlag,
  type Region,
  getActiveDeals,
  type DealData,
} from "@/lib/api"

export default function ProductPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [product, setProduct] = useState<Product | null>(null)
  const [storeName, setStoreName] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const [wishlisted, setWishlisted] = useState(false)

  const items = useCartStore((s) => s.items)
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)

  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [productDeal, setProductDeal] = useState<DealData | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const fetchData = async () => {
      try {
        // 1. Fetch product
        const data = await getProductBySlug(slug).catch(() => getProductById(slug))
        if (cancelled) return
        setProduct(data)
        setSelectedVariant(data.variants[0] ?? null)
        
        // 2. Fetch store name
        getStoreById(data.storeId)
          .then((store) => { if (!cancelled) setStoreName(store.name) })
          .catch(() => { if (!cancelled) setStoreName(data.storeId) })

        // 3. Fetch Region & Flags (Non-critical, gracefully fail)
        try {
          const regions = await getRegions("", true).catch(() => [])
          const r = regions.find((r) => r.code === "us-tx-austin") ?? regions[0]
          
          if (r && !cancelled) {
            const [f, deals] = await Promise.all([
              getRegionFeatures(r.id).catch(() => []),
              getActiveDeals().catch(() => [])
            ])
            if (!cancelled) {
              setFlags(f)
              const deal = deals.find(d => d.productId === data.id)
              setProductDeal(deal || null)
            }
          }
        } catch (secondaryError) {
          console.warn("Secondary data fetch failed (flags/deals):", secondaryError)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Product not found")
          console.error("Product fetch error:", e)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [slug])

  const reviewsEnabled = flags.find((f) => f.key === "reviews_enabled")?.enabled ?? true
  const marketplaceEnabled = flags.find((f) => f.key === "marketplace_enabled")?.enabled ?? true

  const variant = selectedVariant ?? product?.variants[0] ?? null
  const inStock = variant ? variant.stockQuantity > 0 : false

  const cartItem = variant ? items.find((i) => i.variantId === variant.id) : null
  const isInCart = !!cartItem

  function handleAddToCart() {
    if (!product || !variant) return
    addItem({
      productId: product.id,
      variantId: variant.id,
      storeId: product.storeId,
      storeName: storeName || product.storeId,
      title: product.title,
      variantName: variant.name || "Default",
      price: Math.round(variant.price * 100),
      quantity,
      imageUrl: product.images[0]?.url,
      slug: product.slug,
    })
  }

  function handleBuyNow() {
    if (!product || !variant) return
    if (!isInCart) {
      addItem({
        productId: product.id,
        variantId: variant.id,
        storeId: product.storeId,
        storeName: storeName || product.storeId,
        title: product.title,
        variantName: variant.name || "Default",
        price: Math.round(variant.price * 100),
        quantity,
        imageUrl: product.images[0]?.url,
        slug: product.slug,
      })
    }
    router.push("/checkout")
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading product...</p>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-xl font-bold text-foreground mb-2">Product Not Found</h2>
        <p className="text-muted-foreground mb-4">{error || "This product doesn't exist or has been removed."}</p>
        <Link href="/" className="text-primary hover:underline">Back to home</Link>
      </div>
    )
  }

  if (!marketplaceEnabled) {
    return (
      <div className="container py-20 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Marketplace not available</h2>
        <p className="text-gray-500 mb-4">
          The marketplace is currently disabled for your region. Product pages are not available.
        </p>
        <Link href="/" className="text-primary hover:underline">Back to home</Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        {product.categories[0] && (
          <>
            <Link href={`/category/${product.categories[0].slug}`} className="hover:text-foreground transition-colors">
              {product.categories[0].name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        <span className="text-foreground line-clamp-1">{product.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image gallery */}
        <div className="space-y-4">
          <div className="relative aspect-square rounded-lg border border-border bg-card overflow-hidden">
            {product.images.length > 0 ? (
              <img
                src={product.images[selectedImage]?.url}
                alt={product.images[selectedImage]?.altText || product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center gap-3">
                <Leaf className="h-20 w-20 text-muted-foreground/30" />
                <span className="text-sm text-muted-foreground">Product image</span>
              </div>
            )}

            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <button
                onClick={() => setWishlisted(!wishlisted)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full backdrop-blur transition-colors",
                  wishlisted ? "bg-destructive/90 text-white" : "bg-card/80 text-muted-foreground hover:text-foreground"
                )}
                aria-label="Add to wishlist"
              >
                <Heart className={cn("h-5 w-5", wishlisted && "fill-current")} />
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-card/80 backdrop-blur text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Share"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {product.images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(i)}
                  className={cn(
                    "flex-shrink-0 w-20 h-20 rounded-md border overflow-hidden transition-colors",
                    selectedImage === i ? "border-primary" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <img src={img.url} alt={img.altText || ""} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{product.title}</h1>
          </div>

          {productDeal ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="inline-block rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-header uppercase tracking-wider">
                  {productDeal.badgeText || "Special Deal"}
                </span>
                {productDeal.discountPercent && (
                  <span className="text-sm font-bold text-primary">{productDeal.discountPercent}% OFF</span>
                )}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-primary">
                  ${(productDeal.dealPriceCents ? productDeal.dealPriceCents / 100 : (variant?.price || 0) * (1 - (productDeal.discountPercent || 0) / 100)).toFixed(2)}
                </span>
                <span className="text-lg text-muted-foreground line-through">
                  ${(variant?.price || 0).toFixed(2)}
                </span>
              </div>
            </div>
          ) : variant && (
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary">
                ${variant.price.toFixed(2)}
              </span>
              {variant.compareAtPrice != null && variant.compareAtPrice > variant.price && (
                <>
                  <span className="text-lg text-muted-foreground line-through">
                    ${variant.compareAtPrice.toFixed(2)}
                  </span>
                  <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                    Save ${(variant.compareAtPrice - variant.price).toFixed(2)}
                  </span>
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <Link href={`/store/${product.storeId}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                {storeName || "Store"}
              </Link>
            </div>
          </div>

          {product.variants.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Options</h3>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => { setSelectedVariant(v); setQuantity(1) }}
                    className={cn(
                      "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                      variant?.id === v.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-muted-foreground",
                      v.stockQuantity === 0 && "opacity-50 cursor-not-allowed line-through"
                    )}
                    disabled={v.stockQuantity === 0}
                  >
                    {v.name || v.sku} — ${v.price.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cart controls: Add to Cart vs Quantity Stepper */}
          <div className="space-y-3">
            {isInCart ? (
              /* Item is already in cart — show quantity controls */
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Check className="h-4 w-4" />
                    In your cart
                  </span>
                  <button
                    onClick={() => removeItem(cartItem!.variantId)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex items-center shrink-0 self-start border border-border rounded-md touch-manipulation">
                    <button
                      type="button"
                      onClick={() => updateQuantity(cartItem!.variantId, cartItem!.quantity - 1)}
                      className="flex min-h-11 min-w-11 sm:h-10 sm:w-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="flex min-h-11 min-w-12 sm:h-10 sm:w-12 items-center justify-center text-sm font-semibold text-foreground border-x border-border tabular-nums px-1">
                      {cartItem!.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => variant && updateQuantity(cartItem!.variantId, Math.min(variant.stockQuantity, cartItem!.quantity + 1))}
                      className="flex min-h-11 min-w-11 sm:h-10 sm:w-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <Link
                    href="/cart"
                    className="flex w-full sm:flex-1 min-w-0 items-center justify-center gap-2 rounded-md min-h-11 px-6 text-sm font-semibold bg-card border border-border text-foreground hover:bg-muted transition-colors touch-manipulation"
                  >
                    <ShoppingCart className="h-4 w-4 shrink-0" />
                    View Cart
                  </Link>
                </div>
              </div>
            ) : (
              /* Item not in cart — show quantity picker + Add to Cart */
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center shrink-0 self-start border border-border rounded-md touch-manipulation">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="flex min-h-12 min-w-12 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="flex min-h-12 min-w-12 items-center justify-center text-sm font-semibold text-foreground border-x border-border tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => variant && setQuantity(Math.min(variant.stockQuantity, quantity + 1))}
                    className="flex min-h-12 min-w-12 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!inStock}
                  onClick={handleAddToCart}
                  className={cn(
                    "flex-1 min-w-0 flex items-center justify-center gap-2 rounded-md min-h-12 px-8 text-sm font-semibold transition-all touch-manipulation",
                    inStock
                      ? "bg-primary text-primary-foreground hover:bg-accent shadow-lg shadow-primary/25"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {inStock ? "Add to Cart" : "Out of Stock"}
                </button>
              </div>
            )}

            {/* Buy Now button — always visible when in stock */}
            {inStock && (
              <button
                onClick={handleBuyNow}
                className="w-full flex items-center justify-center gap-2 rounded-md h-12 px-8 text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-sm"
              >
                <Zap className="h-4 w-4" />
                Buy Now
              </button>
            )}
          </div>

          {variant && inStock && variant.stockQuantity <= 10 && (
            <p className="text-sm text-warning">
              Only {variant.stockQuantity} left in stock — order soon!
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Truck className="h-4 w-4 text-secondary" />
              <span>Local delivery</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-secondary" />
              <span>Secure payment</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RotateCcw className="h-4 w-4 text-secondary" />
              <span>Easy returns</span>
            </div>
          </div>

          {product.description && (
            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Description</h3>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {product.description}
              </div>
            </div>
          )}
        </div>
      </div>

      {product && reviewsEnabled && (
        <div className="mt-16 border-t border-border pt-12">
          <ProductReviews productId={product.id} />
        </div>
      )}
    </div>
  )
}
