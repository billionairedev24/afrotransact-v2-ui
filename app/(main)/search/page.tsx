"use client"

import { useState, useCallback, useEffect, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { SellOnAfrotransactStrip } from "@/components/landing/SellOnAfrotransactStrip"
import { PromoSlot } from "@/components/marketing/PromoSlot"
import {
  Grid3X3,
  LayoutList,
  Search,
  ArrowUpDown,
  Loader2,
  Star,
  MapPin,
  ShoppingCart,
  SlidersHorizontal,
  X,
  ChevronRight,
  Package,
  Store,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { friendlyMessage } from "@/lib/errors"
import { supportWhatsAppLink } from "@/lib/support-whatsapp"
import {
  searchProducts,
  getProductById,
  getCategories,
  type SearchResponse,
  type SearchResult,
  type CategoryRef,
} from "@/lib/api"
import { features } from "@/lib/features"
import { useCartStore } from "@/stores/cart-store"
import { useBuyerLocation } from "@/stores/buyer-location"
import { toast } from "sonner"
import { RemoteImage } from "@/components/ui/remote-image"
import { BrandProductCard, type BrandProductCardItem } from "@/components/products/BrandProductCard"
import { StarRating } from "@/components/products/StarRating"
import { Pagination } from "@/components/products/Pagination"

/** Adapt a SearchResult into the shared card model used by /search and /deals. */
function searchResultToCard(item: SearchResult): BrandProductCardItem {
  const original = item.max_price > item.min_price ? item.max_price : null
  return {
    productId: item.product_id,
    storeId: item.store_id,
    storeName: item.store_name,
    title: item.title,
    slug: item.slug || item.product_id,
    imageUrl: item.image_url,
    price: item.min_price,
    originalPrice: original,
    avgRating: item.avg_rating,
    reviewCount: item.review_count,
    inStock: item.in_stock,
    distanceMiles: item.distance_miles,
    beyondShipLimit: item.beyond_ship_limit === true,
  }
}

const SORT_OPTIONS = [
  { value: "relevance", label: "Most Relevant" },
  { value: "distance", label: "Nearest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Highest Rated" },
  { value: "newest", label: "Newest" },
]

/**
 * Filter row primitive used by Department + Customer Rating.
 *
 * Intentionally NOT a `<label>` — we don't want a click anywhere on the row
 * to trigger the radio. Only the radio circle itself selects, which matches
 * the standard Amazon facet UX and avoids the "wait, did that click?"
 * ambiguity when stars / text overlap other clickable elements (links,
 * counts, etc).
 *
 * The radio fires its own onChange when checked transitions; we never call
 * onSelect synthetically on re-render.
 */
/**
 * Renders as a native radio but is actually a button with role="radio".
 * Controlled `<input type="radio">` had two intermittent failure modes here:
 * a checked re-click never fired onChange (so picking "All" after URL was
 * already empty was a no-op), and React's controlled-state reconciliation
 * occasionally lost the visual checked state when the URL update happened
 * mid-render. Button + aria-checked sidesteps both — click always fires,
 * the visual state is pure CSS driven by `checked`, no edge cases.
 */
function FilterRadio({
  checked,
  onSelect,
  ariaLabel,
  children,
}: {
  checked: boolean
  onSelect: () => void
  name?: string
  ariaLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        aria-label={ariaLabel}
        onClick={onSelect}
        className={cn(
          "h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold",
          checked ? "border-brand-gold" : "border-border hover:border-border",
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-brand-gold" />}
      </button>
      {children}
    </div>
  )
}

/* ─────────────────────────────── Sidebar ─────────────────────────────── */

function FilterSidebar({
  facets,
  categoryList,
  category,
  minPrice,
  maxPrice,
  minRating,
  onCategoryChange,
  onPriceChange,
  onRatingChange,
  onClearRating,
  onClearAll,
  hasActiveFilters,
}: {
  facets: SearchResponse["facets"]
  categoryList: CategoryRef[]
  category: string
  minPrice: string
  maxPrice: string
  minRating: string
  onCategoryChange: (key: string) => void
  onPriceChange: (min: string, max: string) => void
  onRatingChange: (stars: number) => void
  onClearRating: () => void
  onClearAll: () => void
  hasActiveFilters: boolean
}) {
  return (
    <div className="space-y-1">
      {hasActiveFilters && (
        <button
          onClick={onClearAll}
          className="mb-4 w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          Clear all filters
        </button>
      )}

      {/* Categories — always render the full canonical list (radio-style,
          since the backend supports a single category filter). Facet counts
          from the current search response are shown when available; absent
          counts don't hide the option, so the list never reshuffles or
          loses items when you pick one (which was the prior bug). */}
      {categoryList.length > 0 && (
        <FilterSection title="Department">
          <div className="flex flex-col gap-2">
            <FilterRadio
              checked={!category}
              onSelect={() => onCategoryChange("")}
              name="category"
              ariaLabel="All categories"
            >
              <span className="flex-1 text-sm text-foreground">All</span>
            </FilterRadio>
            {categoryList.map((c) => {
              // Match the active filter against either the canonical slug or
              // the lowercased name — the backend accepts both, and a category
              // arriving via header search vs. sidebar click can land here in
              // either form.
              const lcName = c.name.toLowerCase()
              const active = category === c.slug || category === lcName
              const facet = facets.categories.find(
                (f) => f.key === c.slug || f.key === lcName
              )
              return (
                <FilterRadio
                  key={c.id}
                  checked={active}
                  onSelect={() => onCategoryChange(c.slug)}
                  name="category"
                  ariaLabel={c.name}
                >
                  <span className="flex-1 text-sm text-foreground">{c.name}</span>
                  {facet && (
                    <span className="text-xs text-muted-foreground">({facet.count})</span>
                  )}
                </FilterRadio>
              )
            })}
          </div>
        </FilterSection>
      )}

      {/* Price Range — mockup all-products.html lines 174-190, min/max + Apply.
          Custom inputs feed onPriceChange directly; the API expects strings.
          Preset facet pills remain below for quick selection. */}
      <FilterSection title="Price Range">
        <PriceRangeInput
          minPrice={minPrice}
          maxPrice={maxPrice}
          onPriceChange={onPriceChange}
        />
        {facets.price_ranges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {facets.price_ranges.map((f) => {
              // Buckets come from the backend in two shapes:
              //   "10-25"  → min=10, max=25
              //   "100+"   → min=100, max="" (open-ended upper bound)
              // The "+" is presentational only; the search API expects a
              // plain number for min_price/max_price, so we must strip it
              // before sending or 422.
              let min: string
              let max: string
              if (f.key.endsWith("+")) {
                min = f.key.slice(0, -1)
                max = ""
              } else {
                const [lo, hi] = f.key.split("-")
                min = lo
                max = hi ?? ""
              }
              const isActive = minPrice === min && (max ? maxPrice === max : !maxPrice)
              return (
                <button
                  key={f.key}
                  onClick={() =>
                    isActive ? onPriceChange("", "") : onPriceChange(min, max)
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all",
                    isActive
                      ? "border-brand-gold bg-brand-gold/10 text-foreground"
                      : "border-border bg-muted text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {f.label || `$${f.key}`}
                  <span className="text-[10px] text-muted-foreground">({f.count})</span>
                </button>
              )
            })}
          </div>
        )}
      </FilterSection>

      {/* Customer Rating — 1-5 stars always rendered; only the radio circle
          is clickable, text + stars are decorative so accidental clicks on
          the row don't toggle the filter. */}
      <FilterSection title="Customer Rating">
        <div className="flex flex-col gap-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const facet = facets.ratings.find((f) => parseInt(f.key, 10) === stars)
            const checked = minRating === String(stars)
            return (
              <FilterRadio
                key={stars}
                checked={checked}
                onSelect={() => onRatingChange(stars)}
                name="rating"
                ariaLabel={`${stars} stars and up`}
              >
                <StarRating rating={stars} size="md" />
                <span className="text-sm text-foreground">&amp; Up</span>
                {facet && (
                  <span className="ml-auto text-xs text-muted-foreground">({facet.count})</span>
                )}
              </FilterRadio>
            )
          })}
        </div>
      </FilterSection>
      {minRating && (
        <button
          onClick={onClearRating}
          className="text-xs text-muted-foreground hover:text-foreground underline -mt-2 ml-2"
        >
          Clear rating filter
        </button>
      )}

      {/* Single-seller: no Stores facet — the catalog is first-party. */}
    </div>
  )
}

function PriceRangeInput({
  minPrice,
  maxPrice,
  onPriceChange,
}: {
  minPrice: string
  maxPrice: string
  onPriceChange: (min: string, max: string) => void
}) {
  const [localMin, setLocalMin] = useState(minPrice)
  const [localMax, setLocalMax] = useState(maxPrice)
  useEffect(() => { setLocalMin(minPrice) }, [minPrice])
  useEffect(() => { setLocalMax(maxPrice) }, [maxPrice])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="Min"
            value={localMin}
            onChange={(e) => setLocalMin(e.target.value)}
            className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold"
          />
        </div>
        <span className="text-muted-foreground">-</span>
        <div className="relative flex-1">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="Max"
            value={localMax}
            onChange={(e) => setLocalMax(e.target.value)}
            className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => onPriceChange(localMin, localMax)}
        className="w-full py-1.5 rounded-lg bg-muted text-foreground text-xs font-semibold uppercase tracking-wider hover:bg-muted transition-colors border border-border"
      >
        Apply
      </button>
    </div>
  )
}

function FilterSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-border pb-5 pt-5 first:pt-0 last:border-b-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}

/* ────────────────────────── Mobile Filter Panel ─────────────────────── */

function MobileFilterPanel({
  open,
  onClose,
  facets,
  categoryList,
  category,
  minPrice,
  maxPrice,
  minRating,
  onCategoryChange,
  onPriceChange,
  onRatingChange,
  onClearRating,
  onClearAll,
  hasActiveFilters,
}: {
  open: boolean
  onClose: () => void
  facets: SearchResponse["facets"]
  categoryList: CategoryRef[]
  category: string
  minPrice: string
  maxPrice: string
  minRating: string
  onCategoryChange: (key: string) => void
  onPriceChange: (min: string, max: string) => void
  onRatingChange: (stars: number) => void
  onClearRating: () => void
  onClearAll: () => void
  hasActiveFilters: boolean
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[320px] max-w-[85vw] bg-card shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">Filters</h2>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <FilterSidebar
              facets={facets}
              categoryList={categoryList}
              category={category}
              minPrice={minPrice}
              maxPrice={maxPrice}
              minRating={minRating}
              onCategoryChange={(key) => {
                onCategoryChange(key)
                onClose()
              }}
              onPriceChange={(min, max) => {
                onPriceChange(min, max)
                onClose()
              }}
              onRatingChange={(stars) => {
                onRatingChange(stars)
                onClose()
              }}
              onClearRating={() => {
                onClearRating()
                onClose()
              }}
              onClearAll={() => {
                onClearAll()
                onClose()
              }}
              hasActiveFilters={hasActiveFilters}
            />
          </div>
        </div>
      </div>
    </>
  )
}

