"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Star,
  Package,
  ChevronRight,
  Store as StoreIcon,
  Loader2,
  AlertCircle,
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

function formatPrice(price: number) {
  return `$${price.toFixed(2)}`
}

function StoreProductGrid({ products, store }: { products: Product[]; store: StoreInfo }) {
  const addItem = useCartStore((s) => s.addItem)
  const cartItems = useCartStore((s) => s.items)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  function handleAdd(product: Product) {
    const variant = product.variants?.[0]
    if (!variant) {
      toast.error("This product has no purchasable variant yet")
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
    })
    toast.success(`${product.title} added to cart`)
    setLoadingId(null)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => {
        const price = product.variants?.[0]?.price
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
              inStock={product.variants?.length > 0}
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
          // products might not exist yet
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !store) {
    return (
      <div className="container py-20">
        <div className="mx-auto max-w-md text-center space-y-4">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Store Not Found</h1>
          <p className="text-sm text-muted-foreground">
            {error || "The store you're looking for doesn't exist or may have been removed."}
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
    <div>
      <div className="relative border-b border-border">
        {store.bannerUrl ? (
          <div className="absolute inset-0">
            <img src={store.bannerUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/80 to-background" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-card to-secondary/5" />
        )}
        <div className="container relative py-12">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/stores" className="hover:text-foreground transition-colors">Stores</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground">{store.name}</span>
          </nav>

          <div className="flex flex-col sm:flex-row items-start gap-6">
            {store.logoUrl ? (
              <img
                src={store.logoUrl}
                alt={store.name}
                className="h-20 w-20 rounded-2xl object-cover border border-primary/20"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                <StoreIcon className="h-10 w-10 text-primary" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-foreground">{store.name}</h1>

              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                {store.rating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    <span className="font-semibold text-foreground">{store.rating.toFixed(1)}</span>
                    {store.reviewCount > 0 && (
                      <span className="text-muted-foreground">({store.reviewCount} reviews)</span>
                    )}
                  </div>
                )}
              </div>

              {store.description && (
                <p className="mt-4 text-sm text-muted-foreground max-w-2xl leading-relaxed">
                  {store.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-6 mt-8">
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{products.length}</span>
              <span className="text-muted-foreground">Products</span>
            </div>
            {store.reviewCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">{store.reviewCount}</span>
                <span className="text-muted-foreground">Reviews</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-card/30">
        <div className="container flex gap-8">
          {(["products", "about"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "py-3 text-sm font-medium border-b-2 transition-colors capitalize",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="container py-8">
        {activeTab === "products" && (
          <>
            {products.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <p className="mt-4 text-sm text-muted-foreground">
                  This store hasn&apos;t listed any products yet.
                </p>
              </div>
            ) : (
              <StoreProductGrid products={products} store={store} />
            
            )}
          </>
        )}

        {activeTab === "about" && (
          <div className="max-w-2xl space-y-6">
            {store.description && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">About</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{store.description}</p>
              </div>
            )}
            {(store.addressLine1 || store.addressCity) && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Location</h3>
                <p className="text-sm text-muted-foreground">
                  {[store.addressLine1, store.addressCity, store.addressState, store.addressZip]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            )}
            {store.deliveryRadiusMiles && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Delivery</h3>
                <p className="text-sm text-muted-foreground">
                  This store delivers within a {store.deliveryRadiusMiles}-mile radius.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
