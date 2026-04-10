import { create } from "zustand"

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

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (variantId: string) => void
  updateQuantity: (variantId: string, quantity: number) => void
  setItems: (items: CartItem[]) => void
  clearCart: () => void
  getItemCount: () => number
  getSubtotal: () => number
  getItemsByStore: () => Map<string, CartItem[]>
}

/** Per-tab session storage: cleared when the tab/window closes so the next visitor does not inherit a guest cart. */
const GUEST_CART_KEY = "afrotransact-guest-cart"

function readGuestCartRaw(): string | null {
  try {
    const fromSession = sessionStorage.getItem(GUEST_CART_KEY)
    if (fromSession) return fromSession
    const legacy = localStorage.getItem(GUEST_CART_KEY)
    if (legacy) {
      sessionStorage.setItem(GUEST_CART_KEY, legacy)
      localStorage.removeItem(GUEST_CART_KEY)
      return legacy
    }
  } catch {
    // storage unavailable
  }
  return null
}

/** Save current items to sessionStorage (guest only). */
export function saveGuestCart(items: CartItem[]) {
  try {
    sessionStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
  } catch {
    // storage full or unavailable — non-critical
  }
}

/** Load guest cart from sessionStorage (migrates legacy localStorage once). */
export function loadGuestCart(): CartItem[] {
  try {
    const raw = readGuestCartRaw()
    if (raw) return JSON.parse(raw) as CartItem[]
  } catch {
    // corrupted data — ignore
  }
  return []
}

/** Remove guest cart from session + any legacy localStorage copy. */
export function clearGuestCart() {
  try {
    sessionStorage.removeItem(GUEST_CART_KEY)
    localStorage.removeItem(GUEST_CART_KEY)
  } catch {
    // non-critical
  }
}

export const useCartStore = create<CartState>()(
  (set, get) => ({
    items: [],
    addItem: (item) =>
      set((state) => {
        const existing = state.items.find((i) => i.variantId === item.variantId)
        if (existing) {
          return {
            items: state.items.map((i) =>
              i.variantId === item.variantId
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          }
        }
        return { items: [...state.items, item] }
      }),
    removeItem: (variantId) =>
      set((state) => ({
        items: state.items.filter((i) => i.variantId !== variantId),
      })),
    updateQuantity: (variantId, quantity) =>
      set((state) => ({
        items:
          quantity <= 0
            ? state.items.filter((i) => i.variantId !== variantId)
            : state.items.map((i) =>
                i.variantId === variantId ? { ...i, quantity } : i
              ),
      })),
    setItems: (items) => set({ items }),
    clearCart: () => set({ items: [] }),
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
  })
)
