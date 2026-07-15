"use client"

import { useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Heart, ShoppingBag, Trash2, Package } from "lucide-react"
import { useWishlistStore } from "@/stores/wishlist-store"
import { useWishlist } from "@/hooks/use-wishlist"
import { useCartStore } from "@/stores/cart-store"
import { getProductById } from "@/lib/api"
import type { Product } from "@/lib/api"

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

interface DisplayItem {
  productId: string
  slug: string
  title: string
  imageUrl?: string | null
  priceCents: number
  storeName?: string | null
}

/**
 * Authenticated wishlist page — server is the source of truth (#43).
 *
 * Hydrates display metadata (title, image, price) lazily by calling
 * getProductById per item not already in the local zustand store. The
 * local store is still kept around as a metadata cache so subsequent
 * visits don't re-fetch every product.
 */
function ServerWishlist() {
  const wishlist = useWishlist()
  const ids = useMemo(() => Array.from(wishlist.ids), [wishlist.ids])
  const localItems = useWishlistStore((s) => s.items)
  const localAdd = useWishlistStore((s) => s.add)
  const localRemove = useWishlistStore((s) => s.remove)
  const addToCart = useCartStore((s) => s.addItem)

  // Cache productId -> metadata via TanStack Query so re-renders don't refetch.
  const detailQueries = useQuery({
    queryKey: ["wishlist", "details", ids.sort().join(",")],
    queryFn: async () => {
      const local = new Map(localItems.map((i) => [i.productId, i] as const))
      const out: DisplayItem[] = []
      const missing: string[] = []
      for (const id of ids) {
        const cached = local.get(id)
        if (cached && cached.title) {
          out.push({
            productId: cached.productId,
            slug: cached.slug,
            title: cached.title,
            imageUrl: cached.imageUrl,
            priceCents: cached.priceCents,
            storeName: cached.storeName,
          })
        } else {
          missing.push(id)
        }
      }
      const fetched = await Promise.allSettled(
        missing.map((id) => getProductById(id)),
      )
      fetched.forEach((res, i) => {
        if (res.status !== "fulfilled") return
        const product = res.value as Product
        const display: DisplayItem = {
          productId: product.id,
          slug: product.slug,
          title: product.title,
          imageUrl: product.images[0]?.url,
          priceCents: Math.round((product.variants[0]?.price ?? 0) * 100),
          storeName: null,
        }
        out.push(display)
        // Cache the metadata in the local store so a refresh is free.
        localAdd(display)
        // missing[i] is the original id; if mismatch (deleted product) skip.
        void missing[i]
      })
      return out
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
  })

  const items = detailQueries.data ?? []

  async function handleMoveToCart(productId: string) {
    try {
      const product = await getProductById(productId)
      const variant = product.variants?.[0]
      if (!variant) {
        toast.error("This product is no longer purchasable")
        return
      }
      addToCart({
        productId: product.id,
        variantId: variant.id,
        storeId: product.storeId,
        storeName: product.storeId,
        title: product.title,
        variantName: variant.name || "Default",
        price: Math.round(variant.price * 100),
        quantity: 1,
        imageUrl: product.images[0]?.url,
        slug: product.slug,
        weightKg: variant.weightKg ?? null,
        lengthIn: variant.lengthIn ?? null,
        widthIn: variant.widthIn ?? null,
        heightIn: variant.heightIn ?? null,
      })
      await wishlist.remove(productId)
      localRemove(productId)
      toast.success("Moved to cart")
    } catch {
      toast.error("Could not add to cart")
    }
  }

  return (
    <main className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Your Wishlist</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {wishlist.loading
              ? "Loading…"
              : ids.length === 0
                ? "Tap the heart on any product to save it for later."
                : `${ids.length} item${ids.length === 1 ? "" : "s"} saved.`}
          </p>
        </div>
      </div>

      {!wishlist.loading && ids.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
          <Heart className="mx-auto h-14 w-14 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground mt-5">Your wishlist is empty</h2>
          <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
            Save products you love by tapping the heart icon. Your wishlist syncs across devices.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-6 rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
          >
            <ShoppingBag className="h-4 w-4" />
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <article key={item.productId} className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
              <Link href={`/product/${item.slug || item.productId}`} className="block aspect-square bg-muted relative">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <Package className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
              </Link>
              <div className="p-4 flex flex-col gap-2">
                <Link href={`/product/${item.slug || item.productId}`}>
                  <h3 className="text-sm font-medium text-foreground line-clamp-2 hover:text-brand-gold-hover transition-colors">
                    {item.title}
                  </h3>
                </Link>
                {item.storeName && (
                  <p className="text-xs text-muted-foreground truncate">{item.storeName}</p>
                )}
                <p className="text-lg font-bold text-foreground">{formatCents(item.priceCents)}</p>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleMoveToCart(item.productId)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-gold py-2 text-xs font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Move to cart
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await wishlist.remove(item.productId)
                      localRemove(item.productId)
                    }}
                    aria-label="Remove from wishlist"
                    className="inline-flex items-center justify-center rounded-full border border-border px-3 text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}

export default function WishlistPage() {
  const { status } = useSession()

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    )
  }

  // Auth is gated by app/(main)/account/layout.tsx server-side.
  if (status !== "authenticated") return null

  return <ServerWishlist />
}
