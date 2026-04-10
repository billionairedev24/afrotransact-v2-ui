"use client"

import { useState, useCallback, useEffect, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
  Grid3X3,
  LayoutList,
  Search,
  ArrowUpDown,
  Loader2,
  Star,
  MapPin,
  ShoppingCart,
  Check,
  SlidersHorizontal,
  X,
  ChevronRight,
  Package,
  Store,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  searchProducts,
  getProductById,
  getRegions,
  getRegionFeatures,
  type SearchResponse,
  type SearchResult,
  type Region,
  type FeatureFlag,
} from "@/lib/api"
import { useCartStore } from "@/stores/cart-store"
import { toast } from "sonner"
import { RemoteImage } from "@/components/ui/remote-image"

const SORT_OPTIONS = [
  { value: "relevance", label: "Most Relevant" },
  { value: "distance", label: "Nearest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Highest Rated" },
  { value: "newest", label: "Newest" },
]

/* ─────────────────────────────── Sidebar ─────────────────────────────── */

function FilterSidebar({
  facets,
  category,
  minPrice,
  maxPrice,
  onCategoryChange,
  onPriceChange,
  onClearAll,
  hasActiveFilters,
}: {
  facets: SearchResponse["facets"]
  category: string
  minPrice: string
  maxPrice: string
  onCategoryChange: (key: string) => void
  onPriceChange: (min: string, max: string) => void
  onClearAll: () => void
  hasActiveFilters: boolean
}) {
  return (
    <div className="space-y-1">
      {hasActiveFilters && (
        <button
          onClick={onClearAll}
          className="mb-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          Clear all filters
        </button>
      )}

      {/* Categories */}
      {facets.categories.length > 0 && (
        <FilterSection title="Categories">
          <div className="flex flex-wrap gap-2">
            {facets.categories.map((f) => (
              <button
                key={f.key}
                onClick={() => onCategoryChange(f.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all",
                  category === f.key
                    ? "border-[#EAB308]/20 bg-[#EAB308]/10 text-[#EAB308]"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                {f.label || f.key}
                <span
                  className={cn(
                    "text-xs",
                    category === f.key ? "text-[#EAB308]/60" : "text-gray-400"
                  )}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Price Ranges */}
      {facets.price_ranges.length > 0 && (
        <FilterSection title="Price Range">
          <div className="flex flex-wrap gap-2">
            {facets.price_ranges.map((f) => {
              const [min, max] = f.key.split("-")
              const isActive = minPrice === min && (max ? maxPrice === max : !maxPrice)
              return (
                <button
                  key={f.key}
                  onClick={() =>
                    isActive ? onPriceChange("", "") : onPriceChange(min, max || "")
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all",
                    isActive
                      ? "border-[#EAB308]/20 bg-[#EAB308]/10 text-[#EAB308]"
                      : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  {f.label || `$${f.key}`}
                  <span
                    className={cn(
                      "text-xs",
                      isActive ? "text-[#EAB308]/60" : "text-gray-400"
                    )}
                  >
                    {f.count}
                  </span>
                </button>
              )
            })}
          </div>
        </FilterSection>
      )}

      {/* Ratings */}
      {facets.ratings.length > 0 && (
        <FilterSection title="Rating">
          <div className="space-y-2">
            {facets.ratings.map((f) => {
              const stars = parseInt(f.key, 10) || 0
              return (
                <button
                  key={f.key}
                  className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all"
                >
                  <span className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-3.5 w-3.5",
                          i < stars
                            ? "fill-[#EAB308] text-[#EAB308]"
                            : "fill-gray-200 text-gray-200"
                        )}
                      />
                    ))}
                    <span className="ml-1">& up</span>
                  </span>
                  <span className="text-xs text-gray-400">{f.count}</span>
                </button>
              )
            })}
          </div>
        </FilterSection>
      )}

      {/* Stores */}
      {facets.stores.length > 0 && (
        <FilterSection title="Stores">
          <div className="space-y-1.5">
            {facets.stores.map((f) => (
              <button
                key={f.key}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all"
              >
                <span className="flex items-center gap-2">
                  <Store className="h-3.5 w-3.5 text-gray-400" />
                  {f.label || f.key}
                </span>
                <span className="text-xs text-gray-400">{f.count}</span>
              </button>
            ))}
          </div>
        </FilterSection>
      )}
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
    <div className="border-b border-gray-100 pb-5 pt-5 first:pt-0 last:border-b-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
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
  category,
  minPrice,
  maxPrice,
  onCategoryChange,
  onPriceChange,
  onClearAll,
  hasActiveFilters,
}: {
  open: boolean
  onClose: () => void
  facets: SearchResponse["facets"]
  category: string
  minPrice: string
  maxPrice: string
  onCategoryChange: (key: string) => void
  onPriceChange: (min: string, max: string) => void
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
          "fixed inset-y-0 left-0 z-50 w-[320px] max-w-[85vw] bg-white shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <FilterSidebar
              facets={facets}
              category={category}
              minPrice={minPrice}
              maxPrice={maxPrice}
              onCategoryChange={(key) => {
                onCategoryChange(key)
                onClose()
              }}
              onPriceChange={(min, max) => {
                onPriceChange(min, max)
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
  const items = useCartStore((s) => s.items)
  const [loading, setLoading] = useState(false)

  const inCart = items.some((i) => i.productId === item.product_id)

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!item.in_stock || loading || inCart) return

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
      toast.success(`${product.title} added to cart`)
    } catch {
      toast.error("Could not add to cart")
    } finally {
      setLoading(false)
    }
  }

  if (!item.in_stock) {
    return (
      <button
        disabled
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2.5 text-xs font-medium text-gray-400 cursor-not-allowed"
      >
        Out of Stock
      </button>
    )
  }

  if (inCart) {
    return (
      <Link
        href="/cart"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-100 transition-colors"
      >
        <Check className="h-3.5 w-3.5" />
        In Cart
      </Link>
    )
  }

  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2.5 text-xs font-semibold text-white hover:bg-gray-800 transition-colors disabled:opacity-60"
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
  const slug = item.slug || item.product_id

  if (viewMode === "list") {
    return (
      <div className="group flex gap-4 rounded-2xl border border-gray-200 bg-white p-4 hover:border-[#EAB308]/30 hover:shadow-lg transition-all duration-200">
        <Link
          href={`/product/${slug}`}
          className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl bg-gray-100"
        >
          {item.image_url ? (
            <RemoteImage
              src={item.image_url}
              alt={item.title}
              fill
              sizes="128px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-8 w-8 text-gray-300" />
            </div>
          )}
        </Link>

        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            <Link href={`/product/${slug}`}>
              <h3 className="font-medium text-gray-900 group-hover:text-[#EAB308] transition-colors line-clamp-2">
                {item.title}
              </h3>
            </Link>
            {item.description && (
              <p className="mt-1 text-sm text-gray-500 line-clamp-1">
                {item.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3">
              <span className="text-lg font-bold text-gray-900">
                ${item.min_price.toFixed(2)}
              </span>
              {item.max_price > item.min_price && (
                <span className="text-sm text-gray-400">
                  – ${item.max_price.toFixed(2)}
                </span>
              )}
              {item.avg_rating > 0 && (
                <span className="flex items-center gap-1 text-sm">
                  <Star className="h-3.5 w-3.5 fill-[#EAB308] text-[#EAB308]" />
                  <span className="font-medium text-gray-900">
                    {item.avg_rating.toFixed(1)}
                  </span>
                  <span className="text-gray-400">({item.review_count})</span>
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-gray-500">{item.store_name}</span>
              {item.distance_miles != null && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
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

  return (
    <div className="group rounded-xl sm:rounded-2xl border border-gray-200 bg-white overflow-hidden hover:border-[#EAB308]/30 hover:shadow-lg transition-all duration-200">
      <Link href={`/product/${slug}`}>
        <div className="relative h-[120px] sm:h-auto sm:aspect-square overflow-hidden bg-gray-100">
          {item.image_url ? (
            <RemoteImage
              src={item.image_url}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300" />
            </div>
          )}
          {!item.in_stock && (
            <span className="absolute left-1.5 top-1.5 sm:left-3 sm:top-3 rounded-md bg-red-500 px-1.5 py-0.5 text-[9px] sm:text-[11px] font-bold text-white">
              Out of Stock
            </span>
          )}
        </div>
      </Link>

      <div className="p-2 sm:p-4 space-y-1 sm:space-y-2">
        <Link href={`/product/${slug}`}>
          <h3 className="text-[11px] sm:text-sm font-medium leading-snug text-gray-900 group-hover:text-[#EAB308] transition-colors line-clamp-2">
            {item.title}
          </h3>
        </Link>

        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-sm sm:text-base font-bold text-gray-900">
            ${item.min_price.toFixed(2)}
          </span>
          {item.max_price > item.min_price && (
            <span className="text-[10px] sm:text-xs text-gray-400">
              – ${item.max_price.toFixed(2)}
            </span>
          )}
        </div>

        {item.avg_rating > 0 && (
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-3 w-3",
                  i < Math.round(item.avg_rating)
                    ? "fill-[#EAB308] text-[#EAB308]"
                    : "fill-gray-200 text-gray-200"
                )}
              />
            ))}
            <span className="ml-1 text-xs text-gray-400">
              ({item.review_count})
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] sm:text-xs text-gray-500 truncate">
            {item.store_name}
          </span>
          {item.distance_miles != null && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium text-gray-500 shrink-0">
              <MapPin className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
              {item.distance_miles.toFixed(1)} mi
            </span>
          )}
        </div>

        <div className="pt-0.5 sm:pt-1 [&_button]:text-[11px] [&_button]:py-1.5 sm:[&_button]:text-sm sm:[&_button]:py-2">
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
  const [data, setData] = useState<SearchResponse | null>(null)
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [flagsLoaded, setFlagsLoaded] = useState(false)

  const marketplaceEnabled = flags.find((f) => f.key === "marketplace_enabled")?.enabled ?? true
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const query = searchParams.get("q") || ""
  const category = searchParams.get("category") || ""
  const sortBy = searchParams.get("sort") || "relevance"
  const minPrice = searchParams.get("min_price") || ""
  const maxPrice = searchParams.get("max_price") || ""
  const page = parseInt(searchParams.get("page") || "1", 10)

  const hasActiveFilters = !!(category || minPrice || maxPrice)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const regions = await getRegions("", true).catch(() => [])
        const r: Region | undefined = regions.find((r) => r.code === "us-tx-austin") ?? regions[0]
        if (!r || cancelled) return
        const f = await getRegionFeatures(r.id).catch(() => [])
        if (!cancelled) setFlags(f)
      } finally {
        if (!cancelled) setFlagsLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!flagsLoaded) return
    if (!marketplaceEnabled) return
    let cancelled = false
    setLoading(true)

    const params: Record<string, string> = {
      page: String(page),
      size: "12",
      sort_by: sortBy,
    }
    if (query) params.q = query
    if (category) params.category = category
    if (minPrice) params.min_price = minPrice
    if (maxPrice) params.max_price = maxPrice

    searchProducts(params)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch(() => {
        if (!cancelled)
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
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [query, category, sortBy, minPrice, maxPrice, page, flagsLoaded, marketplaceEnabled])

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
    updateParam("category", category === key ? "" : key)
  }

  function handlePriceChange(min: string, max: string) {
    updateMultipleParams({ min_price: min, max_price: max })
  }

  function handleClearAll() {
    updateMultipleParams({ category: "", min_price: "", max_price: "" })
  }

  const emptyFacets: SearchResponse["facets"] = {
    categories: [],
    price_ranges: [],
    ratings: [],
    stores: [],
  }
  const safeFacets = facets ?? emptyFacets
  const hasFacets =
    safeFacets.categories.length > 0 ||
    safeFacets.price_ranges.length > 0 ||
    safeFacets.ratings.length > 0 ||
    safeFacets.stores.length > 0

  if (!flagsLoaded) {
    return (
      <div className="container py-16 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-gray-500">Loading marketplace configuration…</p>
      </div>
    )
  }

  if (!marketplaceEnabled) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Marketplace not available</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          The marketplace is currently disabled for your region. Search is unavailable.
        </p>
        <Link href="/" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
          <span>Back to home</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-gray-400">
        <Link
          href="/"
          className="hover:text-gray-600 transition-colors"
        >
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 font-medium">
          {query ? "Search" : "Products"}
        </span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {query ? (
              <>
                Results for &ldquo;
                <span className="text-[#EAB308]">{query}</span>
                &rdquo;
              </>
            ) : (
              "All Products"
            )}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {loading
              ? "Searching..."
              : `${totalResults} ${totalResults === 1 ? "product" : "products"} found`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile filter button */}
          {hasFacets && (
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EAB308] text-[10px] font-bold text-white">
                  !
                </span>
              )}
            </button>
          )}

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => updateParam("sort", e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#EAB308]/30 focus:border-[#EAB308]/50"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ArrowUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          {/* View toggle */}
          <div className="hidden items-center rounded-xl border border-gray-200 bg-gray-50 p-1 sm:flex">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded-lg p-2 transition-colors",
                viewMode === "grid"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              )}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-lg p-2 transition-colors",
                viewMode === "list"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              )}
              aria-label="List view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* did_you_mean */}
      {data?.did_you_mean && (
        <p className="mb-6 text-sm text-gray-500">
          Did you mean{" "}
          <button
            onClick={() => updateParam("q", data.did_you_mean!)}
            className="font-medium text-[#EAB308] underline underline-offset-2 hover:text-[#CA9A06] transition-colors"
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
            <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-5">
              <FilterSidebar
                facets={safeFacets}
                category={category}
                minPrice={minPrice}
                maxPrice={maxPrice}
                onCategoryChange={handleCategoryChange}
                onPriceChange={handlePriceChange}
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
            category={category}
            minPrice={minPrice}
            maxPrice={maxPrice}
            onCategoryChange={handleCategoryChange}
            onPriceChange={handlePriceChange}
            onClearAll={handleClearAll}
            hasActiveFilters={hasActiveFilters}
          />
        )}

        {/* Results area */}
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="rounded-2xl bg-gray-50 p-6">
                <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
              </div>
              <p className="text-sm text-gray-400">Searching products...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="rounded-2xl bg-gray-50 p-6 mb-5">
                <Search className="h-10 w-10 text-gray-300" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No results found
              </h2>
              <p className="max-w-md text-gray-500">
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
              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-2 gap-2.5 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3"
                    : "flex flex-col gap-4"
                )}
              >
                {results.map((item) => (
                  <SearchResultCard
                    key={item.product_id}
                    item={item}
                    viewMode={viewMode}
                  />
                ))}
              </div>

              {/* Pagination */}
              {(() => {
                const pageSize = data?.page_size ?? 12
                const totalPages = Math.ceil(totalResults / pageSize)
                if (totalPages <= 1) return null

                const maxVisible = 5
                let startPage = Math.max(
                  1,
                  page - Math.floor(maxVisible / 2)
                )
                const endPage = Math.min(
                  totalPages,
                  startPage + maxVisible - 1
                )
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
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>

                    {startPage > 1 && (
                      <>
                        <button
                          onClick={() => updateParam("page", "1")}
                          className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          1
                        </button>
                        {startPage > 2 && (
                          <span className="px-1 text-sm text-gray-400">
                            &hellip;
                          </span>
                        )}
                      </>
                    )}

                    {pages.map((p) => (
                      <button
                        key={p}
                        onClick={() => updateParam("page", String(p))}
                        className={cn(
                          "h-10 w-10 rounded-xl text-sm font-medium transition-colors",
                          p === page
                            ? "bg-[#EAB308] text-white shadow-sm"
                            : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        )}
                      >
                        {p}
                      </button>
                    ))}

                    {endPage < totalPages && (
                      <>
                        {endPage < totalPages - 1 && (
                          <span className="px-1 text-sm text-gray-400">
                            &hellip;
                          </span>
                        )}
                        <button
                          onClick={() =>
                            updateParam("page", String(totalPages))
                          }
                          className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}

                    <button
                      disabled={page >= totalPages}
                      onClick={() => updateParam("page", String(page + 1))}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )
              })()}
            </>
          )}
        </div>
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
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#EAB308]" />
          <p className="text-sm text-gray-400">Loading search...</p>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  )
}
