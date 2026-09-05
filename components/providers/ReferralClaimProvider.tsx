"use client"

/**
 * Fires the referral CLAIM once a referred buyer is authenticated.
 *
 * The capture side (`/r/{code}` short link + {@link ReferralCapture}) stamps an
 * `atx_ref` cookie. Registration threads the code to Keycloak, but nothing ever
 * turned that into an actual grant — so neither the referrer nor the new buyer
 * was credited. This boundary closes that gap: on the first authenticated load
 * that carries an `atx_ref` cookie, it calls `POST /api/v1/referral/claim`,
 * which grants store credit to BOTH sides in one transaction.
 *
 * The claim is idempotent and fully guarded server-side (self-referral,
 * already-claimed, new-account-only window, per-referrer cap), so calling it
 * on every load while the cookie is present is safe. We clear the cookie on a
 * grant or a terminal denial; a "not_new" denial keeps the cookie so a later
 * load can retry if the buyer's profile simply wasn't provisioned yet at first
 * sign-in. Renders nothing.
 */

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { claimReferral } from "@/lib/api"
import { formatPrice } from "@/lib/format"
import { logError } from "@/lib/errors"

const REFERRAL_COOKIE = "atx_ref"

// Denials that will never succeed on retry — clear the cookie so we stop
// calling. "not_new" is deliberately absent: a just-registered buyer whose
// profile wasn't provisioned yet at first sign-in should get another attempt
// on a later load (the account-age window is 24h).
const TERMINAL_DENIALS = new Set(["disabled", "invalid_code", "self", "already", "referrer_cap_reached"])

function readReferralCookie(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|; )atx_ref=([^;]*)/)
  return match ? decodeURIComponent(match[1]).trim() || null : null
}

function clearReferralCookie() {
  if (typeof document === "undefined") return
  document.cookie = `${REFERRAL_COOKIE}=; path=/; max-age=0; SameSite=Lax`
}

export function ReferralClaimProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  // Guard so we attempt at most once per authenticated user per tab — the
  // access token rotates on silent refresh, so we key by stable user id.
  const attemptedForUser = useRef<string | null>(null)

  useEffect(() => {
    if (status !== "authenticated") return
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) return
    const token = userId // non-secret marker; proxy attaches the real token

    const code = readReferralCookie()
    if (!code) return
    if (attemptedForUser.current === userId) return
    attemptedForUser.current = userId

    ;(async () => {
      try {
        const res = await claimReferral(token, code)
        if (res.granted) {
          clearReferralCookie()
          const amount =
            res.rewardCents != null
              ? formatPrice(res.rewardCents, res.currency ?? "USD")
              : "store credit"
          toast.success(`🎉 You earned ${amount} in store credit!`, {
            description: "Your referral reward has been added to your wallet.",
          })
        } else if (res.reason && TERMINAL_DENIALS.has(res.reason)) {
          // Won't ever succeed — stop trying.
          clearReferralCookie()
        }
        // "not_new" (or any other transient reason): keep the cookie; a later
        // load re-attempts once the profile exists / within the 24h window.
      } catch (e) {
        // Network/401 — don't clear; allow a retry on the next load. Reset the
        // per-user guard so a genuine later load can try again.
        attemptedForUser.current = null
        logError(e, "referral claim")
      }
    })()
  }, [status, session?.user])

  return <>{children}</>
}
