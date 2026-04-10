"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ChevronRight, Star, MapPin, Leaf, Loader2, ShoppingCart, Check, Sparkles } from "lucide-react"
import { searchProducts, getCategories, getProductById, type SearchResult, type CategoryRef, type Product } from "@/lib/api"
import { useCartStore } from "@/stores/cart-store"
import { toast } from "sonner"

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
        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-400 cursor-not-allowed"
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
        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-100 transition-colors"
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
      className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
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

export default function CategoryPageClient() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const slug = params.slug as string
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
  const featuredId = searchParams.get("featured") ?? null
  const pageSize = 24

  const [name, setName] = useState(slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
  const [featuredProduct, setFeaturedProduct] = useState<SearchResult | null>(null)
  const [products, setProducts] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    getCategories()
      .then((cats) => {
        const findName = (list: CategoryRef[]): string | null => {
          for (const c of list) {
            if (c.slug === slug) return c.name
            if (c.children) {
              const childName = findName(c.children)
              if (childName) return childName
            }
          }
          return null
        }
        const found = findName(cats)
        if (found) setName(found)
      })
      .catch(() => {})
  }, [slug])

  useEffect(() => {
    setLoading(true)
    setFeaturedProduct(null)

    const fetchFeatured =
      page === 1 && featuredId
        ? getProductById(featuredId).then(productToSearchResult).catch(() => null)
        : Promise.resolve(null)

    Promise.all([
      fetchFeatured,
      searchProducts({ category: name, size: String(pageSize), page: String(page) }),
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
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [name, page, featuredId])

  function updatePage(nextPage: number) {
    const next = Math.max(1, nextPage)
    const qs = new URLSearchParams(searchParams.toString())
    if (next <= 1) qs.delete("page")
    else qs.set("page", String(next))
    // Drop featured param when navigating away from page 1
    if (next > 1) qs.delete("featured")
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
            className="text-sm text-primary hover:text-primary/80 transition-colors shrink-0"
          >
            ← First page
          </button>
        )}
      </div>

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
      ) : displayedProducts.length === 0 ? (
        <div className="text-center py-20">
          <Leaf className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No products in this category yet.</p>
          <Link href="/" className="text-primary text-sm mt-2 inline-block hover:text-primary/80">
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
    </main>
  )
}
