"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  Star,
  Package,
  Store as StoreIcon,
  Loader2,
  AlertCircle,
  MapPin,
  Search,
  ShoppingCart,
  BadgeCheck,
  UserPlus,
  MessageCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getStoreBySlug,
  getStoreProducts,
  type StoreInfo,
  type Product,
} from "@/lib/api"
import { useCartStore } from "@/stores/cart-store"
import { toast } from "sonner"

const ALL_CATEGORY = "__all__"

type SortKey = "recommended" | "price-asc" | "price-desc" | "newest"

function formatPrice(price: number) {
  return `$${price.toFixed(2)}`
}

function productHasSellableStock(product: Product): boolean {
  return product.variants?.some((v) => v.stockQuantity > 0) ?? false
}

function firstInStockVariant(product: Product) {
  return product.variants?.find((v) => v.stockQuantity > 0) ?? null
}

function productPrice(product: Product): number | null {
  const v = firstInStockVariant(product) ?? product.variants?.[0]
  return v?.price ?? null
}

function productCompareAtPrice(product: Product): number | null {
  const v = firstInStockVariant(product) ?? product.variants?.[0]
  const cap = v?.compareAtPrice ?? null
  return cap && cap > (v?.price ?? 0) ? cap : null
}

function StoreProductCard({
  product,
  storeName,
  onAdd,
  inCart,
  adding,
}: {
  product: Product
  storeName: string
  onAdd: () => void
  inCart: boolean
  adding: boolean
}) {
  const price = productPrice(product)
  const compareAt = productCompareAtPrice(product)
  const onSale = compareAt != null && price != null
  const inStock = productHasSellableStock(product)
  const imageUrl = product.images?.[0]?.url
  const discountPct = onSale && compareAt
    ? Math.round(((compareAt - (price ?? 0)) / compareAt) * 100)
    : null
  const lowStock = inStock && (firstInStockVariant(product)?.stockQuantity ?? 0) <= 5

  let badge: { label: string; tone: "primary" | "sale" | "muted" } | null = null
  if (onSale && discountPct) badge = { label: `Sale -${discountPct}%`, tone: "sale" }
  else if (!inStock) badge = { label: "Sold Out", tone: "muted" }
  else if (lowStock) badge = { label: "Low Stock", tone: "primary" }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
      {badge && (
        <span
          className={cn(
            "absolute left-2 top-2 z-10 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow-sm",
            badge.tone === "sale" && "bg-destructive text-destructive-foreground",
            badge.tone === "primary" && "bg-brand-gold text-brand-gold-foreground",
            badge.tone === "muted" && "border border-border bg-muted text-muted-foreground"
          )}
        >
          {badge.label}
        </span>
      )}

      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-square w-full overflow-hidden bg-muted"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Package className="h-10 w-10" />
          </div>
        )}
      </Link>

      <div className="flex flex-grow flex-col p-3">
        <Link
          href={`/product/${product.slug}`}
          className="mb-1 line-clamp-2 text-sm text-foreground transition-colors group-hover:text-primary"
        >
          {product.title}
        </Link>
        <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-brand-gold text-brand-gold" />
          <span className="font-medium text-foreground">4.8</span>
          <span>(0)</span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex flex-col leading-tight">
            {onSale && compareAt && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(compareAt)}
              </span>
            )}
            <span
              className={cn(
                "text-lg font-bold leading-none",
                onSale ? "text-destructive" : "text-foreground"
              )}
            >
              {price != null ? formatPrice(price) : "—"}
            </span>
          </div>
          <button
            aria-label={inCart ? "In cart" : "Add to cart"}
            disabled={!inStock || adding}
            onClick={(e) => {
              e.preventDefault()
              onAdd()
            }}
            title={storeName}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
              inCart
                ? "bg-brand-gold text-brand-gold-foreground"
                : "bg-muted text-foreground hover:bg-brand-gold hover:text-brand-gold-foreground",
              (!inStock || adding) && "cursor-not-allowed opacity-50"
            )}
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </article>
  )
}

