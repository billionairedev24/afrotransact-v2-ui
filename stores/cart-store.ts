import { create } from "zustand"
import { persist } from "zustand/middleware"

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

export const useCartStore = create<CartState>()(
  persist(
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
    }),
    { name: "afrotransact-cart" }
  )
)
