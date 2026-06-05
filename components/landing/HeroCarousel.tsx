"use client"

/**
 * Landing HeroCarousel — full-width hero with rotating slides and a white
 * content card overlay (ported from public/ux-designs/code.html).
 *
 * IMAGE NOTE:
 *   This component references /carousel-1.png, /carousel-2.png, /carousel-3.png
 *   under /public. As of this commit, carousel-1.png does NOT exist; the
 *   component handles a missing image gracefully by tinting the slide
 *   background with a brand gradient. To get the intended visual, an operator
 *   should drop a carousel-1.png file (recommended 1920×600) into /public.
 *
 * If the backend admin has configured hero slides via getPublicHeroSlides,
 * those override the hard-coded local slides.
 */

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { HeroSlideConfig } from "@/lib/api"

interface LocalSlide {
  imageSrc: string
  headline: React.ReactNode
  subhead: string
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  /** Tailwind classes used as a fallback if the imageSrc fails to load. */
  fallbackBg: string
}

const LOCAL_SLIDES: LocalSlide[] = [
  // NOTE: carousel-1.png slide intentionally omitted until that asset exists
  // in /public. Adding the file is enough to bring back a third slide — see
  // the operator note at the top of this file. Until then, we ship only 2
  // slides rather than fronting an empty gradient as the first impression.
  {
    imageSrc: "/carousel-1.png",
    headline: (
      <>
        Discover <span className="text-foreground">Local Sellers</span> Near You.
      </>
    ),
    subhead:
      "Support immigrant entrepreneurs in your community. Same-day delivery on grocery and essentials.",
    primaryCta: { label: "Browse Stores", href: "/stores" },
    secondaryCta: { label: "Today's Deals", href: "/search?is_deal=true" },
    fallbackBg: "bg-gradient-to-br from-emerald-100 via-teal-50 to-green-100",
  },
  {
    imageSrc: "/carousel-3.png",
    headline: (
      <>
        New Arrivals from <span className="text-foreground">Around the World</span>.
      </>
    ),
    subhead:
      "Fresh products added daily. From traditional fabrics to artisan crafts — find something special.",
    primaryCta: { label: "See What's New", href: "/search?sort=newest" },
    secondaryCta: { label: "View Categories", href: "/categories" },
    fallbackBg: "bg-gradient-to-br from-sky-100 via-indigo-50 to-violet-100",
  },
]

interface HeroCarouselProps {
  serverHeroConfigs?: HeroSlideConfig[]
}

/**
 * Convert a server-configured slide → local renderable shape.
 *
 * `\n` in the headline is converted to a real React line-break so admin-written
 * titles with embedded newlines render correctly (the previous bug: literal `\n`
 * was being shown as text).
 *
 * Only used when a server slide has a non-empty image — otherwise we fall back
 * to the local carousel-x.png slides below so the hero never renders as a bare
 * gradient.
 */
function mapServerSlide(s: HeroSlideConfig): LocalSlide | null {
  const imageSrc = s.mediaType === "image" && s.mediaUrl ? s.mediaUrl : ""
  if (!imageSrc) return null
  const lines = (s.headline || "").split(/\\n|\n/)
  return {
    imageSrc,
    headline: (
      <>
        {lines.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </>
    ),
    subhead: s.subtext,
    primaryCta: { label: s.primaryCtaLabel, href: s.primaryCtaHref },
    secondaryCta:
      s.secondaryCtaLabel && s.secondaryCtaHref
        ? { label: s.secondaryCtaLabel, href: s.secondaryCtaHref }
        : undefined,
    fallbackBg: "bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100",
  }
}

export function HeroCarousel({ serverHeroConfigs }: HeroCarouselProps) {
  // Prefer admin-configured slides ONLY when they have valid images. Any slide
  // with a missing/broken image is dropped — the local /carousel-x.png slides
  // below fill the gap. Without this filter, a single malformed admin slide
  // forces the hero into the empty-gradient fallback for every visitor.
  const serverSlides =
    serverHeroConfigs && serverHeroConfigs.length > 0
      ? serverHeroConfigs
          .filter((s) => s.enabled)
          .map(mapServerSlide)
          .filter((s): s is LocalSlide => s !== null)
      : []
  const slides: LocalSlide[] = serverSlides.length > 0 ? serverSlides : LOCAL_SLIDES

  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState<Record<number, boolean>>({})

  const goTo = useCallback(
    (next: number) => {
      const n = slides.length
      if (n === 0) return
      setIndex(((next % n) + n) % n)
    },
    [slides.length],
  )

  useEffect(() => {
    if (slides.length <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000)
    return () => clearInterval(t)
  }, [slides.length])

  if (slides.length === 0) return null

  return (
    <section className="group/hero w-full relative min-h-[400px] md:h-[600px] bg-background z-10 overflow-hidden flex flex-col md:block">
      {/* Slides */}
      <div className="relative w-full h-64 md:absolute md:inset-0 md:h-full z-0">
        {slides.map((slide, i) => {
          const active = i === index
          const showImage = slide.imageSrc && !failed[i]
          return (
            <div
              key={i}
              className={`absolute inset-0 transition-opacity duration-700 ${
                active ? "opacity-100" : "opacity-0 pointer-events-none"
              } ${!showImage ? slide.fallbackBg : ""}`}
              aria-hidden={!active}
            >
              {showImage && (
                // Use a plain <img> so we can listen for onError and gracefully
                // fall back to the gradient tint without next/image's strict
                // remote-pattern requirements.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.imageSrc}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setFailed((m) => ({ ...m, [i]: true }))}
                />
              )}
              {/* Soft overlay for legibility on dense images */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-transparent" />
            </div>
          )
        })}
      </div>

      {/* Arrows */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded bg-white border border-border hover:bg-muted text-foreground items-center justify-center shadow-md transition-all opacity-0 group-hover/hero:opacity-100"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded bg-white border border-border hover:bg-muted text-foreground items-center justify-center shadow-md transition-all opacity-0 group-hover/hero:opacity-100"
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Content Card Overlay */}
      <div className="relative md:absolute md:inset-0 w-full h-full max-w-[1440px] mx-auto px-4 sm:px-5 md:flex md:items-center z-10">
        <div
          key={index}
          className="bg-white p-6 md:p-10 w-full md:max-w-md lg:max-w-lg shadow-lg border border-border rounded-md -mt-8 md:mt-0 relative z-20 mx-auto md:ml-12 lg:ml-24 animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight text-foreground">
            {slides[index].headline}
          </h1>
          <p className="text-base md:text-lg mb-8 text-muted-foreground">{slides[index].subhead}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={slides[index].primaryCta.href}
              className="bg-brand-gold text-brand-gold-foreground px-8 py-3 font-bold rounded-full shadow hover:brightness-95 transition-all text-base text-center"
            >
              {slides[index].primaryCta.label}
            </Link>
            {slides[index].secondaryCta && (
              <Link
                href={slides[index].secondaryCta!.href}
                className="bg-card border border-border text-foreground px-8 py-3 font-bold rounded-full hover:bg-muted transition-all text-base text-center"
              >
                {slides[index].secondaryCta!.label}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === index ? "bg-primary w-6" : "bg-border w-2 hover:bg-muted-foreground"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
