"use client"

/**
 * AdSlot — renders an ad from the central AdsStore.
 *
 * Safety contract:
 * - If slotId has no config, renders null (never throws).
 * - If config.enabled = false, renders null.
 * - If user dismissed the ad (and dismissible = true), renders null.
 * - All rendering is client-only; SSR hydration mismatch is avoided via
 *   the mounted check.
 */

import Link from "next/link"
import { ExternalLink, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useAdsStore } from "@/stores/useAdsStore"

interface AdSlotProps {
  slotId: string
  className?: string
}

export function AdSlot({ slotId, className = "" }: AdSlotProps) {
  const [mounted, setMounted] = useState(false)
  const { getAd, isVisible, dismissAd } = useAdsStore()

  useEffect(() => { setMounted(true) }, [])

  // During SSR / before hydration — render nothing
  if (!mounted) return null

  // No config or disabled — render nothing (no error)
  if (!isVisible(slotId)) return null
  const ad = getAd(slotId)
  if (!ad) return null

  if (ad.type === "strip") {
    return (
      <section className={`bg-gradient-to-r ${ad.gradient} border-y border-white/10 ${className}`}>
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <span className={`text-sm font-medium ${ad.accentColor}`}>{ad.title}</span>
          {ad.ctaLabel && ad.ctaHref && (
            <Link
              href={ad.ctaHref}
              className="shrink-0 text-sm font-semibold text-white underline underline-offset-2 hover:no-underline transition-all"
            >
              {ad.ctaLabel} →
            </Link>
          )}
        </div>
      </section>
    )
  }

  // Banner / card
  return (
    <section className={`bg-gradient-to-r ${ad.gradient} border-y border-white/10 ${className}`}>
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2">
              {ad.badgeText && (
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 border border-white/20 rounded px-1.5 py-0.5">
                  {ad.badgeText}
                </span>
              )}
              {ad.sponsor && (
                <span className="text-[10px] text-white/30 flex items-center gap-0.5">
                  by {ad.sponsor} <ExternalLink className="h-2.5 w-2.5" />
                </span>
              )}
            </div>
            <p className={`text-base sm:text-lg font-bold ${ad.accentColor}`}>{ad.title}</p>
            {ad.body && (
              <p className="text-sm text-gray-400 max-w-xl leading-relaxed">{ad.body}</p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {ad.ctaLabel && ad.ctaHref && (
              <Link
                href={ad.ctaHref}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/20 transition-all active:scale-[0.98]"
              >
                {ad.ctaLabel}
              </Link>
            )}
            {ad.dismissible && (
              <button
                onClick={() => dismissAd(ad.id)}
                aria-label="Dismiss ad"
                className="h-7 w-7 flex items-center justify-center rounded-full text-white/30 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
