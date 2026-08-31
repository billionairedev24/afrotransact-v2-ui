"use client"

/**
 * Completes self-service seller signup on the first authenticated load after a
 * "Start Selling" registration. "Start Selling" sets the `atx_seller_intent`
 * cookie; once the (soft-verify) registration produces a session, this calls
 * POST /api/auth/grant-seller to make the seller role + `registration_role`
 * attribute DURABLE on the Keycloak account, refreshes the session so the role
 * appears, and routes into onboarding.
 *
 * This replaces the retired Keycloak SPI role inference. Because the grant runs
 * here (same session/browser that set the cookie right after registering), the
 * durable attribute is written on the account — so seller status survives even
 * if the user verifies their email later on a different device. Renders nothing.
 */

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

function hasSellerIntentCookie(): boolean {
  if (typeof document === "undefined") return false
  return /(?:^|; )atx_seller_intent=/.test(document.cookie)
}

export function SellerIntentProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const attempted = useRef(false)

  useEffect(() => {
    if (status !== "authenticated" || attempted.current) return
    if (!hasSellerIntentCookie()) return

    const roles = (session?.user as { roles?: string[] } | undefined)?.roles ?? []
    attempted.current = true
    if (roles.includes("seller")) return // already a seller — nothing to do

    ;(async () => {
      try {
        const res = await fetch("/api/auth/grant-seller", { method: "POST" })
        if (res.ok) {
          await update() // force a token refresh so the seller role appears now
          router.push("/dashboard/onboarding")
        } else {
          attempted.current = false // transient failure — retry on next load
        }
      } catch {
        attempted.current = false
      }
    })()
  }, [status, session?.user, update, router])

  return <>{children}</>
}
