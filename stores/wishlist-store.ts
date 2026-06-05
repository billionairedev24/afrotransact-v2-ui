/**
 * Wishlist store — local-storage only for now.
 *
 * Backend wishlist API + cross-device sync is queued as POST-LAUNCH-BACKLOG
 * #43 (new `wishlist` service or table on user-profile + `/api/v1/wishlist`
 * GET/POST/DELETE endpoints + signed-in merge on login). Until then we
 * persist to `localStorage` so the wishlist survives reloads on the same
 * device, but is not shared across devices or sessions on other browsers.
 */

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export interface WishlistItem {
  productId: string
  slug: string
  title: string
  imageUrl?: string | null
  priceCents: number
  storeName?: string | null
  addedAt: string // ISO timestamp
}

interface WishlistState {
  items: WishlistItem[]
  add: (item: Omit<WishlistItem, "addedAt">) => void
  remove: (productId: string) => void
  toggle: (item: Omit<WishlistItem, "addedAt">) => boolean // returns true if added
  has: (productId: string) => boolean
  clear: () => void
}

const STORAGE_KEY = "afrotransact-wishlist"

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) =>
        set((state) =>
          state.items.some((i) => i.productId === item.productId)
            ? state
            : { items: [{ ...item, addedAt: new Date().toISOString() }, ...state.items] }
        ),
      remove: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      toggle: (item) => {
        const exists = get().items.some((i) => i.productId === item.productId)
        if (exists) {
          set((state) => ({ items: state.items.filter((i) => i.productId !== item.productId) }))
          return false
        }
        set((state) => ({
          items: [{ ...item, addedAt: new Date().toISOString() }, ...state.items],
        }))
        return true
      },
      has: (productId) => get().items.some((i) => i.productId === productId),
      clear: () => set({ items: [] }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
