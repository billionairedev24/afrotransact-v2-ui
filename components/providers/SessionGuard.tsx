"use client"

import { useEffect, useRef } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import { clearClientCartOnly } from "@/lib/client-cart-cleanup"

const PROTECTED_PREFIXES = ["/admin", "/dashboard"]

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Watches the client-side session state on protected routes.
 *
 * Triggers a silent logout + redirect to /auth/login when:
 *  - The Keycloak refresh token expires (RefreshTokenError)
 *  - The session becomes unauthenticated while on a protected route
 *    (covers token TTL expiry between NextAuth refetch cycles)
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const handlingRef = useRef(false)

  useEffect(() => {
    if (handlingRef.current) return

    const hasRefreshError = (session as { error?: string } | null)?.error === "RefreshTokenError"
    const isUnauthOnProtected = status === "unauthenticated" && isProtectedPath(pathname)

    if (hasRefreshError || isUnauthOnProtected) {
      handlingRef.current = true
      clearClientCartOnly()
      const callbackUrl = encodeURIComponent(pathname)
      void signOut({
        callbackUrl: `/auth/login?callbackUrl=${callbackUrl}&reason=session_expired`,
      })
    }
  }, [session, status, pathname])

  return <>{children}</>
}