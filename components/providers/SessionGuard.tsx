"use client"

import { useEffect, useRef } from "react"
import { useSession, signOut } from "next-auth/react"
import { clearClientCartOnly } from "@/lib/client-cart-cleanup"

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
      clearClientCartOnly()
      void signOut({ callbackUrl: "/auth/login?reason=session_expired" })
    }
  }, [session])

  return <>{children}</>
}
