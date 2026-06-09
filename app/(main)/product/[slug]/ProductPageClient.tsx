"use client"

/**
 * Product Detail — buyer view.
 *
 * Layout ported from public/ux-designs/product-view.html (Amazon-style 3-col):
 *   col-span-4 — left: vertical thumbnail rail + main image (sticky on lg+)
 *   col-span-5 — center: title, store link, rating row, price block,
 *                variant selectors, "About this item" bullets
 *   col-span-3 — right: sticky buy box (price, ETA, qty, Add to Cart,
 *                Buy Now, secure transaction, ships/sold/returns grid)
 *
 * Brand tokens are sourced from the marketplace theme (brand-gold for CTAs,
 * dark foreground text). Every existing API call and state hook is preserved:
 *   getProductBySlug / getProductById fallback, getStoreById, getRegions,
 *   getRegionFeatures, getActiveDeals, trackEvent, useCartStore, ProductReviews.
 */

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import {
  Minus, Plus, ShoppingCart, ChevronRight, Truck, Lock, Loader2, Zap,
  Trash2, Package, MapPin, RotateCcw, Heart, Star,
} from "lucide-react"
import { cn } from "@/lib/utils"
import ProductReviews from "@/components/reviews/ProductReviews"
import { useCartStore } from "@/stores/cart-store"
import { useWishlistStore } from "@/stores/wishlist-store"
import { useWishlist } from "@/hooks/use-wishlist"
import { getProductReviews } from "@/lib/api"
import {
  getProductBySlug,
  getProductById,
  getStoreById,
  getRegions,
  getRegionFeatures,
  type Product,
  type ProductVariant,
  type FeatureFlag,
  getActiveDeals,
  type DealData,
  trackEvent,
} from "@/lib/api"
import { logError } from "@/lib/errors"
import { resolveDefaultRegion } from "@/lib/regions"

/** Parse a product description into bullet list + leftover paragraphs. */
function parseDescription(raw: string): { bullets: string[]; lead: string } {
  if (!raw) return { bullets: [], lead: "" }
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const bullets: string[] = []
  const rest: string[] = []
  for (const line of lines) {
    if (/^[-*•]\s+/.test(line)) bullets.push(line.replace(/^[-*•]\s+/, ""))
    else rest.push(line)
  }
  return { bullets, lead: rest.join("\n\n") }
}

