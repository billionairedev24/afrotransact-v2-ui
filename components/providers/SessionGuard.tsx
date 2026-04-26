"use client"

import { useEffect, useRef } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import { clearClientCartOnly } from "@/lib/client-cart-cleanup"
import { setOn401Handler } from "@/lib/api"

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
 *  - The API returns 401 (token rejected by backend) — handled via setOn401Handler
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const handlingRef = useRef(false)

  function bailOut(reason: string) {
    if (handlingRef.current) return
    handlingRef.current = true
    clearClientCartOnly()
    const callbackUrl = encodeURIComponent(pathname)
    void signOut({
      callbackUrl: `/auth/login?callbackUrl=${callbackUrl}&reason=${reason}`,
    })
  }

  // Register the global 401 handler so lib/api.ts can ask us to re-auth
  // without importing next-auth itself.
  useEffect(() => {
    setOn401Handler(() => {
      if (isProtectedPath(pathname)) bailOut("token_rejected")
    })
    return () => setOn401Handler(null)
  }, [pathname])

  useEffect(() => {
    if (handlingRef.current) return

    const hasRefreshError = (session as { error?: string } | null)?.error === "RefreshTokenError"
    const isUnauthOnProtected = status === "unauthenticated" && isProtectedPath(pathname)

    if (hasRefreshError || isUnauthOnProtected) {
      bailOut("session_expired")
    }
  }, [session, status, pathname])

  return <>{children}</>
}