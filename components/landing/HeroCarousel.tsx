"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import type { CategoryRef } from "@/lib/api"

/**
 * Rotating hero — several banners that auto-advance and slide horizontally.
 * Slide 1 is the always-on brand statement on the woven motif (works with zero
 * data); the rest are photographic banners. Auto-play pauses on hover/focus and
 * is disabled under prefers-reduced-motion. A live campaign can still take over
 * via <PromoSlot> below this in the page.
 */

type Slide = {
  id: string
  eyebrow: string
  title: string
  sub: string
  primary: { label: string; href: string }
  secondary?: { label: string; href: string }
  /** Photographic slides set an image; the brand slide leaves it undefined. */
  image?: string
}

const FALLBACK_CHIPS = [
  { label: "Groceries", href: "/search?q=groceries" },
  { label: "Beauty & Hair", href: "/search?q=beauty" },
  { label: "Fashion", href: "/search?q=fashion" },
  { label: "Home", href: "/search?q=home" },
]

const AUTO_MS = 6000

export function HeroCarousel({ categories = [] }: { categories?: CategoryRef[] }) {
  const chips =
    categories.filter((c) => c.slug !== "services").slice(0, 4).map((c) => ({
      label: c.name,
      href: `/category/${c.slug}`,
    }))
  const quickLinks = chips.length >= 3 ? chips : FALLBACK_CHIPS

  const slides: Slide[] = [
    {
      id: "brand",
      eyebrow: "Your community market",
      title: "African & diaspora treasures, from your neighborhood.",
      sub: "Fresh groceries, spices, beauty, and homeware — curated for the diaspora and delivered close to you.",
      primary: { label: "Shop today’s deals", href: "/search?is_deal=true" },
      secondary: { label: "Browse all products", href: "/search" },
    },
    {
      id: "pantry",
      eyebrow: "Pantry & staples",
      title: "Staples sourced direct from West African producers.",
      sub: "Grains, flours, and dry goods — vacuum-packed and batch-coded for freshness.",
      primary: { label: "Shop groceries", href: "/search?q=grain" },
      image:
        "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=1400&q=80",
    },
    {
      id: "flavor",
      eyebrow: "Kitchen & flavor",
      title: "Bring the flavor of home to your table.",
      sub: "Spice blends, sauces, and ready mixes for the dishes you grew up on.",
      primary: { label: "Shop food & spices", href: "/search?q=food" },
      image:
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1400&q=80",
    },
  ]

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = slides.length
  const go = useCallback((n: number) => setIndex((i) => (n + count) % count), [count])

  // Auto-advance, paused on hover/focus and under reduced-motion.
  const reduced = useRef(false)
  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  }, [])
  useEffect(() => {
    if (paused || reduced.current || count < 2) return
    const t = setInterval(() => setIndex((i) => (i + 1) % count), AUTO_MS)
    return () => clearInterval(t)
  }, [paused, count])

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-5">
      <div
        className="group relative overflow-hidden rounded-2xl border border-border"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured"
      >
        {/* Track */}
        <div
          className="flex transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((s, i) => (
            <div
              key={s.id}
              className="relative w-full shrink-0 grow-0 basis-full"
              aria-hidden={i !== index}
            >
              {s.image ? (
                <ImageSlide slide={s} priority={i === 0} />
              ) : (
                <BrandSlide slide={s} quickLinks={quickLinks} />
              )}
            </div>
          ))}
        </div>

        {/* Prev / next */}
        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label="Previous slide"
          className="absolute left-3 top-1/2 -translate-y-1/2 hidden md:grid place-items-center h-10 w-10 rounded-full bg-background/70 text-foreground opacity-0 backdrop-blur transition-opacity hover:bg-background group-hover:opacity-100 focus-visible:opacity-100"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label="Next slide"
          className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:grid place-items-center h-10 w-10 rounded-full bg-background/70 text-foreground opacity-0 backdrop-blur transition-opacity hover:bg-background group-hover:opacity-100 focus-visible:opacity-100"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={
                "h-2 rounded-full transition-all " +
                (i === index ? "w-6 bg-brand-gold" : "w-2 bg-foreground/30 hover:bg-foreground/50")
              }
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function BrandSlide({
  slide,
  quickLinks,
}: {
  slide: Slide
  quickLinks: { label: string; href: string }[]
}) {
  return (
    <div className="relative bg-woven-strong">
      <div className="absolute inset-0 bg-gradient-to-r from-sand/95 via-sand/80 to-sand/40 dark:from-background/95 dark:via-background/85 dark:to-background/50" />
      <div className="relative grid gap-8 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center min-h-[360px]">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/25 bg-brand-green-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-green">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {slide.eyebrow}
          </p>
          <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-foreground text-balance sm:text-5xl lg:text-[3.4rem]">
            {slide.title}
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-sand-foreground sm:text-lg">
            {slide.sub}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <CtaPrimary {...slide.primary} />
            {slide.secondary && <CtaSecondary {...slide.secondary} />}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {quickLinks.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:border-brand-gold hover:bg-card"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="relative hidden lg:block">
          <div className="ml-auto flex aspect-[4/3] w-full max-w-sm items-center justify-center">
            <img src="/brand/logo-mark.svg" alt="" aria-hidden className="h-40 w-40 drop-shadow-sm" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ImageSlide({ slide, priority }: { slide: Slide; priority?: boolean }) {
  return (
    <div className="relative bg-brand-dark min-h-[360px]">
      <Image
        src={slide.image!}
        alt=""
        fill
        priority={priority}
        sizes="(max-width: 1440px) 100vw, 1440px"
        className="object-cover"
      />
      {/* Left-anchored scrim so the copy stays legible over any photo. */}
      <div className="absolute inset-0 bg-gradient-to-r from-brand-dark/85 via-brand-dark/60 to-brand-dark/10" />
      <div className="relative flex min-h-[360px] flex-col justify-center px-6 py-10 sm:px-10 sm:py-14">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/40 bg-brand-dark/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-gold">
            {slide.eyebrow}
          </p>
          <h2 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-white text-balance sm:text-5xl">
            {slide.title}
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/80 sm:text-lg">
            {slide.sub}
          </p>
          <div className="mt-7">
            <CtaPrimary {...slide.primary} />
          </div>
        </div>
      </div>
    </div>
  )
}

function CtaPrimary({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-6 py-3 text-sm font-bold text-brand-gold-foreground shadow-sm transition-colors hover:bg-brand-gold-hover"
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}

function CtaSecondary({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-brand-green bg-transparent px-6 py-3 text-sm font-bold text-brand-green transition-colors hover:bg-brand-green hover:text-brand-green-foreground"
    >
      {label}
    </Link>
  )
}
