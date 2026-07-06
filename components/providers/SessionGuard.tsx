"use client"

import { useEffect, useRef } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import { setOn401Handler } from "@/lib/api"

const PROTECTED_PREFIXES = ["/admin", "/dashboard", "/account", "/orders", "/checkout"]

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
    // Do NOT clear the cart here. A transient 401 / expired token does not
    // mean the buyer abandoned the cart — the server-side cart is still
    // intact and will re-hydrate on next login. Wiping locally before
    // signOut was destroying carts on stale-token blips.
    const callbackUrl = encodeURIComponent(pathname)
    void signOut({
      callbackUrl: `/auth/login?callbackUrl=${callbackUrl}&reason=${reason}`,
    })
  }

  // Register the global 401 handler so lib/api.ts can ask us to re-auth
  // without importing next-auth itself.
  useEffect(() => {
    setOn401Handler(() => {
      // A 401 on any authenticated API call means the access token was
      // rejected AND the silent refresh in lib/auth.ts already failed
      // (otherwise we'd have a fresh token). Don't gate on path — the
      // session is dead regardless of where the user happens to be.
      if (status === "authenticated" || isProtectedPath(pathname)) {
        bailOut("token_rejected")
      }
    })
    return () => setOn401Handler(null)
  }, [pathname, status])

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