"use client"

import { useCallback } from "react"
import { clearClientCartOnly } from "@/lib/client-cart-cleanup"

/**
 * Clears client-side cart state (memory + guest storage) so the signed-out tab
 * does not show a stale cart. Server cart is unchanged.
 */
export function useSignOut() {
  const signOut = useCallback(() => {
    // Cart cleanup is best-effort and MUST NOT block sign-out. It touches the
    // cart store + guest storage (localStorage/sessionStorage), which can throw
    // in some environments (e.g. incognito / storage-blocked). If it did, the
    // navigation below never ran and the button silently did nothing — the user
    // was left signed in. Swallow any error so the redirect always happens.
    try {
      clearClientCartOnly()
    } catch {
      /* ignore — sign-out must proceed regardless */
    }
    window.location.href = "/api/auth/signout"
  }, [])

  return signOut
}
