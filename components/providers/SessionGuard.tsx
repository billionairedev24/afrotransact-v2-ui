"use client"

import { useEffect, useRef } from "react"
import { useSession, signOut } from "next-auth/react"

/**
 * Watches the session for RefreshTokenError.
 * When the Keycloak refresh token has expired or is revoked,
 * clears the local NextAuth session so the user becomes a guest
 * rather than being stuck with a stale, expired access token.
 * They can sign in again voluntarily.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const handlingRef = useRef(false)

  useEffect(() => {
    const err = (session as { error?: string } | null)?.error
    if (err === "RefreshTokenError" && !handlingRef.current) {
      handlingRef.current = true
      // Sign out locally only (don't redirect to Keycloak) so user stays on current page as guest
      signOut({ redirect: false })
    }
  }, [session])

  return <>{children}</>
}
