"use client"

import { useCallback } from "react"
import { useCartStore } from "@/stores/cart-store"
import { clearGuestCart } from "@/stores/cart-store"

/**
 * Returns a signOut function that clears the cart from
 * both Zustand and guest localStorage before redirecting
 * to the server-side sign-out route.
 */
export function useSignOut() {
  const clearCart = useCartStore((s) => s.clearCart)

  const signOut = useCallback(() => {
    clearCart()
    clearGuestCart()
    window.location.href = "/api/auth/signout"
  }, [clearCart])

  return signOut
}
