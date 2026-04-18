"use client"

/**
 * AdSlot — renders a promotional banner or strip from the AdsStore.
 *
 * Safety contract:
 * - If slotId has no config, renders null (never throws).
 * - If config.enabled = false, renders null.
 * - If user dismissed the ad (dismissible = true), renders null.
 * - All rendering is client-only to avoid SSR hydration mismatches.
 */

import Link from "next/link"
import Image from "next/image"
import { X, ArrowRight, Zap } from "lucide-react"
import { useEffect, useState } from "react"
import { useAdsStore } from "@/stores/useAdsStore"
import type { AdConfig } from "@/lib/ads"

interface AdSlotProps {
  slotId: string
  className?: string
}

function hex(color: string, alpha = 1): string {
  // Returns rgba() from a hex string, or the value as-is if already rgb/var
  if (!color.startsWith("#")) return color
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  return alpha === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`
}

function BannerAd({ ad, onDismiss }: { ad: AdConfig; onDismiss: () => void }) {
  const gradient = `linear-gradient(135deg, ${ad.bgColor} 0%, ${ad.bgColorEnd} 100%)`

  return (
    <section
      className="relative overflow-hidden border-y"
      style={{
        background: gradient,
        borderColor: hex(ad.bgColorEnd, 0.4),
      }}
    >
      {/* Subtle radial glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 10% 50%, ${hex(ad.titleColor, 0.08)} 0%, transparent 60%)`,
        }}
      />

      {/* Optional background image */}
      {ad.imageUrl && (
        <div className="absolute inset-0 pointer-events-none">
          <Image
            src={ad.imageUrl}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-10"
          />
        </div>
      )}

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 py-5 sm:py-6">
        <div className="flex items-center justify-between gap-6 flex-wrap sm:flex-nowrap">
          {/* Left — content */}
          <div className="flex items-start gap-4 min-w-0 flex-1">
            {/* Accent dot / badge */}
            {ad.badgeText && (
              <span
                className="shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: hex(ad.titleColor, 0.15),
                  color: ad.titleColor,
                  border: `1px solid ${hex(ad.titleColor, 0.3)}`,
                }}
              >
                <Zap className="h-2.5 w-2.5" />
                {ad.badgeText}
              </span>
            )}

            <div className="min-w-0">
              <p
                className="text-base sm:text-lg font-black leading-snug"
                style={{ color: ad.titleColor }}
              >
                {ad.title}
              </p>
              {ad.body && (
                <p
                  className="text-sm mt-0.5 leading-relaxed max-w-xl opacity-80"
                  style={{ color: ad.bodyColor || ad.titleColor }}
                >
                  {ad.body}
                </p>
              )}
            </div>
          </div>

          {/* Right — CTA + dismiss */}
          <div className="flex items-center gap-3 shrink-0">
            {ad.ctaLabel && ad.ctaHref && (
              <Link
                href={ad.ctaHref}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98] shadow-lg"
                style={{
                  backgroundColor: ad.ctaBgColor,
                  color: ad.ctaTextColor,
                  boxShadow: `0 4px 14px ${hex(ad.ctaBgColor, 0.35)}`,
                }}
              >
                {ad.ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {ad.dismissible && (
              <button
                onClick={onDismiss}
                aria-label="Dismiss"
                className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
                style={{
                  backgroundColor: hex(ad.titleColor, 0.1),
                  color: ad.titleColor,
                }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function StripAd({ ad, onDismiss }: { ad: AdConfig; onDismiss: () => void }) {
  const gradient = `linear-gradient(90deg, ${ad.bgColor} 0%, ${ad.bgColorEnd} 100%)`

  return (
    <section
      className="relative border-y"
      style={{
        background: gradient,
        borderColor: hex(ad.bgColorEnd, 0.5),
      }}
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {ad.badgeText && (
            <span
              className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{
                backgroundColor: hex(ad.titleColor, 0.15),
                color: ad.titleColor,
              }}
            >
              {ad.badgeText}
            </span>
          )}
          <span
            className="text-sm font-semibold truncate"
            style={{ color: ad.titleColor }}
          >
            {ad.title}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {ad.ctaLabel && ad.ctaHref && (
            <Link
              href={ad.ctaHref}
              className="text-sm font-bold underline underline-offset-2 hover:no-underline transition-all"
              style={{ color: ad.ctaBgColor || ad.titleColor }}
            >
              {ad.ctaLabel} →
            </Link>
          )}
          {ad.dismissible && (
            <button
              onClick={onDismiss}
              aria-label="Dismiss"
              style={{ color: hex(ad.titleColor, 0.6) }}
              className="hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

export function AdSlot({ slotId, className = "" }: AdSlotProps) {
  const [mounted, setMounted] = useState(false)
  const { getAd, isVisible, dismissAd } = useAdsStore()

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null
  if (!isVisible(slotId)) return null
  const ad = getAd(slotId)
  if (!ad) return null

  function onDismiss() { dismissAd(ad!.id) }

  if (ad.type === "strip") {
    return (
      <div className={className}>
        <StripAd ad={ad} onDismiss={onDismiss} />
      </div>
    )
  }

  return (
    <div className={className}>
      <BannerAd ad={ad} onDismiss={onDismiss} />
    </div>
  )
}
