"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ChevronRight, ChevronLeft, Star, MapPin, Leaf, Loader2, ShoppingCart } from "lucide-react"
import { searchProducts, getProductById, getCategories, type SearchResult, type CategoryRef } from "@/lib/api"
import { useCartStore } from "@/stores/cart-store"
import { toast } from "sonner"

const PAGE_SIZE = 24

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

export default function CategoryPageClient() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const featuredId = searchParams.get("featured_id")

  const [name, setName] = useState(slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
  const [products, setProducts] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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

  const loadPage = useCallback(
    (pageNum: number) => {
      setLoading(true)
      setPage(pageNum)
      const offset = (pageNum - 1) * PAGE_SIZE
      searchProducts({ category: name, size: String(PAGE_SIZE), from: String(offset) })
        .then((res) => {
          let results = res.results
          // On page 1, pin the featured item to the top if provided
          if (pageNum === 1 && featuredId) {
            const idx = results.findIndex((p) => p.product_id === featuredId || p.slug === featuredId)
            if (idx > 0) {
              const [pinned] = results.splice(idx, 1)
              results = [pinned, ...results]
            }
          }
          setProducts(results)
          setTotal(res.total)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    },
    [name, featuredId]
  )

  useEffect(() => {
    if (name) loadPage(1)
  }, [name]) // eslint-disable-line react-hooks/exhaustive-deps

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function goToPage(p: number) {
    loadPage(p)
    scrollToTop()
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-1 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/categories" className="hover:text-gray-900 transition-colors">Categories</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900">{name}</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900">{name}</h1>
        <p className="text-gray-500 mt-1">
          {loading ? "Loading products…" : `${total} product${total !== 1 ? "s" : ""} available`}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
              <div className="aspect-square bg-muted" />
              <div className="p-2 sm:p-3 space-y-2">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-8 bg-muted rounded mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-24">
          <Leaf className="h-14 w-14 text-gray-200 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">No products found</h2>
          <p className="text-gray-500 text-sm mb-4">Nothing in this category yet — check back soon.</p>
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            Browse all products
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
            {products.map((product, idx) => {
              const productPath = product.slug?.trim() || product.product_id
              const isPinned = idx === 0 && page === 1 && featuredId
              return (
                <Link
                  key={product.product_id}
                  href={`/product/${encodeURIComponent(productPath)}`}
                  className={`group flex flex-col rounded-xl sm:rounded-2xl border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 min-w-0 ${
                    isPinned ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
                  }`}
                >
                  <div className="relative aspect-square w-full shrink-0 bg-muted/50">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        priority={idx < 6}
                        className="object-contain object-center p-2 sm:p-3"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Leaf className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                    {!product.in_stock && (
                      <span className="absolute top-2 left-2 z-[1] text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-red-500/90 text-white">
                        Out of Stock
                      </span>
                    )}
                  </div>

                  <div className="p-2 sm:p-3 space-y-1 sm:space-y-1.5 min-w-0 flex-1 flex flex-col">
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
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-secondary/10 border border-secondary/20 px-1.5 py-0.5 text-[10px] font-medium text-secondary shrink-0">
                          <MapPin className="h-2.5 w-2.5" />{product.distance_miles.toFixed(1)} mi
                        </span>
                      )}
                    </div>
                    <AddToCartButton item={product} />
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-1">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-sm hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | "…")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…")
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p as number)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                        p === page
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}

              <button
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-sm hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
