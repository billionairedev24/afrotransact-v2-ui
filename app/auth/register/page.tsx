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
        if (isSeller) {
          // Persist seller intent so /auth/login can route back to the
          // onboarding flow if the user verifies their email on another
          // device (no live session when they return).
          try {
            localStorage.setItem(
              "afro_register_intent",
              JSON.stringify({ callbackUrl: "/dashboard/onboarding", role: "seller" }),
            )
          } catch {
            // localStorage unavailable (SSR / private mode) — proceed anyway.
          }
          await signIn("keycloak-register-seller", {
            callbackUrl: "/dashboard/onboarding",
            registration_role: "seller",
          })
        } else {
          await signIn("keycloak-register", {
            callbackUrl: searchParams.get("callbackUrl") || "/",
          })
        }
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
