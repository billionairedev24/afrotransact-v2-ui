import { create } from "zustand"
import { toast } from "sonner"
import {
  trackEvent,
  addToCart,
  updateCartItemQty,
  removeCartItem as apiRemoveCartItem,
  clearServerCart,
  ApiError,
  type CartDto,
} from "@/lib/api"
import { getAccessToken } from "@/lib/auth-helpers"
import { friendlyMessage, logError } from "@/lib/errors"

export interface CartItem {
  productId: string
  variantId: string
  storeId: string
  storeName: string
  title: string
  variantName: string
  price: number
  quantity: number
  imageUrl?: string
  slug: string
  weightKg?: number | null
  lengthIn?: number | null
  widthIn?: number | null
  heightIn?: number | null
}

type CartMode = "guest" | "auth"

interface CartState {
  items: CartItem[]
  mode: CartMode
  syncing: boolean
  /** variantId -> server cart_item.id (only populated in "auth" mode). */
  serverItemIds: Record<string, string>
  addItem: (item: CartItem) => void
  removeItem: (variantId: string) => void
  updateQuantity: (variantId: string, quantity: number) => void
  setItems: (items: CartItem[]) => void
  clearCart: () => void
  setMode: (mode: CartMode) => void
  /** Replace local state with the server's canonical CartDto. */
  replaceFromServer: (dto: CartDto) => void
  getItemCount: () => number
  getSubtotal: () => number
  getItemsByStore: () => Map<string, CartItem[]>
}

// Cart is server-only. Guest persistence retired: no sessionStorage, no
// localStorage, no cross-session merges. Callers must be authenticated to
// mutate the cart. These shims stay callable so existing imports compile
// and any stale storage entries get purged on first invocation.
const LEGACY_GUEST_CART_KEY = "afrotransact-guest-cart"

export function saveGuestCart(_items: CartItem[]) { /* no-op */ }
export function loadGuestCart(): CartItem[] { return [] }
export function clearGuestCart() {
  try {
    sessionStorage.removeItem(LEGACY_GUEST_CART_KEY)
    localStorage.removeItem(LEGACY_GUEST_CART_KEY)
    sessionStorage.removeItem("at:cart:merge-notice")
  } catch {
    // storage unavailable
  }
}

function dtoToItems(dto: CartDto, fallbackByVariant: Record<string, CartItem>): CartItem[] {
  return dto.items.map((si) => {
    const fb = fallbackByVariant[si.variantId]
    return {
      productId: si.productId,
      variantId: si.variantId,
      storeId: si.storeId,
      storeName: fb?.storeName ?? si.storeId,
      title: si.productTitle ?? fb?.title ?? "Product",
      variantName: si.variantName ?? fb?.variantName ?? "",
      price: si.unitPriceCents,
      quantity: si.quantity,
      imageUrl: si.imageUrl ?? fb?.imageUrl,
      slug: fb?.slug ?? si.productId,
      weightKg: si.weightKg ?? fb?.weightKg ?? null,
      lengthIn: si.lengthIn ?? fb?.lengthIn ?? null,
      widthIn: si.widthIn ?? fb?.widthIn ?? null,
      heightIn: si.heightIn ?? fb?.heightIn ?? null,
    }
  })
}

function dtoToServerItemIds(dto: CartDto): Record<string, string> {
  const out: Record<string, string> = {}
  for (const si of dto.items) out[si.variantId] = si.id
  return out
}

// ── Debounce per-variant for quantity updates ──
const quantityTimers = new Map<string, ReturnType<typeof setTimeout>>()
const QUANTITY_DEBOUNCE_MS = 300

// ── Single-flight server queue per variant so retries don't interleave ──
const inflight = new Map<string, Promise<void>>()

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e
    // transient — retry once after 1s
    await new Promise((r) => setTimeout(r, 1000))
    return fn()
  }
}

function shouldUseServer(): boolean {
  return useCartStore.getState().mode === "auth"
}

async function withSync<T>(key: string, fn: () => Promise<T>): Promise<T> {
  useCartStore.setState({ syncing: true })
  try {
    return await fn()
  } finally {
    // Delete first, THEN decide whether to clear the spinner. The previous
    // ordering relied on an outer `.finally(() => inflight.delete(key))`
    // chained by the caller, which runs AFTER this block — so the size check
    // here always saw the current key still present and never flipped
    // syncing back to false, leaving the header spinner stuck.
    inflight.delete(key)
    if (inflight.size === 0) useCartStore.setState({ syncing: false })
  }
}

function reportError(e: unknown, context: string, fallback: string) {
  logError(e, context)
  toast.error(friendlyMessage(e, fallback))
}

async function serverAdd(item: CartItem): Promise<void> {
  const token = await getAccessToken()
  if (!token) return
  const key = `add:${item.variantId}`
  const run = withSync(key, () =>
    withRetry(async () => {
      const dto = await addToCart(token, {
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
      })
      useCartStore.getState().replaceFromServer(dto)
    }),
  )
  inflight.set(key, run)
  try {
    await run
  } catch (e) {
    // revert: remove the item we optimistically added (only the delta if it existed)
    useCartStore.getState().removeItem(item.variantId)
    reportError(e, "cart add", e instanceof ApiError && e.status === 409
      ? "That item is out of stock"
      : "Could not add to cart")
  }
}

