"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useCartStore, type CartItem, loadGuestCart, clearGuestCart, saveGuestCart } from "@/stores/cart-store"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface ServerCartItem {
  id: string
  variantId: string
  productId: string
  storeId: string
  quantity: number
  unitPriceCents: number
  productTitle?: string
  variantName?: string
  imageUrl?: string
}

interface ServerCart {
  id: string
  items: ServerCartItem[]
}

export function CartMergeProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const hasMerged = useRef(false)
  const prevStatus = useRef(status)

  // ── Authenticated: merge guest cart → server, then hydrate from server ──
  useEffect(() => {
    if (status !== "authenticated" || !session?.accessToken || hasMerged.current) return

    hasMerged.current = true
    const token = session.accessToken as string
    const guestItems = loadGuestCart()

    async function mergeAndSync() {
      try {
        // Push any guest items to server
        if (guestItems.length > 0) {
          const payload = guestItems.map((item) => ({
            variantId: item.variantId,
            productId: item.productId,
            storeId: item.storeId,
            quantity: item.quantity,
            unitPriceCents: item.price,
            productTitle: item.title,
            variantName: item.variantName,
            imageUrl: item.imageUrl,
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

        // Fetch the authoritative server cart
        const res = await fetch(`${API_BASE}/api/v1/cart`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const serverCart: ServerCart = await res.json()
          const merged: CartItem[] = serverCart.items.map((si) => ({
            productId: si.productId,
            variantId: si.variantId,
            storeId: si.storeId,
            storeName: si.storeId,
            title: si.productTitle ?? "Product",
            variantName: si.variantName ?? "",
            price: si.unitPriceCents,
            quantity: si.quantity,
            imageUrl: si.imageUrl,
            slug: si.productId,
          }))
          useCartStore.getState().setItems(merged)
        }

        // Clear guest localStorage — server is now the source of truth
        clearGuestCart()
      } catch (err) {
        console.warn("[CartMerge] merge/sync failed (non-blocking):", err)
        hasMerged.current = false
      }
    }

    mergeAndSync()
  }, [status, session])

  // ── Unauthenticated: hydrate from guest localStorage ──
  useEffect(() => {
    if (status === "unauthenticated") {
      const guestItems = loadGuestCart()
      if (guestItems.length > 0) {
        useCartStore.getState().setItems(guestItems)
      }
    }
    prevStatus.current = status
  }, [status])

  // ── Guest auto-save: persist cart changes to localStorage when not authenticated ──
  useEffect(() => {
    const unsub = useCartStore.subscribe((state) => {
      if (prevStatus.current !== "authenticated") {
        saveGuestCart(state.items)
      }
    })
    return unsub
  }, [])

  return <>{children}</>
}
