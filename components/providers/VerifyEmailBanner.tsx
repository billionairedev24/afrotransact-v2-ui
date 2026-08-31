"use client"

/**
 * App-level email-verification gate (soft-verify model). Keycloak no longer
 * blocks sign-in on verification; instead this banner nudges the user, and
 * checkout / seller go-live are blocked until `emailVerified` is true. On the
 * first unverified load it auto-sends the verification email (so a fresh
 * registrant gets it without any click). Renders nothing when verified.
 */

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Mail, Loader2 } from "lucide-react"

export function VerifyEmailBanner() {
  const { data: session, status, update } = useSession()
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const autoSent = useRef(false)

  const unverified = status === "authenticated" && session?.user?.emailVerified === false

  useEffect(() => {
    if (!unverified || autoSent.current) return
    autoSent.current = true
    // Send once per browser session (survives client navigations, resets on a
    // new tab/session) so we don't email on every page view.
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
    <div className="w-full border-b border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm">
        <Mail className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <p className="min-w-0 flex-1 text-amber-900 dark:text-amber-200">
          <span className="font-semibold">Verify your email</span> to place orders and unlock your account
          {session?.user?.email ? <> — we sent a link to <span className="font-medium">{session.user.email}</span>.</> : "."}
        </p>
        <button
          type="button"
          onClick={resend}
          disabled={sending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-transparent dark:text-amber-200"
        >
          {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Resend email
        </button>
        <button
          type="button"
          onClick={iVerified}
          disabled={checking}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" />} I&apos;ve verified
        </button>
      </div>
    </div>
  )
}
