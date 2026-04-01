"use client"

import { useCallback } from "react"
import { purgeCartStorageAndServer } from "@/lib/client-cart-cleanup"

/**
 * Clears cart state (memory, guest session storage, and server cart when logged in),
 * then redirects to the server sign-out route.
 */
export function useSignOut() {
  const signOut = useCallback(() => {
    void purgeCartStorageAndServer().finally(() => {
      window.location.href = "/api/auth/signout"
    })
  }, [])

  return signOut
}
