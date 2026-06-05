"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Heart, ShoppingBag, Trash2, Package } from "lucide-react"
import { useWishlistStore } from "@/stores/wishlist-store"
import { useCartStore } from "@/stores/cart-store"
import { getProductById } from "@/lib/api"

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function WishlistPage() {
  const { status } = useSession()
  const items = useWishlistStore((s) => s.items)
  const remove = useWishlistStore((s) => s.remove)
  const addToCart = useCartStore((s) => s.addItem)
  // Defer rendering items until hydration to avoid SSR/CSR mismatch from
  // localStorage-backed state. zustand/persist sets _hasHydrated on first
  // commit; we mirror it locally so the empty-state doesn't flash.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

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
      remove(productId)
      toast.success("Moved to cart")
    } catch {
      toast.error("Could not add to cart")
    }
  }

  if (status !== "authenticated") {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
        <Heart className="mx-auto h-14 w-14 text-gray-400" />
        <h1 className="text-xl font-bold text-foreground mt-5">Sign in to view your wishlist</h1>
        <p className="text-sm text-gray-500 mt-2">Saved items sync to your account so you don&apos;t lose them.</p>
        <Link
          href="/auth/login"
          className="inline-block mt-6 rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
        >
          Sign In
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Your Wishlist</h1>
          <p className="text-sm text-gray-500 mt-1">
            {hydrated
              ? items.length === 0
                ? "Tap the heart on any product to save it for later."
                : `${items.length} item${items.length === 1 ? "" : "s"} saved.`
              : "Loading…"}
          </p>
        </div>
      </div>

      {hydrated && items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
          <Heart className="mx-auto h-14 w-14 text-gray-300" />
          <h2 className="text-lg font-semibold text-foreground mt-5">Your wishlist is empty</h2>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
            Save products you love by tapping the heart icon. Your wishlist helps you keep track of items you want to buy later.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-6 rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
          >
            <ShoppingBag className="h-4 w-4" />
            Browse Products
          </Link>
        </div>
      ) : hydrated ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <article key={item.productId} className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
              <Link href={`/product/${item.slug || item.productId}`} className="block aspect-square bg-gray-100 relative">
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
                    <Package className="h-10 w-10 text-gray-300" />
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
                  <p className="text-xs text-gray-500 truncate">{item.storeName}</p>
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
                    onClick={() => remove(item.productId)}
                    aria-label="Remove from wishlist"
                    className="inline-flex items-center justify-center rounded-full border border-gray-200 px-3 text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </main>
  )
}