export default function ProductPageClient() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [product, setProduct] = useState<Product | null>(null)
  const [storeName, setStoreName] = useState<string>("")
  const [storeReturnsSupported, setStoreReturnsSupported] = useState<boolean>(false)
  const [storeReturnWindowDays, setStoreReturnWindowDays] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  // Cross-device wishlist (#43): for authenticated users this round-trips to
  // the user-profile service; for anonymous users it falls back to the local
  // zustand store. Keep `useWishlistStore` for the anonymous metadata write
  // (title/image/price) — the local store carries display data the server
  // doesn't track.
  const wishlist = useWishlist()
  const localWishlistAdd = useWishlistStore((s) => s.add)
  const localWishlistRemove = useWishlistStore((s) => s.remove)
  const [wishlistHydrated, setWishlistHydrated] = useState(false)
  useEffect(() => { setWishlistHydrated(true) }, [])
  const wishlisted = wishlistHydrated && product ? wishlist.has(product.id) : false

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
        const data = await getProductBySlug(slug).catch(() => getProductById(slug))
        if (cancelled) return
        setProduct(data)
        setSelectedVariant(data.variants[0] ?? null)

        trackEvent({
          event_type: "view",
          product_id: data.id,
          category: data.categories?.[0]?.name,
        })

        getStoreById(data.storeId)
          .then((store) => {
            if (cancelled) return
            setStoreName(store.name)
            setStoreReturnsSupported(store.returnsSupported === true)
            setStoreReturnWindowDays(
              typeof store.returnWindowDays === "number" ? store.returnWindowDays : null,
            )
          })
          .catch(() => { if (!cancelled) setStoreName(data.storeId) })

        try {
          const regions = await getRegions("", true).catch(() => [])
          const r = resolveDefaultRegion(regions)
          if (r && !cancelled) {
            const [f, deals] = await Promise.all([
              getRegionFeatures(r.id).catch(() => []),
              getActiveDeals().catch(() => []),
            ])
            if (!cancelled) {
              setFlags(f)
              const deal = deals.find((d) => d.productId === data.id)
              setProductDeal(deal || null)
            }
          }
        } catch (secondaryError) {
          console.warn("Secondary data fetch failed (flags/deals):", secondaryError)
        }
      } catch (e) {
        logError(e, "loading product")
        if (!cancelled) setError("Product not found")
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

  // Effective price honouring per-product deal override.
  const displayPriceCents = useMemo(() => {
    if (!variant) return 0
    if (productDeal?.dealPriceCents != null) return productDeal.dealPriceCents
    if (productDeal?.discountPercent) {
      return Math.round(variant.price * 100 * (1 - productDeal.discountPercent / 100))
    }
    return Math.round(variant.price * 100)
  }, [variant, productDeal])
  const originalPriceCents = variant ? Math.round(variant.price * 100) : 0
  const onSale = productDeal != null || (variant?.compareAtPrice != null && variant.compareAtPrice > variant.price)
  const compareCents = variant?.compareAtPrice != null && variant.compareAtPrice > variant.price
    ? Math.round(variant.compareAtPrice * 100)
    : (productDeal ? originalPriceCents : null)
  const discountPct = productDeal?.discountPercent ??
    (variant?.compareAtPrice && variant.compareAtPrice > variant.price
      ? Math.round((1 - variant.price / variant.compareAtPrice) * 100)
      : null)

  const { bullets, lead } = useMemo(
    () => parseDescription(product?.description ?? ""),
    [product?.description],
  )

  function handleAddToCart() {
    if (!product || !variant) return
    addItem({
      productId: product.id,
      variantId: variant.id,
      storeId: product.storeId,
      storeName: storeName || product.storeId,
      title: product.title,
      variantName: variant.name || "Default",
      price: displayPriceCents,
      quantity,
      imageUrl: product.images[0]?.url,
      slug: product.slug,
      weightKg: variant.weightKg ?? null,
      lengthIn: variant.lengthIn ?? null,
      widthIn: variant.widthIn ?? null,
      heightIn: variant.heightIn ?? null,
    })
  }

  function handleBuyNow() {
    if (!product || !variant) return
    if (!isInCart) handleAddToCart()
    router.push("/checkout")
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
        <p className="text-sm text-gray-500">Loading product…</p>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-xl font-bold text-foreground mb-2">Product Not Found</h2>
        <p className="text-gray-500 mb-4">{error || "This product doesn't exist or has been removed."}</p>
        <Link href="/" className="text-brand-gold-foreground font-semibold hover:underline">
          Back to home
        </Link>
      </div>
    )
  }

  if (!marketplaceEnabled) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-20 text-center">
        <h2 className="text-xl font-bold text-foreground mb-2">Marketplace not available</h2>
        <p className="text-gray-500 mb-4">
          The marketplace is currently disabled for your region. Product pages are not available.
        </p>
        <Link href="/" className="text-brand-gold-foreground font-semibold hover:underline">
          Back to home
        </Link>
      </div>
    )
  }

  const stockBadge = !inStock
    ? { label: "Out of stock", tone: "text-red-600" }
    : variant && variant.stockQuantity <= 10
      ? { label: `Only ${variant.stockQuantity} left`, tone: "text-amber-700" }
      : { label: "In Stock", tone: "text-green-700" }

  const imageUrl = product.images[selectedImage]?.url

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 mb-6 overflow-hidden">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        {product.categories[0] && (
          <>
            <Link
              href={`/category/${product.categories[0].slug}`}
              className="hover:text-foreground transition-colors"
            >
              {product.categories[0].name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          </>
        )}
        <span className="text-foreground truncate">{product.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* ── LEFT: Image gallery (col-span-4 on lg) ────────────────── */}
        <div className="lg:col-span-4 lg:sticky lg:top-20">
          <div className="flex gap-3">
            {product.images.length > 1 && (() => {
              // Cap the vertical thumb rail so it never grows a scrollbar
              // even when a seller uploads dozens of shots. We show up to
              // MAX_VISIBLE thumbs; the last visible cell becomes a "+N"
              // chip when there are more, and clicking it advances the
              // selection to the next hidden image (cycles back to 0 once
              // the user scrolls past the end). Buyers who want every shot
              // can use the main image's chevrons (added below).
              const MAX_VISIBLE = 5
              const total = product.images.length
              const overflow = total > MAX_VISIBLE
              const visible = overflow ? product.images.slice(0, MAX_VISIBLE - 1) : product.images
              const hiddenCount = overflow ? total - (MAX_VISIBLE - 1) : 0
              return (
                <div className="flex flex-col gap-2 w-16 shrink-0">
                  {visible.map((img, i) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setSelectedImage(i)}
                      className={cn(
                        "relative h-16 w-16 rounded-md overflow-hidden border-2 transition-colors shrink-0",
                        i === selectedImage
                          ? "border-brand-gold"
                          : "border-gray-200 hover:border-gray-400",
                      )}
                      aria-label={`Image ${i + 1}`}
                    >
                      <Image
                        src={img.url}
                        alt={img.altText || ""}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                  {overflow && (
                    <button
                      type="button"
                      onClick={() => setSelectedImage((selectedImage + 1) % total)}
                      className={cn(
                        "relative h-16 w-16 rounded-md overflow-hidden border-2 shrink-0 group",
                        selectedImage >= MAX_VISIBLE - 1
                          ? "border-brand-gold"
                          : "border-gray-200 hover:border-gray-400",
                      )}
                      aria-label={`See ${hiddenCount} more images`}
                    >
                      <Image
                        src={product.images[MAX_VISIBLE - 1]!.url}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover opacity-60 group-hover:opacity-50 transition-opacity"
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white bg-black/40">
                        +{hiddenCount}
                      </span>
                    </button>
                  )}
                </div>
              )
            })()}

            <div className="flex-1 relative aspect-square bg-white border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center group">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={product.images[selectedImage]?.altText || product.title}
                  width={640}
                  height={640}
                  priority={selectedImage === 0}
                  className="w-full h-full object-contain p-4 transition-transform duration-300 hover:scale-110"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Package className="h-16 w-16" />
                  <span className="text-xs">No image</span>
                </div>
              )}
              {product.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedImage((selectedImage - 1 + product.images.length) % product.images.length)}
                    aria-label="Previous image"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white border border-gray-200 shadow-sm text-foreground hover:bg-gray-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedImage((selectedImage + 1) % product.images.length)}
                    aria-label="Next image"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white border border-gray-200 shadow-sm text-foreground hover:bg-gray-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 text-white text-[10px] font-medium px-2 py-0.5">
                    {selectedImage + 1} / {product.images.length}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── CENTER: Product details (col-span-5 on lg) ────────────── */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
              {product.title}
            </h1>
            {storeName && (
              <Link
                href={`/store/${product.storeId}`}
                className="inline-block mt-2 text-sm text-foreground/70 hover:text-brand-gold-hover underline underline-offset-2"
              >
                Visit the {storeName} store
              </Link>
            )}
            {/* Rating row — driven by the reviews summary so a 0-review
                product doesn't show 5 filled stars. */}
            <RatingSummary productId={product.id} />
          </div>

          <hr className="border-gray-200" />

          {/* Price block — multi-seller compare/list-price is hidden until
              the marketplace supports it (backlog #44). */}
          <div>
            <div className="flex items-baseline gap-3">
              {discountPct != null && discountPct > 0 && (
                <span className="text-sm font-bold text-red-600">-{discountPct}%</span>
              )}
              <span className="text-3xl font-bold text-foreground">
                ${(displayPriceCents / 100).toFixed(2)}
              </span>
              {onSale && compareCents && compareCents > displayPriceCents && (
                <span className="text-sm text-gray-500 line-through">
                  ${(compareCents / 100).toFixed(2)}
                </span>
              )}
            </div>
            {productDeal?.badgeText && (
              <span className="inline-block mt-2 rounded bg-brand-gold/20 text-brand-gold-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-1">
                {productDeal.badgeText}
              </span>
            )}
          </div>

          <hr className="border-gray-200" />

          {/* Variant selectors — show the picker as soon as the seller defined
              real variants. A product with a single synthetic "Default"
              variant is hidden (the seller didn't add any options), but a
              single named variant like "Akure Yam" must still be visible so
              the buyer knows what they're buying. */}
          {(() => {
            const named = product.variants.filter((v) => (v.name ?? "").trim() && v.name.toLowerCase() !== "default")
            const showPicker = named.length >= 1 && variant
            if (!showPicker) return null
            return (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="text-gray-500">Option:</span>{" "}
                <span className="font-bold text-foreground">{variant.name || "Default"}</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                {named.map((v) => {
                  const active = variant.id === v.id
                  const oos = v.stockQuantity === 0
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => { setSelectedVariant(v); setQuantity(1) }}
                      disabled={oos}
                      className={cn(
                        "px-4 py-2 border-2 rounded-lg bg-white text-sm font-medium transition-all",
                        active
                          ? "border-brand-gold shadow-sm text-foreground"
                          : "border-gray-200 hover:border-gray-400 text-foreground",
                        oos && "opacity-50 line-through cursor-not-allowed",
                      )}
                    >
                      {v.name || v.sku} <span className="text-gray-500">(${v.price.toFixed(2)})</span>
                    </button>
                  )
                })}
              </div>
            </div>
            )
          })()}

          {/* Product details for the buyer. Pulls *display-safe* fields only:
              - product.attributes JSON, minus internal/logistics keys
                (weight, weightUnit, tags, dimensions, sku, etc.)
              - variant.options JSON (size, color, material, etc.)

              Explicitly NOT shown: variant.sku, variant.weightKg, variant
              parcel dimensions — those are seller/fulfillment-only fields. */}
          {(() => {
            const pairs: [string, string][] = []
            const INTERNAL_KEYS = new Set([
              "weight", "weightunit", "weight_unit",
              "tags", "sku", "barcode",
              "length", "width", "height", "dimensions",
              "lengthin", "widthin", "heightin",
              "weightkg", "weightlb",
            ])
            const humanize = (k: string) =>
              k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            const pushFromJson = (raw: string | null | undefined) => {
              if (!raw) return
              try {
                const parsed = JSON.parse(raw) as Record<string, unknown>
                for (const [k, v] of Object.entries(parsed)) {
                  if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue
                  if (INTERNAL_KEYS.has(k.toLowerCase())) continue
                  const value = Array.isArray(v) ? v.join(", ") : String(v)
                  pairs.push([humanize(k), value])
                }
              } catch { /* not JSON — ignore */ }
            }
            pushFromJson(product.attributes ?? null)
            if (variant) pushFromJson(variant.options ?? null)
            if (pairs.length === 0) return null
            return (
              <>
                <hr className="border-gray-200" />
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Details</h2>
                  <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
                    {pairs.map(([k, v], i) => (
                      <div key={`${k}-${i}`} className="contents">
                        <dt className="text-gray-500">{k}</dt>
                        <dd className="text-foreground">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </>
            )
          })()}

          {(lead || bullets.length > 0) && (
            <hr className="border-gray-200" />
          )}

          {/* About this item */}
          {(bullets.length > 0 || lead) && (
            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">About this item</h2>
              {bullets.length > 0 ? (
                <ul className="list-disc pl-5 space-y-2 text-sm text-foreground leading-relaxed">
                  {bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{lead}</p>
              )}
              {bullets.length > 0 && lead && (
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mt-4">{lead}</p>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Buy box (col-span-3 on lg) ─────────────────────── */}
        <aside className="lg:col-span-3">
          <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm lg:sticky lg:top-20 space-y-4">
            <p className="text-2xl font-bold text-foreground">
              ${(displayPriceCents / 100).toFixed(2)}
            </p>

            <p className="text-sm text-gray-600 flex items-start gap-1.5">
              <Truck className="h-4 w-4 mt-0.5 shrink-0 text-gray-500" />
              <span>FREE delivery <span className="font-bold text-foreground">in 3-5 business days</span></span>
            </p>

            <p className={cn("text-lg font-bold", stockBadge.tone)}>
              {stockBadge.label}
            </p>

            {/* Quantity */}
            {inStock && variant && (
              <div>
                <label htmlFor="quantity" className="sr-only">Quantity</label>
                {isInCart ? (
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(cartItem!.variantId, cartItem!.quantity - 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-white text-foreground transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      In cart: {cartItem!.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(cartItem!.variantId, Math.min(variant.stockQuantity, cartItem!.quantity + 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-white text-foreground transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <select
                    id="quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-foreground focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none"
                  >
                    {Array.from({ length: Math.min(10, variant.stockQuantity) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>Quantity: {n}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Primary CTAs */}
            <div className="space-y-2">
              {isInCart ? (
                <Link
                  href="/cart"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-gold hover:bg-brand-gold-hover py-3 text-sm font-bold text-brand-gold-foreground transition-colors"
                >
                  <ShoppingCart className="h-4 w-4" /> View Cart
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-gold hover:bg-brand-gold-hover py-3 text-sm font-bold text-brand-gold-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {inStock ? "Add to Cart" : "Out of Stock"}
                </button>
              )}
              {inStock && (
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-foreground hover:bg-foreground/85 py-3 text-sm font-bold text-white transition-colors"
                >
                  <Zap className="h-4 w-4" /> Buy Now
                </button>
              )}
              {isInCart && (
                <button
                  type="button"
                  onClick={() => removeItem(cartItem!.variantId)}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors py-1"
                >
                  <Trash2 className="h-3 w-3" /> Remove from cart
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Lock className="h-3.5 w-3.5" /> Secure transaction
            </div>

            <hr className="border-gray-200" />

            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <span className="text-gray-500">Ships from</span>
              <span className="text-foreground font-medium">AfroTransact</span>
              <span className="text-gray-500">Sold by</span>
              <Link
                href={`/store/${product.storeId}`}
                className="text-foreground font-medium hover:text-brand-gold-hover underline underline-offset-2 truncate"
              >
                {storeName || "Store"}
              </Link>
              <span className="text-gray-500">Delivery</span>
              <span className="text-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 text-gray-400" /> United States
              </span>
              {storeReturnsSupported && storeReturnWindowDays != null && (
                <>
                  <span className="text-gray-500">Returns</span>
                  <span className="text-foreground flex items-center gap-1">
                    <RotateCcw className="h-3 w-3 text-gray-400" />
                    {storeReturnWindowDays}-day returns from {storeName || "this store"}
                  </span>
                </>
              )}
            </div>

            <hr className="border-gray-200" />

            <button
              type="button"
              onClick={async () => {
                if (!product || !variant) return
                // For anonymous users we additionally keep the rich metadata
                // (title/image/price/store) in the local zustand store so the
                // /account/wishlist page can render it without an extra fetch.
                // Authenticated users get their wishlist hydrated from the
                // server by productId; the page fetches product details itself.
                const wasIn = wishlist.has(product.id)
                if (!wasIn) {
                  localWishlistAdd({
                    productId: product.id,
                    slug: product.slug,
                    title: product.title,
                    imageUrl: product.images[0]?.url,
                    priceCents: displayPriceCents,
                    storeName: storeName || null,
                  })
                } else {
                  localWishlistRemove(product.id)
                }
                const nowIn = await wishlist.toggle(product.id)
                toast.success(nowIn ? "Saved to wishlist" : "Removed from wishlist")
              }}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-semibold transition-colors",
                wishlisted
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-gray-200 bg-white text-foreground hover:bg-gray-50",
              )}
            >
              <Heart className={cn("h-4 w-4", wishlisted && "fill-current")} />
              {wishlisted ? "Saved to wishlist" : "Add to wishlist"}
            </button>
          </div>
        </aside>
      </div>

      {/* Reviews */}
      {product && reviewsEnabled && (
        <div id="reviews" className="mt-16 border-t border-gray-200 pt-12">
          <ProductReviews productId={product.id} />
        </div>
      )}
    </div>
  )
}

/**
 * Rating row matching the mockup: stars · "N ratings" link to #reviews.
 * Fetches just the lightweight summary (page=1, size=1) so the header
 * paints quickly and doesn't duplicate the full reviews fetch below.
 */
function RatingSummary({ productId }: { productId: string }) {
  const [avg, setAvg] = useState<number | null>(null)
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getProductReviews(productId, 1, 1)
        if (cancelled) return
        setAvg(res.avg_rating ?? 0)
        setCount(res.review_count ?? 0)
      } catch { /* silent — review service down shouldn't block PDP */ }
    })()
    return () => { cancelled = true }
  }, [productId])

  if (count == null) {
    // Loading — render a neutral placeholder so the header doesn't reflow.
    return <div className="mt-3 h-5 w-40 rounded bg-gray-100 animate-pulse" />
  }
  if (count === 0) {
    return (
      <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-xs text-gray-500 hover:text-foreground transition-colors">
        <span className="flex" aria-hidden>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="h-4 w-4 fill-gray-200 text-gray-200" />
          ))}
        </span>
        <span className="underline underline-offset-2">No reviews yet — be the first</span>
      </a>
    )
  }
  const filled = Math.round(avg ?? 0)
  return (
    <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-xs text-gray-600 hover:text-foreground transition-colors">
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn("h-4 w-4", i <= filled ? "fill-brand-gold text-brand-gold" : "fill-gray-200 text-gray-200")}
          />
        ))}
      </span>
      <span className="font-medium text-foreground">{(avg ?? 0).toFixed(1)}</span>
      <span className="text-gray-500">|</span>
      <span className="underline underline-offset-2">{count.toLocaleString()} {count === 1 ? "rating" : "ratings"}</span>
    </a>
  )
}
