"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ChevronRight, Star, MapPin, Leaf, Loader2, ShoppingCart, Sparkles } from "lucide-react"
import { searchProducts, getCategories, getProductById, getProductBySlug, type SearchResult, type CategoryRef, type Product } from "@/lib/api"
import { friendlyMessage } from "@/lib/errors"
import { useCartStore } from "@/stores/cart-store"
import { useBuyerLocation } from "@/stores/buyer-location"
import { toast } from "sonner"
import { SellOnAfrotransactStrip } from "@/components/landing/SellOnAfrotransactStrip"
import { PromoSlot } from "@/components/marketing/PromoSlot"

function productToSearchResult(p: Product): SearchResult {
  const variant = p.variants?.[0]
  const prices = p.variants?.map((v) => v.price).filter((x) => x > 0) ?? []
  return {
    product_id: p.id,
    store_id: p.storeId,
    store_name: "",
    title: p.title,
    description: p.description ?? "",
    product_type: p.productType ?? "",
    categories: p.categories?.map((c) => c.name) ?? [],
    min_price: prices.length ? Math.min(...prices) : 0,
    max_price: prices.length ? Math.max(...prices) : 0,
    currency: variant?.currency ?? "USD",
    in_stock: p.variants?.some((v) => (v.stockQuantity ?? 0) > 0) ?? false,
    image_url: p.images?.[0]?.url ?? null,
    avg_rating: 0,
    review_count: 0,
    distance_miles: null,
    highlight_title: null,
    highlight_description: null,
    score: null,
    slug: p.slug,
  }
}

/** Find a category node by slug anywhere in the nested tree. */
function findCategoryNode(list: CategoryRef[], slug: string): CategoryRef | null {
  for (const c of list) {
    if (c.slug === slug) return c
    if (c.children) {
      const found = findCategoryNode(c.children, slug)
      if (found) return found
    }
  }
  return null
}

/** A category's own slug plus every descendant slug. Products are only tagged
 *  with their leaf category, so a parent must query all of its children to
 *  surface their products. */
function collectCategorySlugs(node: CategoryRef): string[] {
  const out: string[] = []
  const walk = (n: CategoryRef) => {
    out.push(n.slug)
    for (const child of n.children ?? []) walk(child)
  }
  walk(node)
  return out
}

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
      if (!variant) { toast.error("This product has no purchasable variant yet"); return }
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
      className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-xs font-semibold text-brand-gold-foreground hover:bg-brand-gold/90 transition-colors disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
      Add to Cart
    </button>
  )
}

