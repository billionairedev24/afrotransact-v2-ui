"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import {
  ChevronRight,
  Store,
  Sparkles,
  Tag,
  Gift,
  Star,
  ChevronLeft,
} from "lucide-react"
import { getPublicHeroSlides, type HeroSlideConfig } from "@/lib/api"

export interface HeroSlide {
  id: string
  type: "brand" | "promo" | "seller_spotlight" | "offer"
  badge?: { icon?: React.ReactNode; text: string; color: string }
  headline: React.ReactNode
  subtext: React.ReactNode
  stats?: { value: string; label: string }[]
  ctas: { label: string; href: string; primary: boolean; icon?: React.ReactNode }[]
  bg: string
  accentBlobs?: string
  media?: { type: "image" | "video"; url: string; overlay?: string }
}

const INTERVAL_MS = 6000
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}){1,2}$/
const CSS_GRADIENT = /gradient\(/i

export function HeroCarousel({ slides }: { slides?: HeroSlide[] }) {
  const [liveSlides, setLiveSlides] = useState<HeroSlide[]>(slides ?? [])
  const [current, setCurrent] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load dynamic slides from config-service; render nothing if backend has none.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await getPublicHeroSlides().catch(() => [])
        if (cancelled) return
        const enabled = cfg.filter((c) => c.enabled)
        if (enabled.length) {
          setLiveSlides(enabled.map((c, idx) => mapConfigToSlide(c, idx)))
        } else {
          setLiveSlides([])
        }
      } catch {
        // ignore, keep any passed-in slides (likely admin preview) or nothing
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const go = useCallback(
    (idx: number) => {
      if (isAnimating) return
      setIsAnimating(true)
      setCurrent((idx + liveSlides.length) % liveSlides.length)
      setTimeout(() => setIsAnimating(false), 500)
    },
    [isAnimating, liveSlides.length]
  )

  const prev = useCallback(() => go(current - 1), [current, go])
  const next = useCallback(() => go(current + 1), [current, go])

  // Auto-advance
  useEffect(() => {
    if (!liveSlides.length) return
    timerRef.current = setInterval(() => next(), INTERVAL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [next, liveSlides.length])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [prev, next])

  useEffect(() => {
    // When admin changes slide count, keep index valid
    setCurrent((c) => Math.min(c, Math.max(0, liveSlides.length - 1)))
  }, [liveSlides.length])

  if (!liveSlides.length) {
    return null
  }

  const slide = liveSlides[current] ?? liveSlides[0]
  const isCssGradientBg = CSS_GRADIENT.test(slide.bg) || HEX_COLOR.test(slide.bg.trim())

  return (
    <section
      className={`relative overflow-hidden min-h-[480px] flex items-center ${isCssGradientBg ? "" : `bg-gradient-to-br ${slide.bg}`}`}
      style={isCssGradientBg ? { background: slide.bg } : undefined}
      aria-label="Promotional carousel"
    >
      {/* Optional media as background */}
      {slide.media && (
        <div className="absolute inset-0">
          {slide.media.type === "video" ? (
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={slide.media.url}
              muted
              playsInline
              autoPlay
              loop
            />
          ) : (
            <img
              src={slide.media.url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div
            className="absolute inset-0"
            style={{ background: slide.media.overlay ?? "rgba(255,255,255,0.35)" }}
          />
        </div>
      )}

      {/* Accent blobs */}
      {slide.accentBlobs && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none transition-all duration-700"
          style={{ background: slide.accentBlobs }}
        />
      )}

      {/* Grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Slide content */}
      <div
        key={slide.id}
        className={`relative mx-auto max-w-[1440px] px-4 sm:px-6 py-16 md:py-24 w-full ${!isAnimating ? "hero-fade-in" : ""}`}
      >
        <div className="max-w-2xl space-y-7">
          {/* Badge */}
          {slide.badge && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                  HEX_COLOR.test(slide.badge.color.trim()) ? "" : slide.badge.color
                }`}
                style={
                  HEX_COLOR.test(slide.badge.color.trim())
                    ? {
                        borderColor: slide.badge.color,
                        color: slide.badge.color,
                        backgroundColor: `${slide.badge.color}1A`,
                      }
                    : undefined
                }
              >
                {slide.badge.icon}
                {slide.badge.text}
              </span>
            </div>
          )}

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08]">
            {slide.headline}
          </h1>

          {/* Sub */}
          <p className="text-base sm:text-lg text-gray-400 max-w-xl leading-relaxed">
            {slide.subtext}
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {slide.ctas.map((cta) =>
              cta.primary ? (
                <Link
                  key={cta.label}
                  href={cta.href}
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-7 text-[15px] font-bold text-header shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:shadow-primary/30 hover:shadow-xl active:scale-[0.98]"
                >
                  {cta.icon}
                  {cta.label}
                </Link>
              ) : (
                <Link
                  key={cta.label}
                  href={cta.href}
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 px-7 text-[15px] font-semibold text-gray-900 hover:bg-gray-100 hover:border-gray-400 transition-all active:scale-[0.98]"
                >
                  {cta.icon}
                  {cta.label}
                </Link>
              )
            )}
          </div>

          {/* Stats */}
          {slide.stats && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
              {slide.stats.map((stat) => (
                <div key={stat.label} className="flex items-center gap-1.5 text-sm">
                  <span className="font-bold text-primary">{stat.value}</span>
                  <span className="text-gray-500">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Controls: prev / next */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-white transition-all backdrop-blur-sm hidden sm:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-white transition-all backdrop-blur-sm hidden sm:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-2 z-10">
        {liveSlides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => go(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`rounded-full transition-all duration-300 ${
              i === current
                ? "w-6 h-2 bg-primary"
                : "w-2 h-2 bg-gray-300 hover:bg-gray-500"
            }`}
          />
        ))}
      </div>
    </section>
  )
}

function mapConfigToSlide(cfg: HeroSlideConfig, idx: number): HeroSlide {
  const badgeIcon =
    idx % 4 === 0 ? <Sparkles className="h-3 w-3" /> :
    idx % 4 === 1 ? <Tag className="h-3 w-3" /> :
    idx % 4 === 2 ? <Star className="h-3 w-3" /> :
    <Gift className="h-3 w-3" />

  // Support both real newlines and literal "\n" from seeded data
  const headline = (cfg.headline ?? "").split(/\r?\n|\\n/g).map((line, i, arr) => (
    <span key={`${cfg.id}-h-${i}`}>
      {line}
      {i < arr.length - 1 ? <br /> : null}
    </span>
  ))

  const subtext = (cfg.subtext ?? "").split(/\r?\n|\\n/g).map((line, i, arr) => (
    <span key={`${cfg.id}-s-${i}`}>
      {line}
      {i < arr.length - 1 ? <br /> : null}
    </span>
  ))

  const media =
    cfg.mediaType && cfg.mediaType !== "none" && cfg.mediaUrl
      ? { type: cfg.mediaType, url: cfg.mediaUrl, overlay: cfg.mediaOverlay ?? undefined }
      : undefined

  return {
    id: cfg.id,
    type: "promo",
    badge: cfg.badgeText
      ? {
          icon: badgeIcon,
          text: cfg.badgeText ?? "",
          color: cfg.badgeColor || "border-gray-300 bg-white/60 text-gray-700",
        }
      : undefined,
    headline,
    subtext,
    ctas: [
      {
        label: cfg.primaryCtaLabel,
        href: cfg.primaryCtaHref,
        primary: true,
        icon: <ChevronRight className="h-4 w-4" />,
      },
      ...(cfg.secondaryCtaLabel && cfg.secondaryCtaHref
        ? [
            {
              label: cfg.secondaryCtaLabel,
              href: cfg.secondaryCtaHref,
              primary: false,
              icon: <Store className="h-4 w-4 text-primary" />,
            },
          ]
        : []),
    ],
    bg: cfg.bg,
    accentBlobs: cfg.accentBlobs ?? undefined,
    media,
  }
}
