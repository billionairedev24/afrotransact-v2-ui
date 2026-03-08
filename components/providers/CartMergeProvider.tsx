"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useCartStore, type CartItem } from "@/stores/cart-store"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface ServerCartItem {
  id: string
  variantId: string
  productId: string
  storeId: string
  quantity: number
  unitPriceCents: number
}

interface ServerCart {
  id: string
  items: ServerCartItem[]
}

export function CartMergeProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const hasMerged = useRef(false)

  useEffect(() => {
    if (status !== "authenticated" || !session?.accessToken || hasMerged.current) return

    hasMerged.current = true
    const token = session.accessToken as string
    const localItems = useCartStore.getState().items

    async function mergeAndSync() {
      try {
        if (localItems.length > 0) {
          const payload = localItems.map((item) => ({
            variantId: item.variantId,
            productId: item.productId,
            storeId: item.storeId,
            quantity: item.quantity,
            unitPriceCents: item.price,
          }))

          await fetch(`${API_BASE}/api/v1/cart/merge`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          })
        }

        const res = await fetch(`${API_BASE}/api/v1/cart`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const serverCart: ServerCart = await res.json()
          const merged: CartItem[] = serverCart.items.map((si) => {
            const local = localItems.find((li) => li.variantId === si.variantId)
            return {
              productId: si.productId,
              variantId: si.variantId,
              storeId: si.storeId,
              storeName: local?.storeName ?? si.storeId,
              title: local?.title ?? "Product",
              variantName: local?.variantName ?? "",
              price: si.unitPriceCents,
              quantity: si.quantity,
              imageUrl: local?.imageUrl,
              slug: local?.slug ?? si.productId,
            }
          })
          useCartStore.getState().setItems(merged)
        }
      } catch (err) {
        console.warn("[CartMerge] merge/sync failed (non-blocking):", err)
        hasMerged.current = false
      }
    }

    mergeAndSync()
  }, [status, session])

  return <>{children}</>
}