function ProductCard({ product, featured = false }: { product: SearchResult; featured?: boolean }) {
  const productPath = (product.slug && product.slug.trim()) || product.product_id
  return (
    <Link
      href={`/product/${encodeURIComponent(productPath)}`}
      className={`group relative flex flex-col rounded-xl sm:rounded-2xl border bg-card overflow-hidden hover:shadow-lg transition-all duration-200 min-w-0 ${
        featured
          ? "border-primary/50 hover:border-primary shadow-sm shadow-primary/10"
          : "border-border hover:border-primary/40 hover:shadow-primary/5"
      }`}
    >
      {featured && (
        <div className="absolute top-2 left-2 z-[2] flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-[#0f0f10]">
          <Sparkles className="h-2.5 w-2.5" />
          Featured
        </div>
      )}
      <div className="relative aspect-square w-full shrink-0 bg-muted/50">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={!!featured}
            className="object-contain object-center p-2 sm:p-3 group-hover:scale-[1.02] transition-transform duration-200"
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
      <div className="p-2 sm:p-3 space-y-1 sm:space-y-1.5 min-w-0 flex-1">
        <h3 className="text-[11px] sm:text-[13px] font-semibold text-card-foreground group-hover:text-foreground transition-colors leading-tight line-clamp-2">
          {product.title}
        </h3>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-sm sm:text-[15px] font-bold text-foreground">${product.min_price.toFixed(2)}</span>
          {product.max_price > product.min_price && (
            <span className="text-[10px] sm:text-[11px] text-muted-foreground">– ${product.max_price.toFixed(2)}</span>
          )}
        </div>
        {product.avg_rating > 0 && (
          <div className="hidden sm:flex items-center gap-1">
            <Star className="h-3 w-3 fill-primary text-foreground" />
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

export default function CategoryPageClient() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const slug = params.slug as string
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
  // Callers (CategoryShowcaseAmazon) send `?featured_id=<slug|uuid>`; the
  // legacy `?featured=` param is still accepted for old bookmarks.
  const featuredId = searchParams.get("featured_id") ?? searchParams.get("featured") ?? null
  const pageSize = 24

  const [name, setName] = useState(slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
  const [featuredProduct, setFeaturedProduct] = useState<SearchResult | null>(null)
  const [products, setProducts] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  // The category slugs to actually query: this category + all descendants, so
  // a parent category surfaces every product across its sub-categories. null
  // until resolved from the tree (gates the search so we don't flash "empty").
  const [querySlugs, setQuerySlugs] = useState<string[] | null>(null)

  // Category browse is intentionally NOT geo-filtered: buyers want to see
  // every product in a category regardless of where the seller ships from
  // (Amazon does the same). Geo only matters at checkout time for
  // shipping cost. Radius filtering here was hiding results whenever a
  // seller's store row lacked lat/lon coordinates.
  const buyerLocation = useBuyerLocation((s) => s.location)
  void buyerLocation
  const hasGeo = false

  useEffect(() => {
    let cancelled = false
    // Gate the product search until we've resolved this category's descendant
    // slugs from the tree (a parent must query all its children).
    setQuerySlugs(null)
    getCategories()
      .then((cats) => {
        if (cancelled) return
        const node = findCategoryNode(cats, slug)
        if (node) setName(node.name)
        setQuerySlugs(node ? collectCategorySlugs(node) : [slug])
      })
      .catch(() => { if (!cancelled) setQuerySlugs([slug]) })
    return () => { cancelled = true }
  }, [slug])

  useEffect(() => {
    // Wait until we know which slugs to query (this category + descendants).
    if (!querySlugs) { setLoading(true); return }
    setLoading(true)
    setError(null)
    setFeaturedProduct(null)

    // Featured id may be a UUID or a slug depending on where the caller
    // came from. Try UUID lookup first; on 404, fall back to slug lookup.
    // Both return the same Product shape.
    const fetchFeatured =
      page === 1 && featuredId
        ? getProductById(featuredId)
            .catch(() => getProductBySlug(featuredId))
            .then(productToSearchResult)
            .catch(() => null)
        : Promise.resolve(null)

    Promise.all([
      fetchFeatured,
      searchProducts({
        // Backend expects category SLUGS (e.g. "food-grocery"), not the
        // display name. We send this category plus every descendant slug
        // (comma-separated) so a PARENT category surfaces all of its
        // sub-categories' products instead of coming back empty.
        category: querySlugs.join(","),
        size: String(pageSize),
        page: String(page),
        ...(hasGeo
          ? {
              lat: String(buyerLocation!.lat),
              lon: String(buyerLocation!.lng),
              radius: "25",
            }
          : {}),
      }),
    ])
      .then(([featured, res]) => {
        setFeaturedProduct(featured)
        // Deduplicate: remove the featured product from the paginated list if it appears there
        const rest = featured
          ? res.results.filter((r) => r.product_id !== featured.product_id)
          : res.results
        setProducts(rest)
        // Total stays accurate: +1 only if featured isn't already counted in the search results
        setTotal(res.total)
      })
      .catch((err) => {
        setError(friendlyMessage(err, "Could not load products."))
      })
      .finally(() => setLoading(false))
  }, [querySlugs, page, featuredId])

  function updatePage(nextPage: number) {
    const next = Math.max(1, nextPage)
    const qs = new URLSearchParams(searchParams.toString())
    if (next <= 1) qs.delete("page")
    else qs.set("page", String(next))
    // Drop featured param when navigating away from page 1.
    if (next > 1) {
      qs.delete("featured_id")
      qs.delete("featured")
    }
    router.push(`${pathname}?${qs.toString()}`)
  }

  const totalPages = Math.ceil(total / pageSize)
  const displayedProducts: Array<{ item: SearchResult; featured: boolean }> = [
    ...(featuredProduct ? [{ item: featuredProduct, featured: true }] : []),
    ...products.map((p) => ({ item: p, featured: false })),
  ]

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-1 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-700 transition-colors">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/categories" className="hover:text-gray-700 transition-colors">Categories</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 font-medium">{name}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">{name}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {loading
              ? "Loading…"
              : `${total.toLocaleString()} product${total !== 1 ? "s" : ""} from local stores`}
          </p>
        </div>
        {page > 1 && (
          <button
            onClick={() => updatePage(1)}
            className="text-sm text-foreground hover:text-foreground transition-colors shrink-0"
          >
            ← First page
          </button>
        )}
      </div>

      {/* Promotions strip (admin-managed) */}
      <PromoSlot placement="STRIP_TOP" className="mb-6" />

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          {Array.from({ length: pageSize }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
              <div className="aspect-square bg-muted/60" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-white rounded-lg border border-red-100 p-6">
          <p className="text-red-800 font-medium mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-foreground text-sm font-bold hover:underline"
          >
            Try again
          </button>
        </div>
      ) : displayedProducts.length === 0 ? (
        <div className="text-center py-20">
          <Leaf className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No products in this category yet.</p>
          <Link href="/" className="text-foreground text-sm mt-2 inline-block hover:text-foreground">
            Browse all products →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
            {displayedProducts.map(({ item, featured }) => (
              <ProductCard key={item.product_id} product={item} featured={featured} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => updatePage(page - 1)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>

              {/* Page number pills */}
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number
                if (totalPages <= 7) {
                  p = i + 1
                } else if (page <= 4) {
                  p = i + 1
                } else if (page >= totalPages - 3) {
                  p = totalPages - 6 + i
                } else {
                  p = page - 3 + i
                }
                return (
                  <button
                    key={p}
                    onClick={() => updatePage(p)}
                    className={`h-10 min-w-[2.5rem] rounded-xl px-3 text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-primary text-[#0f0f10] font-bold"
                        : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                )
              })}

              <button
                disabled={page >= totalPages}
                onClick={() => updatePage(page + 1)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Sell CTA — category browsers are prime sellers in that category. */}
      <div className="mt-10">
        <SellOnAfrotransactStrip />
      </div>
    </main>
  )
}