async function serverUpdate(variantId: string, quantity: number, prevQty: number): Promise<void> {
  const token = await getAccessToken()
  if (!token) return
  const serverId = useCartStore.getState().serverItemIds[variantId]
  if (!serverId) return // not yet hydrated; merge sync will reconcile
  const key = `upd:${variantId}`
  const run = withSync(key, () =>
    withRetry(async () => {
      const dto = quantity <= 0
        ? await apiRemoveCartItem(token, serverId)
        : await updateCartItemQty(token, serverId, quantity)
      useCartStore.getState().replaceFromServer(dto)
    }),
  )
  inflight.set(key, run)
  try {
    await run
  } catch (e) {
    // revert
    useCartStore.setState((s) => ({
      items: prevQty <= 0
        ? s.items.filter((i) => i.variantId !== variantId)
        : s.items.some((i) => i.variantId === variantId)
          ? s.items.map((i) => i.variantId === variantId ? { ...i, quantity: prevQty } : i)
          : s.items,
    }))
    reportError(e, "cart update", e instanceof ApiError && e.status === 409
      ? "Not enough stock for that quantity"
      : "Could not update cart")
  }
}

async function serverRemove(variantId: string, prevItem: CartItem | undefined): Promise<void> {
  const token = await getAccessToken()
  if (!token || !prevItem) return
  const serverId = useCartStore.getState().serverItemIds[variantId]
  if (!serverId) return
  const key = `del:${variantId}`
  const run = withSync(key, () =>
    withRetry(async () => {
      const dto = await apiRemoveCartItem(token, serverId)
      useCartStore.getState().replaceFromServer(dto)
    }),
  )
  inflight.set(key, run)
  try {
    await run
  } catch (e) {
    useCartStore.setState((s) => ({ items: [...s.items, prevItem] }))
    reportError(e, "cart remove", "Could not remove item")
  }
}

async function serverClear(): Promise<void> {
  const token = await getAccessToken()
  if (!token) return
  try {
    await withSync("clear:all", () => withRetry(() => clearServerCart(token)))
    useCartStore.setState({ serverItemIds: {} })
  } catch (e) {
    reportError(e, "cart clear", "Could not clear cart")
  }
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  mode: "guest",
  syncing: false,
  serverItemIds: {},

  addItem: (item) => {
    trackEvent({ event_type: "cart_add", product_id: item.productId })
    set((state) => {
      const existing = state.items.find((i) => i.variantId === item.variantId)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.variantId === item.variantId
              ? { ...i, quantity: i.quantity + item.quantity }
              : i,
          ),
        }
      }
      return { items: [...state.items, item] }
    })
    if (shouldUseServer()) void serverAdd(item)
  },

  removeItem: (variantId) => {
    const prev = get().items.find((i) => i.variantId === variantId)
    set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) }))
    if (shouldUseServer()) void serverRemove(variantId, prev)
  },

  updateQuantity: (variantId, quantity) => {
    const prevQty = get().items.find((i) => i.variantId === variantId)?.quantity ?? 0
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((i) => i.variantId !== variantId)
          : state.items.map((i) =>
              i.variantId === variantId ? { ...i, quantity } : i,
            ),
    }))
    if (shouldUseServer()) {
      // Debounce rapid +/- presses per item
      const existing = quantityTimers.get(variantId)
      if (existing) clearTimeout(existing)
      const t = setTimeout(() => {
        quantityTimers.delete(variantId)
        void serverUpdate(variantId, quantity, prevQty)
      }, QUANTITY_DEBOUNCE_MS)
      quantityTimers.set(variantId, t)
    }
  },

  setItems: (items) => set({ items }),

  clearCart: () => {
    set({ items: [], serverItemIds: {} })
    if (shouldUseServer()) void serverClear()
  },

  setMode: (mode) => set({ mode }),

  replaceFromServer: (dto) => {
    const fallbackByVariant: Record<string, CartItem> = {}
    for (const i of get().items) fallbackByVariant[i.variantId] = i
    const nextItems = dtoToItems(dto, fallbackByVariant)
    // Guard against silent data loss: if the server says "your cart is
    // empty" but we have local items, do NOT wipe. This is almost always
    // a transient sync race (silent token refresh that arrived before
    // the server saw the latest add), not a real user-driven clear. The
    // explicit clearCart() path is what zeros things out.
    if (nextItems.length === 0 && get().items.length > 0) {
      set({ serverItemIds: dtoToServerItemIds(dto) })
      return
    }
    set({
      items: nextItems,
      serverItemIds: dtoToServerItemIds(dto),
    })
  },

  getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
  getSubtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  getItemsByStore: () => {
    const map = new Map<string, CartItem[]>()
    for (const item of get().items) {
      const existing = map.get(item.storeId) || []
      existing.push(item)
      map.set(item.storeId, existing)
    }
    return map
  },
}))
