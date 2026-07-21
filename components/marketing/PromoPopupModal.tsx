"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, X } from "lucide-react"
import type { Promotion } from "@/components/marketing/PromoSlot"
import { EmailCaptureForm } from "@/components/marketing/EmailCaptureForm"

/**
 * Auto-popping promotion modal — the "POPUP" placement. Mirrors the seller
 * prompt's chrome/dismissal, but is fully data-driven from a scheduled
 * promotion the admin creates (image, title, subtitle, CTA).
 *
 * Scheduling: only shows a promo whose window is live now
 * (startsAt ≤ now ≤ endsAt) and is active. Dismissal is keyed per-promo-id
 * with a 3-day cooldown, so a NEW campaign still pops even after an older one
 * was dismissed.
 */
const STORAGE_KEY = "atx.promoPopup"
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000
// A far-future timestamp used as a "never show again" sentinel: the cooldown
// check (now - dismissedAt < COOLDOWN_MS) is always true against it.
const NEVER_TS = 9_999_999_999_999
const SHOW_DELAY_MS = 2500

type Dismissed = Record<string, number>

function readDismissed(): Dismissed {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") } catch { return {} }
}
function writeDismissed(d: Dismissed) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)) } catch { /* private mode */ }
}

function isLiveNow(p: Promotion): boolean {
  if (!p.active) return false
  const now = Date.now()
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return false
  if (p.endsAt && new Date(p.endsAt).getTime() <= now) return false
  return true
}

export function PromoPopupModal() {
  const [promo, setPromo] = useState<Promotion | null>(null)
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    // Not on funnel/admin routes.
    const path = window.location.pathname
    if (path.startsWith("/admin") || path.startsWith("/dashboard") || path.startsWith("/auth") || path.startsWith("/checkout")) {
      return
    }

    let cancelled = false
    let timer: number | undefined

    ;(async () => {
      try {
        const res = await fetch("/api/public/promotions?placement=POPUP", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { promotions?: Promotion[] }
        const live = (data.promotions ?? [])
          .filter(isLiveNow)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        const next = live[0]
        if (!next || cancelled) return

        // Respect per-promo dismissal cooldown.
        const dismissed = readDismissed()
        if (dismissed[next.id] && Date.now() - dismissed[next.id] < COOLDOWN_MS) return

        setPromo(next)
        timer = window.setTimeout(() => { if (!cancelled) setOpen(true) }, SHOW_DELAY_MS)
      } catch { /* silent — a promo popup should never break the page */ }
    })()

    return () => { cancelled = true; if (timer) window.clearTimeout(timer) }
  }, [])

  if (!open || !promo) return null

  // permanent=true → never show this promo again on this browser; otherwise a
  // 3-day cooldown. Once the visitor has submitted their email they've gotten
  // the code, so closing is treated as permanent.
  function dismiss(permanent = false) {
    if (promo) writeDismissed({ ...readDismissed(), [promo.id]: permanent ? NEVER_TS : Date.now() })
    setOpen(false)
  }
  const closeAfterEngage = () => dismiss(submitted)

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="promo-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button type="button" aria-label="Close" onClick={closeAfterEngage}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in" />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button type="button" onClick={closeAfterEngage} aria-label="Close"
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/80 text-gray-600 hover:text-gray-900 hover:bg-white transition-colors">
          <X className="h-4 w-4" />
        </button>

        {promo.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promo.imageUrl} alt={promo.title} className="w-full aspect-[16/9] object-cover" />
        )}

        <div className="px-6 sm:px-8 pt-6 pb-7 text-center">
          <h2 id="promo-modal-title" className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight text-balance">
            {promo.title}
          </h2>
          {promo.subtitle && (
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">{promo.subtitle}</p>
          )}
          {promo.captureEmail ? (
            <div className="mt-5 text-left">
              <EmailCaptureForm
                promoId={promo.id}
                headline={promo.captureHeadline}
                ctaLabel={promo.captureCtaLabel}
                variant="modal"
                onSuccess={() => setSubmitted(true)}
              />
            </div>
          ) : (
            promo.ctaUrl && (
              <Link href={promo.ctaUrl} onClick={() => dismiss(true)}
                className="mt-5 flex items-center justify-center gap-2 w-full h-12 rounded-full bg-[#F5C518] hover:bg-[#E5B100] text-gray-900 font-bold text-[15px] transition-colors">
                {promo.ctaLabel || "Shop now"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )
          )}

          {/* Footer controls. Once the email is in, "No thanks" makes no sense —
              show a single Done that closes for good. */}
          {submitted ? (
            <button
              type="button"
              onClick={() => dismiss(true)}
              className="mt-4 text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              Done
            </button>
          ) : (
            <div className="mt-3 flex items-center justify-center gap-4 text-xs">
              <button type="button" onClick={() => dismiss(false)} className="font-medium text-gray-500 hover:text-gray-800">
                No thanks
              </button>
              <span aria-hidden className="text-gray-300">·</span>
              <button type="button" onClick={() => dismiss(true)} className="font-medium text-gray-400 hover:text-gray-700">
                Don&rsquo;t show again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
