"use client"

/**
 * /auth/login
 *
 * Thin redirect shim: on mount, it jumps the user directly to the Keycloak
 * login page via NextAuth. There is no intermediate branded splash and no
 * "Continue with Google/Apple/Instagram" buttons — all social / federated
 * providers are configured inside Keycloak as Identity Providers, so the
 * Keycloak login screen itself is the single source of truth for auth UX.
 *
 * We still keep this route (instead of deleting it) because:
 *   - Many server-side `redirect("/auth/login?callbackUrl=...")` calls point
 *     here (middleware, (admin)/(seller)/(main) layouts, API handlers).
 *   - A handful of reason codes (`inactive`, `email_verified`,
 *     `password_updated`, `account_updated`) require a brief, human-visible
 *     acknowledgement screen before we re-initiate sign-in.
 */

import { signIn } from "next-auth/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"

function getSellerIntentCallbackUrl(): string | null {
  try {
    const raw = localStorage.getItem("afro_register_intent")
    if (!raw) return null
    const intent = JSON.parse(raw) as { callbackUrl?: string; role?: string }
    // Consume the intent so it doesn't persist past the first login.
    localStorage.removeItem("afro_register_intent")
    return intent.callbackUrl || null
  } catch {
    return null
  }
}

function resolveCallbackUrl(searchParams: URLSearchParams): string {
  if (typeof window === "undefined") return "/"
  const intentUrl = getSellerIntentCallbackUrl()
  return intentUrl || searchParams.get("callbackUrl") || "/"
}

/** Drops `error` while preserving other query params — makes auto-redirect behave like the pre-loop-guard UX. */
function loginHrefWithoutOauthError(sp: URLSearchParams): string {
  const q = new URLSearchParams(sp.toString())
  q.delete("error")
  const s = q.toString()
  return s ? `/auth/login?${s}` : "/auth/login"
}

function Spinner() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-4 text-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
    </div>
  )
}

function LoginRedirect() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const reason = searchParams.get("reason")

  // Reasons that should NOT auto-redirect — user needs to see the message and
  // confirm with a click.
  const manualReasons = new Set(["inactive", "email_verified"])
  const autoMessageReasons = new Set(["password_updated", "account_updated"])

  const startedRef = useRef(false)
  const [isLoading, setIsLoading] = useState(false)

  async function triggerKeycloakSignIn() {
    setIsLoading(true)
    try {
      const callbackUrl = resolveCallbackUrl(
        new URLSearchParams(searchParams.toString()),
      )
      await signIn("keycloak", { callbackUrl })
    } catch {
      setIsLoading(false)
    }
  }

  /**
   * Auto-redirect to Keycloak once on mount.
   *
   * IMPORTANT: if `error` is present (OAuth/sign-in failed server-side — e.g. Keycloak unreachable,
   * ECONNRESET, bad issuer), do NOT retry automatically or the UI will spin in an infinite redirect loop.
   * The user clears the failure via "Try again" which calls triggerKeycloakSignIn() explicitly.
   */
  useEffect(() => {
    if (startedRef.current) return
    if (error) return
    if (reason && manualReasons.has(reason)) return
    startedRef.current = true
    void triggerKeycloakSignIn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reason, error])

  // --- Manual confirm screens -------------------------------------------------

  if (reason === "inactive") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 px-4 text-center">
        <div className="w-full max-w-[380px] rounded-2xl border border-border bg-card p-8 shadow-sm space-y-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 mx-auto">
            <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">You&apos;ve been signed out</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For your security, you were automatically signed out due to inactivity. Please sign in to continue.
            </p>
          </div>
          <button
            onClick={triggerKeycloakSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-gold-foreground shadow-md transition-all hover:brightness-110 disabled:opacity-80 disabled:cursor-wait"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Signing in&hellip;</>
            ) : (
              <>Sign in<ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </div>
    )
  }

  if (reason === "email_verified") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 px-4 text-center">
        <div className="w-full max-w-[380px] rounded-2xl border border-border bg-card p-8 shadow-sm space-y-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mx-auto">
            <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">Email verified!</h1>
            <p className="text-sm text-muted-foreground">Your email has been confirmed. You can now sign in to your account.</p>
          </div>
          <button
            onClick={triggerKeycloakSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-gold-foreground shadow-md transition-all hover:brightness-110 disabled:opacity-80 disabled:cursor-wait"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Signing in&hellip;</>
            ) : (
              <>Continue to sign in<ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </div>
    )
  }

  // --- Auto-redirect path -----------------------------------------------------

  // Surface OAuth / callback errors — no auto-retry from useEffect (prevents infinite redirect loops).
  if (error) {
    console.error("auth.error", { code: error })
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4 text-center">
        <div className="w-full max-w-[380px] rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
          <p className="text-sm font-semibold text-destructive leading-relaxed">We couldn&rsquo;t sign you in.</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This usually clears up on a retry. If it keeps happening, please reach out to support.
          </p>
          <button
            onClick={triggerKeycloakSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-gold-foreground disabled:opacity-80 disabled:cursor-wait"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Signing in&hellip;</>
            ) : (
              <>Try again<ArrowRight className="h-4 w-4" /></>
            )}
          </button>
          <Link
            href="/help"
            className="flex w-full items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover:bg-muted"
          >
            Contact support
          </Link>
        </div>
      </div>
    )
  }

  // Friendly banner for auto-resumed flows (password_updated, account_updated),
  // otherwise just a plain spinner.
  if (reason && autoMessageReasons.has(reason)) {
    const reasonMessages: Record<string, string> = {
      password_updated: "Your password was updated. Continuing to sign in…",
      account_updated: "Your account was updated. Continuing to sign in…",
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-4 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground max-w-sm">{reasonMessages[reason]}</p>
      </div>
    )
  }

  return <Spinner />
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginRedirect />
    </Suspense>
  )
}