/* ─────────────────────────── Add to Cart Button ─────────────────────── */

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
      if (!variant) {
        toast.error("This product has no purchasable variant yet")
        return
      }
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
      <button
        disabled
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-muted px-3 py-2.5 text-xs font-medium text-muted-foreground cursor-not-allowed"
      >
        Out of Stock
      </button>
    )
  }

  // Beyond the configured shipping-distance limit — swap CTA for a support link.
  if (item.beyond_ship_limit) {
    const href = supportWhatsAppLink(`Hi AfroTransact, I'd like to order "${item.title}" but I'm outside your usual delivery range. Can you help?`)
    if (href) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex w-full items-center justify-center gap-1.5 rounded-full border border-amber-500/60 bg-amber-50 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-800 hover:bg-amber-100 transition-colors"
        >
          Chat about shipping
        </a>
      )
    }
  }

  if (quantity > 0) {
    return (
      <div
        onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
        className="flex w-full items-center justify-between rounded-full bg-brand-gold px-1 py-0.5"
      >
        <button
          onClick={(e) => handleChange(e, -1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#0f0f10] font-black text-base hover:bg-black/10 transition-colors"
        >
          −
        </button>
        <span className="text-sm font-black text-[#0f0f10] tabular-nums">{quantity}</span>
        <button
          onClick={(e) => handleChange(e, +1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#0f0f10] font-black text-base hover:bg-black/10 transition-colors"
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
      className="flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-gold px-3 py-2.5 text-xs font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ShoppingCart className="h-3.5 w-3.5" />
      )}
      Add to Cart
    </button>
  )
}

/* ──────────────────────── Search Result Cards ───────────────────────── */

function SearchResultCard({
  item,
  viewMode,
}: {
  item: SearchResult
  viewMode: "grid" | "list"
}) {
  // Phase 9.6b — when this hit represents a collapsed catalog-item group
  // (offer_count > 1, or any hit with catalog_item_id distinct from
  // product_id), route to the catalog PDP at /p/[slug] so the buyer sees
  // the Buy Box + other sellers view. Legacy single-offer hits keep
  // pointing at the offer-level PDP.
  const isCatalogGrouped =
    !!item.catalog_item_id &&
    (item.offer_count ?? 1) > 0 &&
    item.catalog_item_id !== item.product_id
  const slug = item.slug || item.product_id
  // The slug indexed today is the offer slug (catalog.products.slug). The
  // catalog item's own slug is what /p/[slug] expects. Until we index
  // catalog_item_slug separately (next iteration), route grouped hits
  // via the catalog item id; legacy single hits keep using the slug.
  const href = isCatalogGrouped
    ? `/p/by-id/${item.catalog_item_id}`
    : `/product/${slug}`

  if (viewMode === "list") {
    return (
      <div className="group flex gap-4 rounded-2xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-lg transition-all duration-200">
        <Link
          href={`${href}`}
          className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl bg-muted"
        >
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt={item.title}
              fill
              sizes="128px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground/40" />
            </div>
          )}
        </Link>

        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            <Link href={`${href}`}>
              <h3 className="font-medium text-foreground group-hover:text-foreground transition-colors line-clamp-2">
                {item.title}
              </h3>
            </Link>
            {item.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                {item.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3">
              <span className="text-lg font-bold text-foreground">
                ${item.min_price.toFixed(2)}
              </span>
              {item.max_price > item.min_price && (
                <span className="text-sm text-muted-foreground">
                  – ${item.max_price.toFixed(2)}
                </span>
              )}
              {item.avg_rating > 0 && (
                <span className="flex items-center gap-1 text-sm">
                  <Star className="h-3.5 w-3.5 fill-brand-gold text-brand-gold" />
                  <span className="font-medium text-foreground">
                    {item.avg_rating.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">({item.review_count})</span>
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{item.store_name}</span>
              {item.distance_miles != null && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <MapPin className="h-2.5 w-2.5" />
                  {item.distance_miles.toFixed(1)} mi
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 max-w-[180px]">
            <AddToCartButton item={item} />
          </div>
        </div>
      </div>
    )
  }

  // Grid card — mockup all-products.html lines 235-256
  return (
    <div className="group bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <Link href={`${href}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
          {!item.in_stock && (
            <span className="absolute left-3 top-3 rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              Out of Stock
            </span>
          )}
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1 gap-2">
        <Link href={`${href}`}>
          <h3 className="text-sm font-medium leading-tight text-foreground line-clamp-2 hover:text-brand-gold-hover transition-colors">
            {item.title}
          </h3>
        </Link>

        {item.avg_rating > 0 && (
          <div className="mt-auto">
            <StarRating rating={item.avg_rating} count={item.review_count} size="md" />
          </div>
        )}

        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-xl font-bold text-foreground">
            ${item.min_price.toFixed(2)}
          </span>
          {item.max_price > item.min_price && (
            <span className="text-xs text-muted-foreground">
              – ${item.max_price.toFixed(2)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-1">
          <span className="text-xs text-muted-foreground truncate">{item.store_name}</span>
          {item.distance_miles != null && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
              <MapPin className="h-2.5 w-2.5" />
              {item.distance_miles.toFixed(1)} mi
            </span>
          )}
        </div>

        <div className="pt-1">
          <AddToCartButton item={item} />
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────── Main Content ───────────────────────────── */

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SearchResponse | null>(null)
  const [categoryList, setCategoryList] = useState<CategoryRef[]>([])

  const marketplaceEnabled = features.marketplaceEnabled()
  const flagsLoaded = true
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const query = searchParams.get("q") || ""
  const category = searchParams.get("category") || ""
  const sortBy = searchParams.get("sort") || "relevance"
  const minPrice = searchParams.get("min_price") || ""
  const maxPrice = searchParams.get("max_price") || ""
  const minRating = searchParams.get("min_rating") || ""
  const page = parseInt(searchParams.get("page") || "1", 10)

  // Buyer Deliver-to location → geo-decorated results (distance + shipping-limit
  // flag). Backend as of baa1d8c1 returns products from every supported area
  // when radius is omitted, sorted closest-first. lat/lon stay in the request
  // even when no radius is chosen — that's what unlocks distance and the
  // beyond_ship_limit flag on cards from farther zones.
  const buyerLocation = useBuyerLocation((s) => s.location)
  const urlLat = searchParams.get("lat")
  const urlLon = searchParams.get("lon")
  const urlRadius = searchParams.get("radius")
  const effectiveLat =
    urlLat != null ? parseFloat(urlLat) : (buyerLocation?.lat ?? null)
  const effectiveLon =
    urlLon != null ? parseFloat(urlLon) : (buyerLocation?.lng ?? null)
  const hasGeo =
    typeof effectiveLat === "number" &&
    !Number.isNaN(effectiveLat) &&
    typeof effectiveLon === "number" &&
    !Number.isNaN(effectiveLon)
  // Selected radius. Default now = "all" (empty) → backend returns products
  // from every supported area, closest-first. "any" is kept as a legacy alias
  // for the same "no hard radius filter" behavior so shared links still work.
  const numericRadius =
    urlRadius && urlRadius !== "all" && urlRadius !== "any" ? urlRadius : null
  const radiusSelectValue = numericRadius ?? "all"

  const hasActiveFilters = !!(category || minPrice || maxPrice || minRating)

  useEffect(() => {
    // No-op kept so the dependency chain below doesn't gain a region race.
    // Feature flags now come from build-time NEXT_PUBLIC_FEATURE_* env vars.
    let cancelled = false
    return () => { cancelled = true }
  }, [])

  // Canonical category list. Fetched once and rendered in the sidebar
  // unconditionally so picking a filter never makes other options vanish
  // (the buckets in facets.categories shrink as you filter — that was the
  // "options disappear" bug).
  useEffect(() => {
    let cancelled = false
    getCategories()
      .then((cats) => {
        if (cancelled) return
        setCategoryList(cats.filter((c) => !c.parentId && c.slug !== "services"))
      })
      .catch(() => { /* non-fatal */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!flagsLoaded) return
    if (!marketplaceEnabled) return
    let cancelled = false
    setLoading(true)
    setError(null)

    const params: Record<string, string> = {
      page: String(page),
      size: "12",
      sort_by: sortBy,
    }
    if (query) params.q = query
    if (category) {
      // The URL keeps a clean slug, but ES historically indexed only the
      // lowercased name on `categories` (the `category_slugs` field is only
      // populated for documents indexed after that change shipped). Sending
      // the name when we can resolve it lets older documents match while the
      // backend's OR-filter still catches new ones via the slug field.
      const matched = categoryList.find((c) => c.slug === category)
      params.category = matched ? matched.name.toLowerCase() : category
    }
    if (minPrice) params.min_price = minPrice
    if (maxPrice) params.max_price = maxPrice
    if (minRating) params.min_rating = minRating
    if (hasGeo) {
      // ES service uses `lon` (not `lng`); buyer-location store uses `lng`.
      params.lat = String(effectiveLat)
      params.lon = String(effectiveLon)
      // Only send `radius` when the buyer picked a numeric one. Omitting it
      // triggers the backend's "all supported areas, closest-first" behavior
      // and lets it flag distant results as beyond_ship_limit.
      if (numericRadius) params.radius = numericRadius
    }

    searchProducts(params)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (!cancelled) {
          // Never surface raw API strings (URLs/status) to shoppers.
          setError(friendlyMessage(err, "We couldn't load results. Please try again."))
          setData({
            results: [],
            total: 0,
            page: 1,
            page_size: 12,
            facets: {
              categories: [],
              price_ranges: [],
              ratings: [],
              stores: [],
            },
            did_you_mean: null,
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [query, category, sortBy, minPrice, maxPrice, minRating, page, flagsLoaded, marketplaceEnabled, categoryList, hasGeo, effectiveLat, effectiveLon, numericRadius])

  const results = data?.results ?? []
  const totalResults = data?.total ?? 0
  const facets = data?.facets

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      if (key !== "page") params.delete("page")
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const updateMultipleParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  function handleCategoryChange(key: string) {
    // Radio semantics — clicking a category always sets it, even if the same
    // value (handler is only fired by a real input change). The "All" radio
    // sends "" which clears the URL param.
    updateParam("category", key)
  }

  function handlePriceChange(min: string, max: string) {
    updateMultipleParams({ min_price: min, max_price: max })
  }

  function handleClearAll() {
    updateMultipleParams({ category: "", min_price: "", max_price: "", min_rating: "" })
  }

  function handleRatingChange(stars: number) {
    updateParam("min_rating", String(stars))
  }
  function handleClearRating() {
    updateParam("min_rating", "")
  }

  const emptyFacets: SearchResponse["facets"] = {
    categories: [],
    price_ranges: [],
    ratings: [],
    stores: [],
  }
  const safeFacets = facets ?? emptyFacets
  // Sidebar should appear whenever there's anything to filter against — the
  // canonical category list counts even when the current result set produces
  // no facet buckets (e.g. a query that hit zero results).
  const hasFacets =
    categoryList.length > 0 ||
    safeFacets.categories.length > 0 ||
    safeFacets.price_ranges.length > 0 ||
    safeFacets.ratings.length > 0 ||
    safeFacets.stores.length > 0

  if (!flagsLoaded) {
    return (
      <div className="container py-16 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
        <p className="text-sm text-muted-foreground">Loading marketplace configuration…</p>
      </div>
    )
  }

  if (!marketplaceEnabled) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">Marketplace not available</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          The marketplace is currently disabled for your region. Search is unavailable.
        </p>
        <Link href="/" className="mt-4 inline-flex items-center gap-2 text-foreground hover:underline">
          <span>Back to home</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/"
          className="hover:text-muted-foreground transition-colors"
        >
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">
          {query ? "Search" : "Products"}
        </span>
      </nav>

      {/* Header — title in foreground; the query term keeps a readable
          deep-gold accent (brand-gold-ink), never #FFD400 on white. */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            {query ? (
              <>
                Results for &ldquo;
                <span className="text-brand-gold-ink">{query}</span>
                &rdquo;
              </>
            ) : (
              "All Products"
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Searching..."
              : `${totalResults} ${totalResults === 1 ? "item" : "items"} found`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile filter button */}
          {hasFacets && (
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-gold text-[10px] font-bold text-brand-gold-foreground">
                  !
                </span>
              )}
            </button>
          )}

          {/* Distance radius. Default = "All areas" (no radius param sent) so
              the backend returns products from every supported area sorted
              closest-first. Picking a numeric radius hard-filters to that
              distance. lat/lon are always sent when the buyer has a location. */}
          {(buyerLocation?.lat != null && buyerLocation?.lng != null) && (
            <div className="relative flex items-center gap-2">
              <label htmlFor="radius-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:inline">
                Within:
              </label>
              <select
                id="radius-select"
                value={radiusSelectValue}
                onChange={(e) => {
                  const v = e.target.value
                  const params = new URLSearchParams(searchParams.toString())
                  if (v === "all") {
                    // Omit the radius param entirely — backend returns all supported areas.
                    params.delete("radius")
                  } else {
                    params.set("radius", v)
                  }
                  params.delete("page")
                  router.push(`${pathname}?${params.toString()}`)
                }}
                className="appearance-none rounded-lg border border-border bg-card px-3 py-1.5 pr-7 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold"
              >
                <option value="all">All areas</option>
                <option value="10">10 mi</option>
                <option value="25">25 mi</option>
                <option value="50">50 mi</option>
                <option value="100">100 mi</option>
                <option value="250">250 mi</option>
              </select>
            </div>
          )}

          {/* Sort */}
          <div className="relative flex items-center gap-2">
            <label htmlFor="sort-by" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:inline">
              Sort by:
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => updateParam("sort", e.target.value)}
              className="appearance-none rounded-lg border border-border bg-card px-3 py-1.5 pr-9 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ArrowUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* View toggle — mockup all-products.html lines 134-141 */}
          <div className="hidden items-center rounded-lg bg-muted p-1 sm:flex">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded p-1.5 transition-colors",
                viewMode === "grid"
                  ? "bg-brand-gold text-brand-gold-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded p-1.5 transition-colors",
                viewMode === "list"
                  ? "bg-brand-gold text-brand-gold-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="List view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Promotions strip (admin-managed) */}
      <PromoSlot placement="STRIP_TOP" className="mb-6" />

      {/* did_you_mean */}
      {data?.did_you_mean && (
        <p className="mb-6 text-sm text-muted-foreground">
          Did you mean{" "}
          <button
            onClick={() => updateParam("q", data.did_you_mean!)}
            className="font-medium text-foreground underline underline-offset-2 hover:text-[#CA9A06] transition-colors"
          >
            {data.did_you_mean}
          </button>
          ?
        </p>
      )}

      {/* Main layout */}
      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        {hasFacets && (
          <aside className="hidden w-[280px] shrink-0 lg:block">
            <div className="sticky top-24 rounded-2xl border border-border bg-card p-5">
              <FilterSidebar
                facets={safeFacets}
                categoryList={categoryList}
                category={category}
                minPrice={minPrice}
                maxPrice={maxPrice}
                minRating={minRating}
                onCategoryChange={handleCategoryChange}
                onPriceChange={handlePriceChange}
                onRatingChange={handleRatingChange}
                onClearRating={handleClearRating}
                onClearAll={handleClearAll}
                hasActiveFilters={hasActiveFilters}
              />
            </div>
          </aside>
        )}

        {/* Mobile filter panel */}
        {hasFacets && (
          <MobileFilterPanel
            open={mobileFiltersOpen}
            onClose={() => setMobileFiltersOpen(false)}
            facets={safeFacets}
            categoryList={categoryList}
            category={category}
            minPrice={minPrice}
            maxPrice={maxPrice}
            minRating={minRating}
            onCategoryChange={handleCategoryChange}
            onPriceChange={handlePriceChange}
            onRatingChange={handleRatingChange}
            onClearRating={handleClearRating}
            onClearAll={handleClearAll}
            hasActiveFilters={hasActiveFilters}
          />
        )}

        {/* Results area */}
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="rounded-2xl bg-muted p-6">
                <Loader2 className="h-8 w-8 animate-spin text-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Searching products...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="rounded-2xl bg-red-50 p-6 mb-5 border border-red-100">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="rounded-2xl bg-muted p-6 mb-5">
                <Search className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No results found
              </h2>
              <p className="max-w-md text-muted-foreground">
                {query
                  ? `We couldn\u2019t find anything for \u201c${query}\u201d. Try adjusting your search or filters.`
                  : "No products match your current filters. Try removing some filters."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={handleClearAll}
                  className="mt-4 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Beyond-ship-range banner: when the buyer has geo AND every
                  visible result is beyond the configured shipping-distance
                  limit, we don't have a close-by seller. Route them straight
                  to support so we can arrange shipping instead of leaving
                  them to click each "Chat about shipping" pill individually. */}
              {hasGeo && results.length > 0 && results.every((r) => r.beyond_ship_limit === true) && (() => {
                const href = supportWhatsAppLink(`Hi AfroTransact, I searched for "${query || "products"}" but there are no sellers near me. Can you help arrange shipping?`)
                if (!href) return null
                return (
                  <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <div className="flex-1">
                      <p className="font-semibold">No sellers close to you for this.</p>
                      <p className="text-amber-800/90 mt-0.5">
                        We can still get it to you — chat with support and we&apos;ll arrange shipping.
                      </p>
                    </div>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-amber-900 transition-colors"
                    >
                      Chat support
                    </a>
                  </div>
                )
              })()}

              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                    : "flex flex-col gap-4"
                )}
              >
                {results.map((item) =>
                  viewMode === "grid" ? (
                    <BrandProductCard key={item.product_id} item={searchResultToCard(item)} />
                  ) : (
                    <SearchResultCard key={item.product_id} item={item} viewMode={viewMode} />
                  ),
                )}
              </div>

              {/* Pagination — replaced with shared component below. Kept the
                  inline tree commented out for one revision so a diff reviewer
                  can confirm the swap; remove on next sweep. */}
              {(() => {
                const pageSize = data?.page_size ?? 12
                const totalPages = Math.ceil(totalResults / pageSize)
                return (
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={(p) => updateParam("page", String(p))}
                  />
                )
              })()}

              {/* LEGACY pagination markup retained briefly — DO NOT render. */}
              {false && (() => {
                const pageSize = data?.page_size ?? 12
                const totalPages = Math.ceil(totalResults / pageSize)
                if (totalPages <= 1) return null
                const maxVisible = 5
                let startPage = Math.max(1, page - Math.floor(maxVisible / 2))
                const endPage = Math.min(totalPages, startPage + maxVisible - 1)
                if (endPage - startPage + 1 < maxVisible) {
                  startPage = Math.max(1, endPage - maxVisible + 1)
                }
                const pages: number[] = []
                for (let i = startPage; i <= endPage; i++) pages.push(i)
                return (
                  <div className="mt-10 flex items-center justify-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => updateParam("page", String(page - 1))}
                      className="h-10 w-10 rounded-lg flex items-center justify-center border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Previous page"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                    </button>

                    {startPage > 1 && (
                      <>
                        <button
                          onClick={() => updateParam("page", "1")}
                          className="h-10 w-10 rounded-lg border border-border bg-card text-sm font-semibold text-foreground hover:border-brand-gold hover:text-brand-gold-foreground transition-colors"
                        >
                          1
                        </button>
                        {startPage > 2 && (
                          <span className="px-1 text-sm text-muted-foreground">&hellip;</span>
                        )}
                      </>
                    )}

                    {pages.map((p) => (
                      <button
                        key={p}
                        onClick={() => updateParam("page", String(p))}
                        className={cn(
                          "h-10 w-10 rounded-lg text-sm font-semibold transition-colors",
                          p === page
                            ? "bg-brand-gold text-brand-gold-foreground shadow-sm"
                            : "border border-border bg-card text-foreground hover:border-brand-gold hover:bg-muted"
                        )}
                      >
                        {p}
                      </button>
                    ))}

                    {endPage < totalPages && (
                      <>
                        {endPage < totalPages - 1 && (
                          <span className="px-1 text-sm text-muted-foreground">&hellip;</span>
                        )}
                        <button
                          onClick={() => updateParam("page", String(totalPages))}
                          className="h-10 w-10 rounded-lg border border-border bg-card text-sm font-semibold text-foreground hover:border-brand-gold hover:text-brand-gold-foreground transition-colors"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}

                    <button
                      disabled={page >= totalPages}
                      onClick={() => updateParam("page", String(page + 1))}
                      className="h-10 w-10 rounded-lg flex items-center justify-center border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>

      {/* Sell CTA — strategic placement: high-intent shoppers are also
          potential sellers. Auto-hides for admin + seller via the gate. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <SellOnAfrotransactStrip />
      </div>
    </div>
  )
}

/* ─────────────────────────── Page Export ─────────────────────────────── */

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-foreground" />
          <p className="text-sm text-muted-foreground">Loading search...</p>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  )
}