function StoreHero({ store, productCount }: { store: StoreInfo; productCount: number }) {
  const location = [store.addressCity, store.addressState].filter(Boolean).join(", ")

  return (
    <section aria-label="Store header" className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8 lg:py-8">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted shadow-sm sm:h-24 sm:w-24">
            {store.logoUrl ? (
              <Image
                src={store.logoUrl}
                alt={store.name}
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <StoreIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
                {store.name}
              </h1>
              <BadgeCheck className="h-5 w-5 fill-brand-gold text-brand-gold-foreground" aria-label="Verified" />
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {store.rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-brand-gold text-brand-gold" />
                  <span className="font-semibold text-foreground">{store.rating.toFixed(1)}</span>
                  {store.reviewCount > 0 && (
                    <span>({store.reviewCount.toLocaleString()} Reviews)</span>
                  )}
                </span>
              )}
              {store.rating > 0 && <span className="text-border">•</span>}
              <span className="flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />
                {productCount} Products
              </span>
              {location && (
                <>
                  <span className="text-border">•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </span>
                </>
              )}
            </div>

            {store.description && (
              <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
                {store.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex w-full items-center gap-2 md:w-auto">
          <button
            disabled
            title="Coming soon"
            aria-label="Follow (coming soon)"
            className="flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-md bg-brand-gold/60 px-5 py-2.5 text-sm font-semibold text-brand-gold-foreground/80 shadow-sm md:flex-none"
          >
            <UserPlus className="h-4 w-4" />
            Follow
          </button>
          <button
            disabled
            title="Coming soon"
            aria-label="Chat (coming soon)"
            className="flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-md border border-border bg-muted px-5 py-2.5 text-sm font-semibold text-muted-foreground shadow-sm md:flex-none"
          >
            <MessageCircle className="h-4 w-4" />
            Chat
          </button>
        </div>
      </div>
    </section>
  )
}

function StoreFilterBar({
  categories,
  activeCategory,
  onCategoryChange,
  search,
  onSearchChange,
}: {
  categories: { key: string; label: string; count: number }[]
  activeCategory: string
  onCategoryChange: (key: string) => void
  search: string
  onSearchChange: (v: string) => void
}) {
  return (
    <section className="sticky top-0 z-30 border-b border-border bg-card shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col items-stretch gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <nav
          aria-label="Store Categories"
          className="-mx-1 flex items-center gap-5 overflow-x-auto px-1 scrollbar-hide md:gap-6"
        >
          {categories.map((cat) => {
            const active = cat.key === activeCategory
            return (
              <button
                key={cat.key}
                onClick={() => onCategoryChange(cat.key)}
                className={cn(
                  "whitespace-nowrap pb-1 text-sm transition-colors",
                  active
                    ? "border-b-2 border-brand-gold font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {cat.label}
                {cat.count > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">({cat.count})</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search in this store..."
            className="w-full rounded-md border border-transparent bg-muted py-2 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:border-brand-gold focus:bg-card focus:outline-none focus:ring-1 focus:ring-brand-gold"
          />
        </div>
      </div>
    </section>
  )
}

export default function StorePageClient() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const isPreview = searchParams?.get("preview") === "1"

  useEffect(() => {
    if (!isPreview) return
    document.body.classList.add("storefront-preview")
    return () => document.body.classList.remove("storefront-preview")
  }, [isPreview])

  const PAGE_SIZE = 20

  const [store, setStore] = useState<StoreInfo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [totalProducts, setTotalProducts] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("recommended")

  const addItem = useCartStore((s) => s.addItem)
  const cartItems = useCartStore((s) => s.items)
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    async function load() {
      try {
        const storeData = await getStoreBySlug(slug)
        if (cancelled) return
        setStore(storeData)

        try {
          const productsRes = await getStoreProducts(storeData.id, 0, PAGE_SIZE)
          if (!cancelled) {
            setProducts(productsRes.content)
            setTotalProducts(productsRes.totalElements ?? productsRes.content.length)
            setPage(0)
          }
        } catch {
          // products endpoint may 404 for new stores
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Store not found")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [slug])

  async function loadMore() {
    if (!store || loadingMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const res = await getStoreProducts(store.id, nextPage, PAGE_SIZE)
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        const merged = [...prev]
        for (const p of res.content) if (!seen.has(p.id)) merged.push(p)
        return merged
      })
      setTotalProducts(res.totalElements ?? totalProducts)
      setPage(nextPage)
    } catch {
      toast.error("Failed to load more products")
    } finally {
      setLoadingMore(false)
    }
  }

  const hasMore = products.length < totalProducts

  const categories = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>()
    for (const p of products) {
      for (const c of p.categories ?? []) {
        const entry = map.get(c.slug) ?? { label: c.name, count: 0 }
        entry.count += 1
        map.set(c.slug, entry)
      }
    }
    const list = [...map.entries()].map(([key, v]) => ({ key, ...v }))
    list.sort((a, b) => b.count - a.count)
    return [
      { key: ALL_CATEGORY, label: "All Products", count: products.length },
      ...list.slice(0, 6),
    ]
  }, [products])

  const filteredSorted = useMemo(() => {
    let list = products
    if (activeCategory !== ALL_CATEGORY) {
      list = list.filter((p) => p.categories?.some((c) => c.slug === activeCategory))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.title.toLowerCase().includes(q))
    }
    const sorted = [...list]
    if (sort === "price-asc") sorted.sort((a, b) => (productPrice(a) ?? 0) - (productPrice(b) ?? 0))
    else if (sort === "price-desc") sorted.sort((a, b) => (productPrice(b) ?? 0) - (productPrice(a) ?? 0))
    else if (sort === "newest") sorted.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    return sorted
  }, [products, activeCategory, search, sort])

  function handleAdd(product: Product) {
    if (!store) return
    const variant = firstInStockVariant(product)
    if (!variant) {
      toast.error("This product is out of stock")
      return
    }
    setAddingId(product.id)
    addItem({
      productId: product.id,
      variantId: variant.id,
      storeId: product.storeId,
      storeName: store.name,
      title: product.title,
      variantName: variant.name || "Default",
      price: Math.round(variant.price * 100),
      quantity: 1,
      imageUrl: product.images?.[0]?.url,
      slug: product.slug,
      weightKg: variant.weightKg ?? null,
      lengthIn: variant.lengthIn ?? null,
      widthIn: variant.widthIn ?? null,
      heightIn: variant.heightIn ?? null,
    })
    toast.success(`${product.title} added to cart`)
    setAddingId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    )
  }

  if (error || !store) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Store Not Found</h1>
          <p className="text-sm text-muted-foreground">
            {error || "The store you're looking for doesn't exist or may have been removed."}
          </p>
          <Link
            href="/stores"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 text-sm font-medium text-brand-gold-foreground transition-colors hover:bg-brand-gold-hover"
          >
            Browse All Stores
          </Link>
        </div>
      </div>
    )
  }

  const activeCatLabel = categories.find((c) => c.key === activeCategory)?.label ?? "All Products"
  // Filters/search/sort apply to what the buyer has loaded so far. Load More
  // continues fetching the next backend page until the full catalog is in.
  const isFiltering = activeCategory !== ALL_CATEGORY || search.trim().length > 0

  return (
    <div className="min-h-screen bg-background">
      <StoreHero store={store} productCount={totalProducts} />

      <StoreFilterBar
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        search={search}
        onSearchChange={setSearch}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-foreground">{activeCatLabel}</h2>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="sort" className="text-muted-foreground">Sort by:</label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-border bg-card px-2 py-1 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
            >
              <option value="recommended">Recommended</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="newest">Newest Arrivals</option>
            </select>
          </div>
        </div>

        {filteredSorted.length === 0 ? (
          <div className="py-20 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm text-muted-foreground">
              {products.length === 0
                ? "This store hasn't listed any products yet."
                : "No products match your search."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filteredSorted.map((p) => {
                const inCart = cartItems.some((i) => i.productId === p.id)
                return (
                  <StoreProductCard
                    key={p.id}
                    product={p}
                    storeName={store.name}
                    onAdd={() => handleAdd(p)}
                    inCart={inCart}
                    adding={addingId === p.id}
                  />
                )
              })}
            </div>

            {hasMore && (
              <div className="mt-10 flex flex-col items-center gap-2">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-8 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loadingMore ? "Loading..." : "Load More Products"}
                </button>
                <p className="text-xs text-muted-foreground">
                  Showing {products.length} of {totalProducts}
                  {isFiltering && " — load more to widen your filter results"}
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
