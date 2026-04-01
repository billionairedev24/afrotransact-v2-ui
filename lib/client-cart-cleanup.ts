"use client"

import { clearGuestCart, useCartStore } from "@/stores/cart-store"

/**
 * Clears in-memory cart and guest cart storage (session/local).
 * Does not call the API — the server cart stays intact for the next login.
 */
export function clearClientCartOnly(): void {
  useCartStore.getState().clearCart()
  clearGuestCart()
}
