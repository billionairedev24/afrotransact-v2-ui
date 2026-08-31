"use client"

/**
 * /auth/register
 *
 * Thin redirect shim to Keycloak's registration page — same pattern as
 * /auth/login. The branded "Continue with Google / Apple / Instagram" tiles
 * we used to render here are gone; Keycloak is now the single source of truth
 * for registration UX (including any Identity Providers enabled on the realm,
 * so when Google IdP is wired up it automatically appears on the Keycloak
 * register screen).
 *
 * Behavior:
 *   - /auth/register                 → signIn("keycloak-register", { callbackUrl: "/" })
 *   - /auth/register?role=seller     → signIn("keycloak-register-seller", …)
 *                                      and persist seller intent in
 *                                      localStorage so that cross-device
 *                                      email-verified flows still land on
 *                                      /dashboard/onboarding.
 *
 * The seller-intent localStorage key is consumed by /auth/login
 * (see `getSellerIntentCallbackUrl` there).
 */

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef } from "react"

function Spinner({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-4 text-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

/**
 * Reads the `atx_ref` referral cookie stamped by `/r/{code}` (short link) or
 * `ReferralCapture` (`?ref=<code>` on any landing page). Threaded into the
 * Keycloak registration authorization request as `referralCode` so it rides
 * along in the query string; Keycloak/the backend register handler can pick
 * it up once wired (a later task).
 */
function getReferralCodeCookie(): string | undefined {
  if (typeof document === "undefined") return undefined
  const match = document.cookie.match(/(?:^|; )atx_ref=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

function RegisterRedirect() {
  const searchParams = useSearchParams()
  const role = searchParams.get("role")
  const isSeller = role === "seller"
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void (async () => {
      try {
        const referralCode = getReferralCodeCookie()
        // Clear any stale OAuth state/PKCE cookie from a prior or interleaved
        // flow (e.g. an abandoned login) so THIS registration's callback isn't
        // rejected with "state cookie was created for a different provider".
        await fetch("/api/auth/reset-oauth-state", { method: "POST" }).catch(() => {})

        // ONE registration provider for buyer AND seller. Seller intent is no
        // longer a Keycloak param/provider — it's a cookie the post-login
        // SellerIntentProvider reads to call /api/auth/grant-seller, which makes
        // the seller role + attribute DURABLE on the Keycloak account (survives
        // cross-device email verification). 30-min TTL covers register → (soft
        // verify) → land back authenticated on this same browser.
        if (isSeller) {
          document.cookie = "atx_seller_intent=1; path=/; max-age=1800; SameSite=Lax"
        }
        await signIn(
          "keycloak-register",
          { callbackUrl: isSeller ? "/" : (searchParams.get("callbackUrl") || "/") },
          referralCode ? { referralCode } : undefined,
        )
      } catch {
        // Allow the user to manually retry via a refresh if NextAuth throws.
        startedRef.current = false
      }
    })()
  }, [isSeller, searchParams])

  return <Spinner label={isSeller ? "Taking you to seller sign-up…" : "Taking you to sign-up…"} />
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <RegisterRedirect />
    </Suspense>
  )
}
