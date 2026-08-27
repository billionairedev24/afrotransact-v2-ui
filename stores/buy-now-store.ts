import { create } from "zustand"
import type { CartItem } from "@/stores/cart-store"

/**
 * Ephemeral "Buy Now" store — deliberately NOT persisted (no localStorage/
 * sessionStorage). It holds exactly the item a buyer chose via a "Buy Now"
 * CTA so /checkout?buynow=1 can check out ONLY that item without touching
 * the persistent cart (see stores/cart-store.ts).
 *
 * In-memory only: a page refresh during a buy-now checkout intentionally
 * loses this state. CheckoutClientV2 handles that by falling back to the
 * persistent cart / redirecting to /cart with a toast — see the
 * `buyNowMode && buyNowItems.length === 0` guard there.
 */
interface BuyNowState {
  items: CartItem[]
  setBuyNow: (item: CartItem) => void
  clear: () => void
  updateQuantity: (variantId: string, quantity: number) => void
  removeItem: (variantId: string) => void
}

export const useBuyNowStore = create<BuyNowState>()((set) => ({
  items: [],

  setBuyNow: (item) => set({ items: [{ ...item, quantity: 1 }] }),

  clear: () => set({ items: [] }),

  updateQuantity: (variantId, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((i) => i.variantId !== variantId)
          : state.items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
    })),

  removeItem: (variantId) =>
    set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),
}))
