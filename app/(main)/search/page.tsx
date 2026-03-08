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
  Leaf,
  ShoppingCart,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { searchProducts, getProductById, type SearchResponse, type SearchResult } from "@/lib/api"
import { useCartStore } from "@/stores/cart-store"
import { toast } from "sonner"

const SORT_OPTIONS = [
  { value: "relevance", label: "Most Relevant" },
  { value: "distance", label: "Nearest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Highest Rated" },
  { value: "newest", label: "Newest" },
]

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SearchResponse | null>(null)

  const query = searchParams.get("q") || ""
  const category = searchParams.get("category") || ""
  const sortBy = searchParams.get("sort") || "relevance"
  const minPrice = searchParams.get("min_price") || ""
  const maxPrice = searchParams.get("max_price") || ""
  const page = parseInt(searchParams.get("page") || "1", 10)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const params: Record<string, string> = { page: String(page), size: "12", sort_by: sortBy }
    if (query) params.q = query
    if (category) params.category = category
    if (minPrice) params.min_price = minPrice
    if (maxPrice) params.max_price = maxPrice

    searchProducts(params)
      .then((res) => { if (!cancelled) setData(res) })
      .catch(() => { if (!cancelled) setData({ results: [], total: 0, page: 1, page_size: 12, facets: { categories: [], price_ranges: [], ratings: [], stores: [] }, did_you_mean: null }) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [query, category, sortBy, minPrice, maxPrice, page])

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
    [searchParams, router, pathname],
  )

  return (
    <div className="container py-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <span className="text-foreground">Search</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {query ? (
                <>Results for &ldquo;<span className="text-primary">{query}</span>&rdquo;</>
              ) : (
                "All Products"
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? "Searching..." : `${totalResults} ${totalResults === 1 ? "product" : "products"} found`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => updateParam("sort", e.target.value)}
                className="appearance-none rounded-md border border-border bg-card px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ArrowUpDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>

            <div className="hidden sm:flex items-center border border-border rounded-md">
              <button
                onClick={() => setViewMode("grid")}
                className={cn("p-2 transition-colors", viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                aria-label="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn("p-2 transition-colors", viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                aria-label="List view"
              >
                <LayoutList className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar facets */}
        {facets && (facets.categories.length > 0 || facets.price_ranges.length > 0) && (
          <aside className="hidden lg:block w-[250px] shrink-0 space-y-6">
            {facets.categories.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Category</h3>
                <div className="space-y-1">
                  {facets.categories.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => updateParam("category", category === f.key ? "" : f.key)}
                      className={cn(
                        "flex items-center justify-between w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors",
                        category === f.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <span>{f.label || f.key}</span>
                      <span className="text-xs opacity-60">{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {facets.price_ranges.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Price</h3>
                <div className="space-y-1">
                  {facets.price_ranges.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => {
                        const [min, max] = f.key.split("-")
                        updateParam("min_price", minPrice === min ? "" : min)
                        if (max) updateParam("max_price", maxPrice === max ? "" : max)
                      }}
                      className="flex items-center justify-between w-full text-left rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <span>{f.label || `$${f.key}`}</span>
                      <span className="text-xs opacity-60">{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Results area */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">No results found</h2>
              <p className="text-muted-foreground max-w-md">
                {query
                  ? `We couldn\u2019t find anything for \u201c${query}\u201d. Try adjusting your search terms.`
                  : "No products match your current filters."}
              </p>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                    : "flex flex-col gap-3"
                )}
              >
                {results.map((item) => (
                  <SearchResultCard key={item.product_id} item={item} viewMode={viewMode} />
                ))}
              </div>

              {(() => {
                const pageSize = data?.page_size ?? 20
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
                  <div className="mt-8 flex items-center justify-center gap-1.5">
                    <button
                      disabled={page <= 1}
                      onClick={() => updateParam("page", String(page - 1))}
                      className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>

                    {startPage > 1 && (
                      <>
                        <button
                          onClick={() => updateParam("page", "1")}
                          className="rounded-md border border-border bg-card h-9 w-9 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                        >
                          1
                        </button>
                        {startPage > 2 && <span className="px-1 text-sm text-muted-foreground">…</span>}
                      </>
                    )}

                    {pages.map((p) => (
                      <button
                        key={p}
                        onClick={() => updateParam("page", String(p))}
                        className={cn(
                          "rounded-md h-9 w-9 text-sm font-medium transition-colors",
                          p === page
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card text-foreground hover:bg-muted"
                        )}
                      >
                        {p}
                      </button>
                    ))}

                    {endPage < totalPages && (
                      <>
                        {endPage < totalPages - 1 && <span className="px-1 text-sm text-muted-foreground">…</span>}
                        <button
                          onClick={() => updateParam("page", String(totalPages))}
                          className="rounded-md border border-border bg-card h-9 w-9 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}

                    <button
                      disabled={page >= totalPages}
                      onClick={() => updateParam("page", String(page + 1))}
                      className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
      <button disabled className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-[11px] font-medium text-muted-foreground cursor-not-allowed">
        Out of Stock
      </button>
    )
  }

  if (inCart) {
    return (
      <Link
        href="/cart"
        onClick={(e) => e.stopPropagation()}
        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 px-3 py-2 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors"
      >
        <Check className="h-3 w-3" />
        In Cart
      </Link>
    )
  }

  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground hover:bg-accent transition-colors disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
      Add to Cart
    </button>
  )
}

function SearchResultCard({ item, viewMode }: { item: SearchResult; viewMode: "grid" | "list" }) {
  const slug = item.product_id

  if (viewMode === "list") {
    return (
      <div className="group flex gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-lg transition-all">
        <Link href={`/product/${slug}`} className="w-24 h-24 rounded-lg bg-muted shrink-0 overflow-hidden flex items-center justify-center">
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <Leaf className="h-8 w-8 text-muted-foreground/30" />
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/product/${slug}`}>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">{item.title}</h3>
          </Link>
          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-lg font-bold text-primary">${item.min_price.toFixed(2)}</span>
            {item.avg_rating > 0 && (
              <span className="flex items-center gap-1 text-xs text-foreground">
                <Star className="h-3 w-3 fill-primary text-primary" />
                {item.avg_rating.toFixed(1)}
                <span className="text-muted-foreground">({item.review_count})</span>
              </span>
            )}
            <span className="text-xs text-muted-foreground">{item.store_name}</span>
          </div>
          <div className="mt-2 max-w-[160px]">
            <AddToCartButton item={item} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all">
      <Link href={`/product/${slug}`}>
        <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 relative overflow-hidden flex items-center justify-center">
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <Leaf className="h-12 w-12 text-muted-foreground/30" />
          )}
          {!item.in_stock && (
            <span className="absolute top-2 left-2 text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-red-500/90 text-white">
              Out of Stock
            </span>
          )}
        </div>
      </Link>

      <div className="p-3 space-y-1.5">
        <Link href={`/product/${slug}`}>
          <h3 className="text-[13px] font-semibold text-card-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2">
            {item.title}
          </h3>
        </Link>

        <div className="flex items-center gap-1">
          <span className="text-[15px] font-bold text-primary">${item.min_price.toFixed(2)}</span>
          {item.max_price > item.min_price && (
            <span className="text-[11px] text-muted-foreground">– ${item.max_price.toFixed(2)}</span>
          )}
        </div>

        {item.avg_rating > 0 && (
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-primary text-primary" />
            <span className="text-[11px] font-medium text-foreground">{item.avg_rating.toFixed(1)}</span>
            <span className="text-[11px] text-muted-foreground">({item.review_count})</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] text-muted-foreground truncate">{item.store_name}</span>
          {item.distance_miles != null && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-secondary/10 border border-secondary/20 px-1.5 py-0.5 text-[10px] font-medium text-secondary shrink-0">
              <MapPin className="h-2.5 w-2.5" />
              {item.distance_miles.toFixed(1)} mi
            </span>
          )}
        </div>

        <AddToCartButton item={item} />
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container py-12 text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          Loading search...
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  )
}
