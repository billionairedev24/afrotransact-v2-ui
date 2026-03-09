"use client"

import { useEffect, useRef, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"

/**
 * Watches the session for RefreshTokenError and intercepts 401 responses
 * from API calls. When the Keycloak refresh token has expired or is
 * revoked, redirects to login so the user can re-authenticate.
 *
 * Also detects when a previously-authenticated session transitions to
 * unauthenticated (e.g. server-side expiry) and redirects to login
 * instead of leaving the user on a "sign in to view..." page.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession()
  const handlingRef = useRef(false)
  const wasAuthenticatedRef = useRef(false)

  const forceSignOut = useCallback((reason: string = "session_expired") => {
    if (handlingRef.current) return
    handlingRef.current = true
    signOut({ callbackUrl: `/auth/login?reason=${reason}` })
  }, [])

  // Track auth → unauth transitions
  useEffect(() => {
    if (status === "authenticated") {
      wasAuthenticatedRef.current = true
    }
    if (status === "unauthenticated" && wasAuthenticatedRef.current) {
      forceSignOut("session_expired")
    }
  }, [status, forceSignOut])

  useEffect(() => {
    const err = (session as { error?: string } | null)?.error
    if (err === "RefreshTokenError") {
      forceSignOut("session_expired")
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
