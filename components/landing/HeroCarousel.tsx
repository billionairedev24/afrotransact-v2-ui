"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"

/**
 * Rotating hero — several banners that auto-advance and slide horizontally.
 * Every slide shares ONE layout: a full-bleed ground (a real photo, or the dark
 * woven motif for imageless slides), a left-anchored dark scrim, and the same
 * eyebrow / display headline / subcopy / gold CTA block. Slides are provided by
 * the page (built from real categories, with real links + images) and shuffled
 * per load so the order varies. Auto-play pauses on hover/focus and is disabled
 * under prefers-reduced-motion. A live campaign can still take over via
 * <PromoSlot> below this in the page.
 */

export type HeroSlide = {
  id: string
  eyebrow: string
  title: string
  sub: string
  cta: { label: string; href: string }
  /** A real image URL; omit for the brand slide (renders on the woven motif). */
  image?: string
}

const AUTO_MS = 6000

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  // Render server-order on first paint (no hydration mismatch), then shuffle on
  // the client so each visit varies.
  const [ordered, setOrdered] = useState(slides)
  useEffect(() => {
    setOrdered((s) => shuffle(s))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = ordered.length
  const go = useCallback((n: number) => setIndex((i) => (n + count) % count), [count])

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

  // Keep index in range if the slide set changes (e.g. after shuffle).
  useEffect(() => {
    if (index >= count) setIndex(0)
  }, [count, index])

  if (count === 0) return null

  return (
    <section className="max-w-page mx-auto px-4 sm:px-5">
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
        <div
          className="flex transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {ordered.map((s, i) => (
            <div
              key={s.id}
              className="relative w-full shrink-0 grow-0 basis-full"
              aria-hidden={i !== index}
            >
              <Slide slide={s} priority={i === 0} />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous slide"
              className="absolute left-3 top-1/2 -translate-y-1/2 hidden md:grid place-items-center h-10 w-10 rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur transition-opacity hover:bg-background group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next slide"
              className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:grid place-items-center h-10 w-10 rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur transition-opacity hover:bg-background group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {ordered.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index}
                  className={
                    "h-2 rounded-full transition-all " +
                    (i === index ? "w-6 bg-brand-gold" : "w-2 bg-white/50 hover:bg-white/80")
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

/** One uniform slide: dark ground (photo or woven), left scrim, left content. */
function Slide({ slide, priority }: { slide: HeroSlide; priority?: boolean }) {
  return (
    <div className={"relative min-h-[340px] sm:min-h-[400px] " + (slide.image ? "bg-brand-dark" : "bg-woven-dark")}>
      {slide.image && (
        <Image
          src={slide.image}
          alt=""
          fill
          priority={priority}
          sizes="(max-width: 1440px) 100vw, 1440px"
          className="object-cover"
        />
      )}
      {/* Left-anchored scrim keeps the copy legible over any ground. */}
      <div className="absolute inset-0 bg-gradient-to-r from-brand-dark/90 via-brand-dark/65 to-brand-dark/15" />
      <div className="relative flex min-h-[340px] sm:min-h-[400px] flex-col justify-center px-6 py-10 sm:px-10 sm:py-14">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/40 bg-brand-dark/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-gold">
            {slide.eyebrow}
          </p>
          <h2 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-white text-balance sm:text-5xl">
            {slide.title}
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/80 sm:text-lg">
            {slide.sub}
          </p>
          <div className="mt-7">
            <Link
              href={slide.cta.href}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-6 py-3 text-sm font-bold text-brand-gold-foreground shadow-sm transition-colors hover:bg-brand-gold-hover"
            >
              {slide.cta.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
