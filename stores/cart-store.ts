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

const GUEST_CART_KEY = "afrotransact-guest-cart"

/** Save current items to localStorage (guest only). */
export function saveGuestCart(items: CartItem[]) {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
  } catch {
    // localStorage full or unavailable — non-critical
  }
}

/** Load guest cart from localStorage. */
export function loadGuestCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY)
    if (raw) return JSON.parse(raw) as CartItem[]
  } catch {
    // corrupted data — ignore
  }
  return []
}

/** Remove guest cart from localStorage. */
export function clearGuestCart() {
  try {
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
