"use client"

import { useCallback } from "react"
import { clearClientCartOnly } from "@/lib/client-cart-cleanup"

/**
 * Clears client-side cart state (memory + guest storage) so the signed-out tab
 * does not show a stale cart. Server cart is unchanged.
 */
export function useSignOut() {
  const signOut = useCallback(() => {
    clearClientCartOnly()
    window.location.href = "/api/auth/signout"
  }, [])

  return signOut
}
