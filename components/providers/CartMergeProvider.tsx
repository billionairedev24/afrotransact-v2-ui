"use client"

/**
 * CartSyncBoundary (legacy name: CartMergeProvider).
 *
 * Owns the lifecycle handoff between guest (sessionStorage) and authenticated
 * (server-backed) cart modes. Per-mutation server sync is owned by
 * `stores/cart-store.ts` itself — this boundary only does:
 *
 *   - guest → guest:        hydrate from sessionStorage; persist on change.
 *   - guest → authenticated: mergeCart(local items) → replace store from the
 *                            server's canonical CartDto; flip store.mode = "auth".
 *   - authenticated → guest: clear local cart (do NOT call server); flip mode.
 *   - tab mount (already auth): getCart() → replaceFromServer.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useSession } from "next-auth/react"
import {
  useCartStore,
  loadGuestCart,
  clearGuestCart,
  saveGuestCart,
  type CartItem,
} from "@/stores/cart-store"
import { getCart, mergeCart } from "@/lib/api"
import { logError } from "@/lib/errors"

const CartHydrationContext = createContext({ cartReady: false })

export function useCartHydration() {
  return useContext(CartHydrationContext)
}

function toMergePayload(items: CartItem[]) {
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

export function CartMergeProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [cartReady, setCartReady] = useState(false)
  const hydratedForToken = useRef<string | null>(null)
  const isAuthenticatedRef = useRef(false)

  useEffect(() => {
    isAuthenticatedRef.current = status === "authenticated"
  }, [status])

  // ── Authenticated: merge guest cart → server, hydrate canonical cart, flip mode ──
  useEffect(() => {
    if (status !== "authenticated") return
    const token = session?.accessToken as string | undefined
    if (!token) return
    if (hydratedForToken.current === token) return
    hydratedForToken.current = token

    setCartReady(false)
    const guestItems = loadGuestCart()
    const localItemsAtStart = useCartStore.getState().items
    const seedItems = guestItems.length > 0 ? guestItems : localItemsAtStart

    ;(async () => {
      try {
        const dto = seedItems.length > 0
          ? await mergeCart(token, toMergePayload(seedItems))
          : await getCart(token)
        useCartStore.getState().replaceFromServer(dto)
        useCartStore.getState().setMode("auth")
        clearGuestCart()
      } catch (e) {
        logError(e, "cart hydrate on auth")
        // Don't drop local items if hydration failed; just flip mode so future
        // mutations attempt server sync (next mutation will hit the server).
        useCartStore.getState().setMode("auth")
      } finally {
        setCartReady(true)
      }
    })()
  }, [status, session?.accessToken])

  // Authenticated but no access token yet — don't block the UI forever.
  useEffect(() => {
    if (status !== "authenticated") return
    if (session?.accessToken) return
    setCartReady(true)
  }, [status, session?.accessToken])

  // ── Unauthenticated: hydrate from guest sessionStorage; reset mode + cached server ids. ──
  useEffect(() => {
    if (status !== "unauthenticated") return
    hydratedForToken.current = null
    const guestItems = loadGuestCart()
    useCartStore.setState({
      items: guestItems,
      mode: "guest",
      serverItemIds: {},
      syncing: false,
    })
    setCartReady(true)
  }, [status])

  // ── Guest: persist cart to sessionStorage as it changes. ──
  useEffect(() => {
    if (status === "loading") return
    const unsub = useCartStore.subscribe((state) => {
      if (!isAuthenticatedRef.current) {
        saveGuestCart(state.items)
      }
    })
    return unsub
  }, [status])

  const value = useMemo(() => ({ cartReady }), [cartReady])

  return (
    <CartHydrationContext.Provider value={value}>
      {children}
    </CartHydrationContext.Provider>
  )
}
