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

type LoadState = "loading" | "ok" | "error"

export default function CartResumePage() {
  const params = useSearchParams()
  const router = useRouter()
  const setItems = useCartStore((s) => s.setItems)

  const [state, setState] = useState<LoadState>("loading")

  useEffect(() => {
    const token = params.get("token")
    if (!token) {
      setState("error")
      return
    }

    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/public/cart/resume?token=${encodeURIComponent(token!)}`, {
          cache: "no-store",
        })
        if (!res.ok) {
          if (!cancelled) setState("error")
          return
        }
        const data = (await res.json()) as ResumeResponse
        if (!data || !Array.isArray(data.items) || data.items.length === 0) {
          if (!cancelled) setState("error")
          return
        }

        const items: CartItem[] = data.items
          .filter((it): it is ResumeItem & { product_id: string; variant_id: string; store_id: string } =>
            Boolean(it.product_id) && Boolean(it.variant_id) && Boolean(it.store_id),
          )
          .map((it) => ({
            productId: it.product_id,
            variantId: it.variant_id,
            storeId: it.store_id,
            storeName: "",
            title: it.product_title ?? "Item",
            variantName: it.variant_name ?? "",
            price: it.unit_price_cents,
            quantity: it.quantity,
            imageUrl: it.image_url ?? undefined,
            slug: "",
          }))

        if (items.length === 0) {
          if (!cancelled) setState("error")
          return
        }

        setItems(items)
        if (!cancelled) {
          setState("ok")
          router.replace("/cart")
        }
      } catch {
        if (!cancelled) setState("error")
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

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="rounded-full bg-red-50 p-3">
        <AlertCircle className="h-6 w-6 text-red-600" aria-hidden />
      </div>
      <h1 className="mt-4 text-xl font-bold text-gray-900">This link has expired</h1>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        Cart-recovery links are valid for 7 days. The items may still be available — head back
        to AfroTransact and we&apos;ll help you find them.
      </p>
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
