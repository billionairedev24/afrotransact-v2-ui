"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Star,
  Package,
  ChevronRight,
  Store as StoreIcon,
  Loader2,
  AlertCircle,
  MapPin,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ProductCard } from "@/components/ui/product-card"
import {
  getStoreBySlug,
  getStoreProducts,
  type StoreInfo,
  type Product,
} from "@/lib/api"
import { useCartStore } from "@/stores/cart-store"
import { toast } from "sonner"

const FALLBACK_ACCENT = "#EAB308"

function formatPrice(price: number) {
  return `$${price.toFixed(2)}`
}

/** Any variant with inventory can be sold from quick-add grids. */
function productHasSellableStock(product: Product): boolean {
  return product.variants?.some((v) => v.stockQuantity > 0) ?? false
}

function firstInStockVariant(product: Product) {
  return product.variants?.find((v) => v.stockQuantity > 0) ?? null
}

function getAccentColor(store: StoreInfo | null): string {
  if (!store) return FALLBACK_ACCENT
  const color = (store as StoreInfo & { themeColor?: string }).themeColor
  if (!color) return FALLBACK_ACCENT
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : FALLBACK_ACCENT
}

function StoreProductGrid({ products, store }: { products: Product[]; store: StoreInfo }) {
  const addItem = useCartStore((s) => s.addItem)
  const cartItems = useCartStore((s) => s.items)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  function handleAdd(product: Product) {
    const variant = firstInStockVariant(product)
    if (!variant) {
      toast.error("This product is out of stock")
      return
    }
    setLoadingId(product.id)
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
    setLoadingId(null)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => {
        const displayVariant = firstInStockVariant(product) ?? product.variants?.[0]
        const price = displayVariant?.price
        const imageUrl = product.images?.[0]?.url
        const inCart = cartItems.some((i) => i.productId === product.id)
        return (
          <Link key={product.id} href={`/product/${product.slug}`}>
            <ProductCard
              name={product.title}
              price={price != null ? formatPrice(price) : "—"}
              store={store.name}
              distance=""
              rating={0}
              imageUrl={imageUrl}
              inStock={productHasSellableStock(product)}
              inCart={inCart}
              addingToCart={loadingId === product.id}
              onAddToCart={() => handleAdd(product)}
            />
          </Link>
        )
      })}
    </div>
  )
}

function StoreHero({ store, productCount }: { store: StoreInfo; productCount: number }) {
  const location = [store.addressCity, store.addressState].filter(Boolean).join(", ")

  return (
    <div className="relative overflow-hidden">
      {store.bannerUrl ? (
        <div className="absolute inset-0">
          <img
            src={store.bannerUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/80" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
      )}

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <nav className="flex items-center gap-2 text-sm text-white/60 mb-8">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/stores" className="hover:text-white transition-colors">Stores</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-white/90">{store.name}</span>
        </nav>

        <div className="flex flex-col sm:flex-row items-start gap-6">
          {store.logoUrl ? (
            <img
              src={store.logoUrl}
              alt={store.name}
              className="h-24 w-24 rounded-2xl object-cover border-2 border-white/20 shadow-lg flex-shrink-0"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/10 border-2 border-white/20 shadow-lg flex-shrink-0">
              <StoreIcon className="h-12 w-12 text-white/70" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {store.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 mt-3">
              {store.rating > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-white">{store.rating.toFixed(1)}</span>
                  {store.reviewCount > 0 && (
                    <span className="text-white/60">({store.reviewCount} reviews)</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-sm text-white/60">
                <Package className="h-4 w-4" />
                <span>{productCount} Products</span>
              </div>
              {location && (
                <div className="flex items-center gap-1.5 text-sm text-white/60">
                  <MapPin className="h-4 w-4" />
                  <span>{location}</span>
                </div>
              )}
            </div>

            {store.description && (
              <p className="mt-4 text-sm text-white/70 max-w-2xl leading-relaxed line-clamp-2">
                {store.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StoreNavbar({
  store,
  activeTab,
  onTabChange,
  productCount,
  accentColor,
}: {
  store: StoreInfo
  activeTab: "products" | "about"
  onTabChange: (tab: "products" | "about") => void
  productCount: number
  accentColor: string
}) {
  const tabs = [
    { key: "products" as const, label: "Products", count: productCount },
    { key: "about" as const, label: "About", count: null },
  ]

  return (
    <div className="sticky top-0 z-30 border-b border-gray-200 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 h-14">
          <div className="flex items-center gap-3 flex-shrink-0">
            {store.logoUrl ? (
              <img
                src={store.logoUrl}
                alt={store.name}
                className="h-8 w-8 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                <StoreIcon className="h-4 w-4 text-gray-500" />
              </div>
            )}
            <span className="text-sm font-semibold text-gray-900 hidden sm:block">
              {store.name}
            </span>
          </div>

          <div className="h-6 w-px bg-gray-200 flex-shrink-0" />

          <nav className="flex items-center gap-1 flex-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => onTabChange(tab.key)}
                  className={cn(
                    "relative px-4 py-4 text-sm font-medium transition-colors",
                    isActive ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {tab.label}
                    {tab.count != null && (
                      <span
                        className={cn(
                          "text-xs rounded-full px-2 py-0.5",
                          isActive
                            ? "text-white font-medium"
                            : "bg-gray-100 text-gray-500"
                        )}
                        style={isActive ? { backgroundColor: accentColor } : undefined}
                      >
                        {tab.count}
                      </span>
                    )}
                  </span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ backgroundColor: accentColor }}
                    />
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}

export default function StorePage() {
  const params = useParams()
  const slug = params.slug as string

  const [store, setStore] = useState<StoreInfo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"products" | "about">("products")

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    async function load() {
      try {
        const storeData = await getStoreBySlug(slug)
        if (cancelled) return
        setStore(storeData)

        try {
          const productsRes = await getStoreProducts(storeData.id, 0, 50)
          if (!cancelled) setProducts(productsRes.content)
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

  const accentColor = useMemo(() => getAccentColor(store), [store])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !store) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="mx-auto max-w-md text-center space-y-4">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Store Not Found</h1>
          <p className="text-sm text-muted-foreground">
            {error || "The store you&apos;re looking for doesn&apos;t exist or may have been removed."}
          </p>
          <Link
            href="/stores"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Browse All Stores
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StoreHero store={store} productCount={products.length} />

      <StoreNavbar
        store={store}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        productCount={products.length}
        accentColor={accentColor}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {activeTab === "products" && (
          <>
            {products.length === 0 ? (
              <div className="py-20 text-center">
                <Package className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-sm text-gray-500">
                  This store hasn&apos;t listed any products yet.
                </p>
              </div>
            ) : (
              <StoreProductGrid products={products} store={store} />
            )}
          </>
        )}

        {activeTab === "about" && (
          <div className="max-w-2xl space-y-8">
            {store.description && (
              <section>
                <h3 className="text-base font-semibold text-gray-900 mb-3">About</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{store.description}</p>
              </section>
            )}
            {(store.addressLine1 || store.addressCity) && (
              <section>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Location</h3>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-600">
                    {[store.addressLine1, store.addressCity, store.addressState, store.addressZip]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </section>
            )}
            {store.deliveryRadiusMiles && (
              <section>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Delivery</h3>
                <p className="text-sm text-gray-600">
                  This store delivers within a {store.deliveryRadiusMiles}-mile radius.
                </p>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
