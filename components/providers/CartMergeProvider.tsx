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

/**
 * A user is "buyer-capable" iff their roles list includes "buyer" OR has no
 * roles at all (default buyer). Admin/seller-only sessions skip the entire
 * cart-sync lifecycle — no /api/v1/cart calls, no auth mode flip — to avoid
 * pointless server traffic + 404s in admin/seller surfaces.
 */
function isBuyerCapableRoles(roles: string[] | undefined | null): boolean {
  if (!roles || roles.length === 0) return true
  return roles.includes("buyer")
}

export function CartMergeProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [cartReady, setCartReady] = useState(false)
  const hydratedForToken = useRef<string | null>(null)
  const isAuthenticatedRef = useRef(false)

  const roles = (session?.user as { roles?: string[] } | undefined)?.roles
  const isBuyerCapable = isBuyerCapableRoles(roles)

  useEffect(() => {
    // Treat non-buyer (admin/seller-only) sessions as "not authenticated" for
    // cart purposes: subscriber below persists to sessionStorage as guest.
    isAuthenticatedRef.current = status === "authenticated" && isBuyerCapable
  }, [status, isBuyerCapable])

  // ── Authenticated buyer: merge guest cart → server, hydrate canonical cart, flip mode ──
  useEffect(() => {
    if (status !== "authenticated") return
    if (!isBuyerCapable) {
      // Admin/seller-only session — no buyer cart. Stay in guest mode, no API calls.
      hydratedForToken.current = null
      useCartStore.setState({
        items: [],
        mode: "guest",
        serverItemIds: {},
        syncing: false,
      })
      setCartReady(true)
      return
    }
    const token = session?.accessToken as string | undefined
    if (!token) return
    if (hydratedForToken.current === token) return
    hydratedForToken.current = token

    setCartReady(false)
    const guestItems = loadGuestCart()
    const localItemsAtStart = useCartStore.getState().items
    const seedItems = guestItems.length > 0 ? guestItems : localItemsAtStart

    const hadLocalItemsAtAuth = seedItems.length > 0

    ;(async () => {
      try {
        const dto = hadLocalItemsAtAuth
          ? await mergeCart(token, toMergePayload(seedItems))
          : await getCart(token)
        useCartStore.getState().replaceFromServer(dto)
        useCartStore.getState().setMode("auth")
        clearGuestCart()
        if (hadLocalItemsAtAuth) {
          try {
            const mergedCount = seedItems.reduce((n, i) => n + i.quantity, 0)
            sessionStorage.setItem(
              "at:cart:merge-notice",
              JSON.stringify({ at: Date.now(), count: mergedCount }),
            )
          } catch {
            // non-critical
          }
        }
      } catch (e) {
        logError(e, "cart hydrate on auth")
        // Don't drop local items if hydration failed; just flip mode so future
        // mutations attempt server sync (next mutation will hit the server).
        useCartStore.getState().setMode("auth")
      } finally {
        setCartReady(true)
      }
    })()
  }, [status, session?.accessToken, isBuyerCapable])

  // Authenticated but no access token yet — don't block the UI forever.
  useEffect(() => {
    if (status !== "authenticated") return
    if (!isBuyerCapable) return
    if (session?.accessToken) return
    setCartReady(true)
  }, [status, session?.accessToken, isBuyerCapable])

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
