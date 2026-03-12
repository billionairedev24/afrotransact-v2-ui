"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"

/**
 * Watches the session for RefreshTokenError.
 * When the Keycloak refresh token has expired or is revoked,
 * performs a full logout (clearing both the NextAuth JWT and the
 * Keycloak SSO browser cookie) so the user is not silently
 * re-authenticated on the next page load.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const handlingRef = useRef(false)

  useEffect(() => {
    const err = (session as { error?: string } | null)?.error
    if (err === "RefreshTokenError" && !handlingRef.current) {
      handlingRef.current = true
      // Redirect to our custom signout route which clears NextAuth cookies
      // AND redirects to Keycloak's OIDC logout to destroy the SSO session.
      // Using signOut({ redirect: false }) would only clear the local JWT
      // but leave the Keycloak browser cookie alive, causing silent re-auth.
      window.location.href = "/api/auth/signout"
    }
  }, [session])

  return <>{children}</>
}
