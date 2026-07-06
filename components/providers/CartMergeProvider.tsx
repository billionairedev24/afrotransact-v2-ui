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
  // Admins shop too — they need to test the marketplace end-to-end and
  // are real customers in their own right. Excluding them put admin
  // sessions into a guest-only cart mode that surprised everyone.
  // Only seller-ONLY sessions (no buyer/admin) skip cart sync.
  return roles.includes("buyer") || roles.includes("admin")
}

export function CartMergeProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [cartReady, setCartReady] = useState(false)
  // Key hydration by STABLE user identity (Keycloak sub), not by the
  // access-token string. The access token rotates every few minutes via
  // silent refresh; if we keyed by token value, every refresh would
  // re-hydrate from the server — and if the server returned an empty
  // cart (transient 401, abandoned-cart sweep, or just a stale token
  // moment) we'd wipe the buyer's local items. Keying by user id pins
  // hydration to "this user, this tab" — once per real login.
  const hydratedForUser = useRef<string | null>(null)
  const isAuthenticatedRef = useRef(false)
  // Tracks whether THIS tab has ever observed an authenticated session.
  // The unauthenticated-mount effect uses this to distinguish a true
  // first-mount-as-guest from a token blip mid-session — only the former
  // should overwrite the in-memory cart from sessionStorage.
  const everAuthedInTab = useRef(false)

  const roles = (session?.user as { roles?: string[] } | undefined)?.roles
  const isBuyerCapable = isBuyerCapableRoles(roles)

  // Cart is server-only now — purge any legacy sessionStorage/localStorage
  // entries left behind by the retired guest-cart path so a returning
  // buyer never sees a stale "previous session" merge again.
  useEffect(() => {
    clearGuestCart()
  }, [])

  useEffect(() => {
    // Treat non-buyer (admin/seller-only) sessions as "not authenticated" for
    // cart purposes: subscriber below persists to sessionStorage as guest.
    isAuthenticatedRef.current = status === "authenticated" && isBuyerCapable
    if (isAuthenticatedRef.current) {
      everAuthedInTab.current = true
    }
  }, [status, isBuyerCapable])

  // ── Authenticated buyer: merge guest cart → server, hydrate canonical cart, flip mode ──
  useEffect(() => {
    if (status !== "authenticated") return
    if (!isBuyerCapable) {
      // Admin/seller-only session — no buyer cart, no API calls. Do NOT
      // wipe existing items either: buyers regularly nip into /admin or
      // /dashboard and back; wiping on that transition destroys their
      // in-progress cart. Items harmlessly sit in memory. If they never
      // return to the buyer surface, browser lifecycle cleans up.
      setCartReady(true)
      return
    }
    const token = session?.accessToken as string | undefined
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!token || !userId) return
    if (hydratedForUser.current === userId) return
    hydratedForUser.current = userId

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
        // Cart is server-only now — no merge notice, no session persistence.
      } catch (e) {
        logError(e, "cart hydrate on auth")
        // Don't drop local items if hydration failed; just flip mode so future
        // mutations attempt server sync (next mutation will hit the server).
        useCartStore.getState().setMode("auth")
      } finally {
        setCartReady(true)
      }
    })()
    // Intentionally NOT depending on session.accessToken — that string rotates
    // on every silent refresh and would re-trigger hydrate, wiping local cart
    // items if the server returned an empty cart. We re-run only when the
    // user identity itself changes (login/logout).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, (session?.user as { id?: string } | undefined)?.id, isBuyerCapable])

  // Authenticated but no access token yet — don't block the UI forever.
  useEffect(() => {
    if (status !== "authenticated") return
    if (!isBuyerCapable) return
    if (session?.accessToken) return
    setCartReady(true)
  }, [status, session?.accessToken, isBuyerCapable])

  // ── Unauthenticated: hydrate from guest sessionStorage; reset mode + cached server ids. ──
  //
  // Critical: only seed items from guest storage on a TRUE first mount as
  // guest. If we've already observed an authenticated session in this tab
  // and the status just flipped to "unauthenticated" (silent token failure,
  // explicit signOut, NextAuth refresh blip), do NOT overwrite the
  // in-memory cart from sessionStorage — that storage was deliberately
  // not kept in sync during auth mode (see subscriber below) and would
  // typically be empty or stale, causing the cart to vanish visually.
  // The server cart is the source of truth and re-hydrates on next login.
  useEffect(() => {
    if (status !== "unauthenticated") return
    hydratedForUser.current = null
    if (everAuthedInTab.current) {
      // Mid-session auth loss: flip mode + drop server-side ids so a
      // re-login starts clean, but keep whatever items the user can still
      // see. They'll be re-reconciled against the server on next login.
      useCartStore.setState({
        mode: "guest",
        serverItemIds: {},
        syncing: false,
      })
      setCartReady(true)
      return
    }
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
