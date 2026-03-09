"use client"

import { useEffect, useRef, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"

/**
 * Watches the session for RefreshTokenError and intercepts 401 responses
 * from API calls. When the Keycloak refresh token has expired or is
 * revoked, redirects to login so the user can re-authenticate.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, update } = useSession()
  const handlingRef = useRef(false)

  const forceSignOut = useCallback(() => {
    if (handlingRef.current) return
    handlingRef.current = true
    signOut({ callbackUrl: "/auth/login?reason=session_expired" })
  }, [])

  useEffect(() => {
    const err = (session as { error?: string } | null)?.error
    if (err === "RefreshTokenError") {
      forceSignOut()
    }
  }, [session, forceSignOut])

  // Intercept fetch 401s globally to force session refresh or sign-out
  useEffect(() => {
    const originalFetch = window.fetch
    let refreshing: Promise<unknown> | null = null

    window.fetch = async (...args) => {
      const res = await originalFetch(...args)

      if (res.status === 401) {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url
        const isApiCall = url.includes("/api/v1/")

        if (isApiCall && !handlingRef.current) {
          if (!refreshing) {
            refreshing = update().finally(() => { refreshing = null })
          }
          await refreshing
        }
      }

      return res
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [update, forceSignOut])

  return <>{children}</>
}
