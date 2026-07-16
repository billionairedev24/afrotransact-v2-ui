"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ShoppingCart, AlertCircle, Loader2 } from "lucide-react"
import { useCartStore, type CartItem } from "@/stores/cart-store"

interface ResumeItem {
  product_id: string | null
  variant_id: string | null
  store_id: string | null
  product_title: string | null
  variant_name: string | null
  image_url: string | null
  quantity: number
  unit_price_cents: number
}

interface ResumeResponse {
  order_id: string
  order_number: string
  subtotal_cents: number
  currency: string
  items: ResumeItem[]
}

// Distinct failure states so we stop labeling every problem "expired" — a bad
// token (401), a missing order (404), a server error, and an empty cart are
// different situations with different copy.
type LoadState = "loading" | "ok" | "expired" | "unavailable" | "empty"

export default function CartResumePage() {
  const params = useSearchParams()
  const router = useRouter()
  const setItems = useCartStore((s) => s.setItems)

  const [state, setState] = useState<LoadState>("loading")

  useEffect(() => {
    const token = params.get("token")
    if (!token) {
      setState("expired")
      return
    }

    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/public/cart/resume?token=${encodeURIComponent(token!)}`, {
          cache: "no-store",
        })
        if (!res.ok) {
          // 401 = token truly invalid/expired; anything else = we couldn't load
          // the cart (order missing, upstream error) — not the buyer's fault and
          // NOT an expiry.
          if (!cancelled) setState(res.status === 401 ? "expired" : "unavailable")
          return
        }
        const data = (await res.json()) as ResumeResponse
        if (!data || !Array.isArray(data.items) || data.items.length === 0) {
          if (!cancelled) setState("empty")
          return
        }

        // Only product_id is truly required to rehydrate a line. variant_id /
        // store_id can be absent on some historical items; default them rather
        // than dropping the item (which used to empty a valid cart and surface
        // a false "expired").
        const items: CartItem[] = data.items
          .filter((it): it is ResumeItem & { product_id: string } => Boolean(it.product_id))
          .map((it) => ({
            productId: it.product_id as string,
            variantId: it.variant_id ?? "",
            storeId: it.store_id ?? "",
            storeName: "",
            title: it.product_title ?? "Item",
            variantName: it.variant_name ?? "",
            price: it.unit_price_cents,
            quantity: it.quantity,
            imageUrl: it.image_url ?? undefined,
            slug: "",
          }))

        if (items.length === 0) {
          if (!cancelled) setState("empty")
          return
        }

        setItems(items)
        if (!cancelled) {
          setState("ok")
          router.replace("/cart")
        }
      } catch {
        if (!cancelled) setState("unavailable")
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [params, router, setItems])

  if (state === "loading" || state === "ok") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-gold" aria-hidden />
        <p className="mt-4 text-sm text-gray-600">Rehydrating your cart…</p>
      </div>
    )
  }

  const copy = {
    expired: {
      title: "This link is no longer valid",
      body: "Recovery links expire after 7 days or once your cart has been restored. Your items may still be available — head back and we'll help you find them.",
    },
    unavailable: {
      title: "We couldn't open your cart",
      body: "Something went wrong on our end while restoring your cart. Please try again in a moment, or browse and we'll help you find your items.",
    },
    empty: {
      title: "Your saved cart is empty",
      body: "The items in this cart are no longer available. Browse AfroTransact for fresh picks from stores near you.",
    },
  }[state]

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="rounded-full bg-red-50 p-3">
        <AlertCircle className="h-6 w-6 text-red-600" aria-hidden />
      </div>
      <h1 className="mt-4 text-xl font-bold text-gray-900">{copy.title}</h1>
      <p className="mt-2 max-w-md text-sm text-gray-600">{copy.body}</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-gold px-6 py-3 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold/90"
      >
        <ShoppingCart className="h-4 w-4" aria-hidden />
        Back to AfroTransact
      </Link>
    </div>
  )
}
