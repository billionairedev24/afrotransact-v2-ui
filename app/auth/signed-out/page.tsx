"use client"

/**
 * /auth/signed-out
 *
 * The single authoritative post-sign-out landing. Keycloak's end-session
 * redirects the browser here (see app/api/auth/signout/route.ts).
 *
 * CRITICAL: this page is deliberately INERT with respect to auth. It must never
 * read the session in a way that triggers re-authentication, never auto-fire
 * signIn(), and it lives OUTSIDE every auto-auth mechanism:
 *   - Not under a SessionGuard PROTECTED_PREFIXES route (/dashboard, /orders…),
 *     so SessionGuard won't see "unauthenticated on a protected route" and bail
 *     out into a re-login.
 *   - Under /auth/, which PostLoginRedirect treats as exempt, so a seller isn't
 *     routed to /dashboard → /auth/login → silent re-auth.
 *   - No signIn on mount. The only way forward is the user clicking "Sign in".
 *
 * That inertness is the whole point: nothing here reacts to the missing
 * session, so a still-warm Keycloak SSO cookie can't be exploited to silently
 * re-log the user in. The sign-out sticks.
 */

import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default function SignedOutPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 px-4 text-center">
      <div className="w-full max-w-[380px] rounded-2xl border border-border bg-card p-8 shadow-sm space-y-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mx-auto">
          <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">You&apos;ve been signed out</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You&apos;re signed out of AfroTransact. Sign in again whenever you&apos;re ready.
          </p>
        </div>
        <Link
          href="/auth/login"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-gold-foreground shadow-md transition-all hover:brightness-110"
        >
          Sign in
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/" className="block text-sm text-muted-foreground hover:text-foreground">
          Back to home
        </Link>
      </div>
    </div>
  )
}
