"use client"

/**
 * Captures `?ref=<code>` on any landing page and stamps the `atx_ref`
 * cookie (30-day, path=/, SameSite=Lax) — the same cookie the `/r/{code}`
 * short-link route sets. Mounted once, app-wide, in the root layout so
 * neither entry point is missed. Renders nothing.
 */

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

const REFERRAL_COOKIE = "atx_ref"
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60

export function ReferralCapture() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get("ref")
    if (!ref) return
    const code = ref.trim()
    if (!code) return
    document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${THIRTY_DAYS_SECONDS}; SameSite=Lax`
  }, [searchParams])

  return null
}
