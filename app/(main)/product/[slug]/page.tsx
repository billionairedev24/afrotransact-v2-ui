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
import { getProductBySlug, getProductById, getStoreById, type Product, type ProductVariant } from "@/lib/api"

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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const fetchProduct = async () => {
      try {
        const data = await getProductBySlug(slug).catch(() => getProductById(slug))
        if (!cancelled) {
          setProduct(data)
          setSelectedVariant(data.variants[0] ?? null)
          getStoreById(data.storeId)
            .then((store) => { if (!cancelled) setStoreName(store.name) })
            .catch(() => { if (!cancelled) setStoreName(data.storeId) })
        }
      } catch {
        if (!cancelled) setError("Product not found")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchProduct()
    return () => { cancelled = true }
  }, [slug])

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
      <div className="container py-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading product...</p>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="container py-20 text-center">
        <h2 className="text-xl font-bold text-foreground mb-2">Product Not Found</h2>
        <p className="text-muted-foreground mb-4">{error || "This product doesn't exist or has been removed."}</p>
        <Link href="/" className="text-primary hover:underline">Back to home</Link>
      </div>
    )
  }

  return (
    <div className="container py-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
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

          {variant && (
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
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-border rounded-md">
                    <button
                      onClick={() => updateQuantity(cartItem!.variantId, cartItem!.quantity - 1)}
                      className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="flex h-10 w-12 items-center justify-center text-sm font-semibold text-foreground border-x border-border tabular-nums">
                      {cartItem!.quantity}
                    </span>
                    <button
                      onClick={() => variant && updateQuantity(cartItem!.variantId, Math.min(variant.stockQuantity, cartItem!.quantity + 1))}
                      className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <Link
                    href="/cart"
                    className="flex-1 flex items-center justify-center gap-2 rounded-md h-10 px-6 text-sm font-semibold bg-card border border-border text-foreground hover:bg-muted transition-colors"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    View Cart
                  </Link>
                </div>
              </div>
            ) : (
              /* Item not in cart — show quantity picker + Add to Cart */
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center border border-border rounded-md">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="flex h-12 w-12 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="flex h-12 w-12 items-center justify-center text-sm font-semibold text-foreground border-x border-border tabular-nums">
                    {quantity}
                  </span>
                  <button
                    onClick={() => variant && setQuantity(Math.min(variant.stockQuantity, quantity + 1))}
                    className="flex h-12 w-12 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  disabled={!inStock}
                  onClick={handleAddToCart}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-md h-12 px-8 text-sm font-semibold transition-all",
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
                className="w-full flex items-center justify-center gap-2 rounded-md h-12 px-8 text-sm font-semibold bg-white text-[#0f0f10] hover:bg-gray-100 transition-colors shadow-sm"
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

      {product && (
        <div className="mt-12">
          <ProductReviews productId={product.id} />
        </div>
      )}
    </div>
  )
}
