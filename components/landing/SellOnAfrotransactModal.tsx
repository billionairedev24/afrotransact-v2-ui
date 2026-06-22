"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { ArrowRight, Check, X } from "lucide-react"

/**
 * Auto-popping "Sell on AfroTransact" prompt for guests + buyers.
 *
 * Triggers (whichever fires first, only after the page is engaged):
 *  - 25-second dwell + 30% scroll depth, OR
 *  - exit-intent on desktop (mouse leaving the viewport top), OR
 *  - 3rd+ pageview in this browser
 *
 * Cooldowns:
 *  - Dismissed via X or backdrop → 7-day cooldown.
 *  - "Don't show again" → permanent.
 *  - "Start selling" click → permanent (the user is in the funnel now).
 *
 * Visibility rules:
 *  - Hidden for admin + seller sessions.
 *  - Hidden on every /admin/*, /dashboard/*, /sell/* route — the user
 *    is already past the funnel entry.
 */
const STORAGE_KEY = "atx.sellModal"
const PAGEVIEW_KEY = "atx.pageviews"

interface Persisted {
  dismissedAt?: number
  shownThisSession?: boolean
  dontShowAgain?: boolean
}

function readPersisted(): Persisted {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") } catch { return {} }
}

function writePersisted(p: Persisted) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) } catch { /* quota / private mode */ }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function SellOnAfrotransactModal() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const triggered = useRef(false)

  useEffect(() => {
    if (status === "loading") return
    const roles: string[] = (session?.user as { roles?: string[] })?.roles ?? []
    if (roles.includes("admin") || roles.includes("seller")) return

    // Skip on routes where the CTA is irrelevant.
    const path = window.location.pathname
    if (
      path.startsWith("/admin") ||
      path.startsWith("/dashboard") ||
      path.startsWith("/sell") ||
      path.startsWith("/auth")
    ) return

    const persisted = readPersisted()
    if (persisted.dontShowAgain) return
    if (persisted.shownThisSession) return
    if (persisted.dismissedAt && Date.now() - persisted.dismissedAt < SEVEN_DAYS_MS) return

    // Bump pageview counter (sessionStorage so it resets per tab session).
    let pageviews = 0
    try {
      pageviews = (parseInt(sessionStorage.getItem(PAGEVIEW_KEY) ?? "0") || 0) + 1
      sessionStorage.setItem(PAGEVIEW_KEY, String(pageviews))
    } catch { /* ignore */ }

    function trigger() {
      if (triggered.current) return
      triggered.current = true
      setOpen(true)
      const next = readPersisted()
      next.shownThisSession = true
      writePersisted(next)
    }

    // 1) 3rd+ pageview → fire after a small delay so the user sees the page first.
    if (pageviews >= 3) {
      const t = window.setTimeout(trigger, 4000)
      return () => window.clearTimeout(t)
    }

    // 2) Dwell + scroll-depth trigger.
    let dwellMet = false
    let scrollMet = false
    const dwellTimer = window.setTimeout(() => { dwellMet = true; if (scrollMet) trigger() }, 25_000)
    const onScroll = () => {
      const doc = document.documentElement
      const scrolled = (window.scrollY + window.innerHeight) / Math.max(doc.scrollHeight, 1)
      if (scrolled >= 0.3) {
        scrollMet = true
        if (dwellMet) trigger()
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true })

    // 3) Exit intent (desktop only — mouse leaves the viewport from the top edge).
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) trigger()
    }
    if (!matchMedia("(pointer: coarse)").matches) {
      document.addEventListener("mouseout", onMouseOut)
    }

    return () => {
      window.clearTimeout(dwellTimer)
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("mouseout", onMouseOut)
    }
  }, [session, status])

  if (!open) return null

  function dismiss(permanent = false) {
    const next = readPersisted()
    if (permanent) next.dontShowAgain = true
    else next.dismissedAt = Date.now()
    writePersisted(next)
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sell-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => dismiss(false)}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in"
      />

      {/* Card */}
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close */}
        <button
          type="button"
          onClick={() => dismiss(false)}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header strip */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 px-6 sm:px-8 pt-8 pb-6 border-b border-gray-100">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-orange-600 mb-1.5">
            For sellers
          </p>
          <h2 id="sell-modal-title" className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
            Turn what you make into income
          </h2>
          <p className="text-sm text-gray-700 mt-2">
            AfroTransact is a marketplace for authentic African and Black-owned products.
            Set up your storefront today and reach customers already shopping for what you sell.
          </p>
        </div>

        {/* Benefits */}
        <div className="px-6 sm:px-8 py-5">
          <ul className="space-y-2.5">
            <Benefit text="Plans start free — pick a paid tier only when you outgrow it" />
            <Benefit text="Stripe payouts to your bank within 2 business days" />
            <Benefit text="Your products show up in search, deals, and category pages" />
          </ul>
        </div>

        {/* Actions */}
        <div className="px-6 sm:px-8 pb-6 pt-2 space-y-3">
          <Link
            href="/auth/register?role=seller&callbackUrl=/dashboard/onboarding"
            onClick={() => {
              // Persist as permanently dismissed — the user is in the funnel.
              writePersisted({ ...readPersisted(), dontShowAgain: true })
            }}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-full bg-[#F5C518] hover:bg-[#E5B100] text-gray-900 font-bold text-[15px] transition-colors"
          >
            Start selling
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="flex items-center justify-between text-xs">
            <Link
              href="/sell"
              onClick={() => dismiss(false)}
              className="font-semibold text-gray-700 hover:text-orange-600"
            >
              Learn more
            </Link>
            <button
              type="button"
              onClick={() => dismiss(true)}
              className="text-gray-500 hover:text-gray-900"
            >
              Don't show this again
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Benefit({ text }: { text: string }) {
  return (
    <li className="flex gap-2.5 items-start">
      <span className="shrink-0 mt-0.5 flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100">
        <Check className="h-3 w-3 text-emerald-700" strokeWidth={3} />
      </span>
      <span className="text-sm text-gray-800 leading-relaxed">{text}</span>
    </li>
  )
}
