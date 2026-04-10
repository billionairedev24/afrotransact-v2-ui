"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useSession } from "next-auth/react"
import { useCartStore, type CartItem, loadGuestCart, clearGuestCart, saveGuestCart } from "@/stores/cart-store"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

const CartHydrationContext = createContext({ cartReady: false })

export function useCartHydration() {
  return useContext(CartHydrationContext)
}

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
  weightKg?: number | null
  lengthIn?: number | null
  widthIn?: number | null
  heightIn?: number | null
}

interface ServerCart {
  id: string
  items: ServerCartItem[]
}

function serverItemsToCartItems(serverCart: ServerCart): CartItem[] {
  return serverCart.items.map((si) => ({
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
    weightKg: si.weightKg ?? null,
    lengthIn: si.lengthIn ?? null,
    widthIn: si.widthIn ?? null,
    heightIn: si.heightIn ?? null,
  }))
}

function cartItemsToMergePayload(items: CartItem[]) {
  return items.map((item) => ({
    variantId: item.variantId,
    productId: item.productId,
    storeId: item.storeId,
    quantity: item.quantity,
    unitPriceCents: item.price,
    productTitle: item.title,
    variantName: item.variantName,
    imageUrl: item.imageUrl,
    weightKg: item.weightKg ?? null,
    lengthIn: item.lengthIn ?? null,
    widthIn: item.widthIn ?? null,
    heightIn: item.heightIn ?? null,
  }))
}

function mergeCartItemsPreferHigherQty(a: CartItem[], b: CartItem[]): CartItem[] {
  const byVariant = new Map<string, CartItem>()
  for (const item of [...a, ...b]) {
    const prev = byVariant.get(item.variantId)
    if (!prev || item.quantity > prev.quantity) {
      byVariant.set(item.variantId, item)
    }
  }
  return Array.from(byVariant.values())
}

export function CartMergeProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [cartReady, setCartReady] = useState(false)
  const hasMerged = useRef(false)
  const allowServerCartPush = useRef(false)
  const isAuthenticatedRef = useRef(false)

  useEffect(() => {
    isAuthenticatedRef.current = status === "authenticated"
  }, [status])

  useEffect(() => {
    if (status === "loading") {
      setCartReady(false)
      return
    }
    if (status === "authenticated") {
      setCartReady(false)
    }
  }, [status])

  // ── Authenticated: merge guest cart → server, hydrate from server, then allow push sync ──
  useEffect(() => {
    if (status !== "authenticated" || !session?.accessToken || hasMerged.current) return

    hasMerged.current = true
    allowServerCartPush.current = false
    const token = session.accessToken as string
    const guestItems = loadGuestCart()
    const localItemsAtStart = useCartStore.getState().items

    async function mergeAndSync() {
      try {
        if (guestItems.length > 0) {
          await fetch(`${API_BASE}/api/v1/cart/merge`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(cartItemsToMergePayload(guestItems)),
          })
        }

        const res = await fetch(`${API_BASE}/api/v1/cart`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const serverCart: ServerCart = await res.json()
          const serverItems = serverItemsToCartItems(serverCart)
          // Prevent race-loss: preserve any local cart edits made before hydration completed.
          const merged = mergeCartItemsPreferHigherQty(serverItems, localItemsAtStart)
          useCartStore.getState().setItems(merged)
          if (merged.length > 0) {
            await fetch(`${API_BASE}/api/v1/cart/merge`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(cartItemsToMergePayload(merged)),
            })
          }
          allowServerCartPush.current = true
        } else {
          // If initial read fails, still allow push-sync to avoid dropping local authenticated cart edits.
          allowServerCartPush.current = true
        }

        clearGuestCart()
      } catch (err) {
        console.warn("[CartMerge] merge/sync failed (non-blocking):", err)
        hasMerged.current = false
      } finally {
        setCartReady(true)
      }
    }

    mergeAndSync()
  }, [status, session])

  // Authenticated but no access token yet (or refresh failed): don't block the UI forever.
  useEffect(() => {
    if (status !== "authenticated") return
    if (session?.accessToken) return
    setCartReady(true)
  }, [status, session?.accessToken])

  // ── Unauthenticated: hydrate from guest sessionStorage; reset merge state for next login ──
  useEffect(() => {
    if (status !== "unauthenticated") return
    hasMerged.current = false
    allowServerCartPush.current = false
    const guestItems = loadGuestCart()
    if (guestItems.length > 0) {
      useCartStore.getState().setItems(guestItems)
    }
    setCartReady(true)
  }, [status])

  // ── Guest: persist cart to sessionStorage (only after auth status is known).
  // While status is "loading", isAuthenticatedRef is false; subscribing immediately would
  // save an empty in-memory cart and wipe sessionStorage before guest hydration runs.
  useEffect(() => {
    if (status === "loading") return
    const unsub = useCartStore.subscribe((state) => {
      if (!isAuthenticatedRef.current) {
        saveGuestCart(state.items)
      }
    })
    return unsub
  }, [status])

  // ── Authenticated: keep server cart in sync with the store (debounced) ──
  useEffect(() => {
    if (status !== "authenticated" || !session?.accessToken) return
    const token = session.accessToken as string
    let debounce: ReturnType<typeof setTimeout>

    const unsub = useCartStore.subscribe((state) => {
      if (!allowServerCartPush.current) return
      clearTimeout(debounce)
      debounce = setTimeout(async () => {
        try {
          await fetch(`${API_BASE}/api/v1/cart/merge`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(cartItemsToMergePayload(state.items)),
          })
        } catch (e) {
          console.warn("[CartMerge] server sync failed:", e)
        }
      }, 450)
    })

    return () => {
      clearTimeout(debounce)
      unsub()
    }
  }, [status, session?.accessToken])

  const value = useMemo(() => ({ cartReady }), [cartReady])

  return (
    <CartHydrationContext.Provider value={value}>
      {children}
    </CartHydrationContext.Provider>
  )
}
