"use client"

import { clearGuestCart, useCartStore } from "@/stores/cart-store"

/** Clears in-memory cart, guest session storage, and the server cart when a token exists. */
export async function purgeCartStorageAndServer(): Promise<void> {
  useCartStore.getState().clearCart()
  clearGuestCart()
  try {
    const { getAccessToken } = await import("@/lib/auth-helpers")
    const { clearServerCart } = await import("@/lib/api")
    const token = await getAccessToken()
    if (token) await clearServerCart(token).catch(() => {})
  } catch {
    // non-blocking
  }
}
