"use client"

/**
 * Hard email-verification gate.
 *
 * Keycloak enforces verification server-side (realm `verifyEmail: true`), so
 * NO token is ever issued for an unverified account — going forward every
 * authenticated session is already verified and this renders nothing.
 *
 * This gate is the app-side backstop for the transition window: any lingering
 * session created before the hard gate was turned on (emailVerified === false)
 * gets NO access to the app. Instead of a dismissible banner, it renders a
 * full-screen blocking overlay. The user must verify their email and then sign
 * in again — exactly the "verify first, then log in" model. It offers Resend,
 * an "I've verified" refresh, and a Sign-out to switch accounts.
 */

import { useEffect, useRef, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { toast } from "sonner"
import { Mail, Loader2, LogOut } from "lucide-react"

export function VerifyEmailGate() {
  const { data: session, status, update } = useSession()
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const autoSent = useRef(false)

  const unverified = status === "authenticated" && session?.user?.emailVerified === false

  useEffect(() => {
    if (!unverified || autoSent.current) return
    autoSent.current = true
    // Re-send the verification link once per browser session so a user who
    // landed here without the email (or after it expired) still gets one.
    try {
      if (sessionStorage.getItem("atx_verify_email_sent")) return
    } catch {
      /* sessionStorage unavailable — fall through and send */
    }
    void fetch("/api/auth/send-verify-email", { method: "POST" })
      .then((r) => {
        if (r.ok) {
          try { sessionStorage.setItem("atx_verify_email_sent", "1") } catch { /* ignore */ }
        }
      })
      .catch(() => {})
  }, [unverified])

  if (!unverified) return null

  async function resend() {
    setSending(true)
    try {
      const res = await fetch("/api/auth/send-verify-email", { method: "POST" })
      if (res.ok) toast.success("Verification email sent — check your inbox (and spam).")
      else toast.error("Couldn't send the email right now. Try again shortly.")
    } catch {
      toast.error("Network error — please try again.")
    } finally {
      setSending(false)
    }
  }

  async function iVerified() {
    setChecking(true)
    try {
      const updated = await update() // forces a token refresh (jwt trigger === "update")
      if ((updated?.user as { emailVerified?: boolean } | undefined)?.emailVerified) {
        toast.success("Thanks — your email is verified!")
      } else {
        toast.message("We don't see it verified yet.", {
          description: "Click the link in your email, then try again.",
        })
      }
    } finally {
      setChecking(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-xl sm:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
          <Mail className="h-6 w-6 text-amber-700 dark:text-amber-400" />
        </div>
        <h2 id="verify-gate-title" className="text-lg font-bold text-foreground">
          Verify your email to continue
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account isn&apos;t active yet. We sent a verification link
          {session?.user?.email ? <> to <span className="font-medium text-foreground">{session.user.email}</span></> : null}.
          Click it, then continue — until then you can&apos;t access your account.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={iVerified}
            disabled={checking}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {checking && <Loader2 className="h-4 w-4 animate-spin" />} I&apos;ve verified — continue
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={sending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />} Resend verification email
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-1 inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out / use a different account
          </button>
        </div>
      </div>
    </div>
  )
}
