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

  function dismiss() {
    if (promo) writeDismissed({ ...readDismissed(), [promo.id]: Date.now() })
    setOpen(false)
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="promo-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button type="button" aria-label="Close" onClick={dismiss}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in" />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button type="button" onClick={dismiss} aria-label="Close"
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
              />
            </div>
          ) : (
            promo.ctaUrl && (
              <Link href={promo.ctaUrl} onClick={dismiss}
                className="mt-5 flex items-center justify-center gap-2 w-full h-12 rounded-full bg-[#F5C518] hover:bg-[#E5B100] text-gray-900 font-bold text-[15px] transition-colors">
                {promo.ctaLabel || "Shop now"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )
          )}
          <button type="button" onClick={dismiss} className="mt-3 text-xs font-medium text-gray-500 hover:text-gray-800">
            No thanks
          </button>
        </div>
      </div>
    </div>
  )
}
