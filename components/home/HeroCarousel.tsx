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
}

const DEFAULT_SLIDES: HeroSlide[] = [
  {
    id: "brand",
    type: "brand",
    badge: {
      icon: <Sparkles className="h-3 w-3" />,
      text: "Now in Austin, TX",
      color: "border-primary/30 bg-primary/10 text-primary",
    },
    headline: (
      <>
        Every Flavor{" "}
        <span className="text-primary">of Home,</span>
        <br />
        Delivered{" "}
        <span className="relative">
          <span className="text-emerald-400">to You.</span>
          <svg
            aria-hidden
            viewBox="0 0 220 12"
            className="absolute -bottom-2 left-0 w-full"
            preserveAspectRatio="none"
          >
            <path
              d="M3 9 C40 3, 80 11, 120 5 S180 11, 217 6"
              stroke="#22c55e"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              opacity="0.6"
            />
          </svg>
        </span>
      </>
    ),
    subtext: (
      <>
        Authentic food, spices, and cultural goods from{" "}
        <span className="text-gray-900 font-medium">200+ immigrant-owned stores</span> across Austin.
        Support your neighbors. Taste the world.
      </>
    ),
    stats: [
      { value: "200+", label: "Verified Stores" },
      { value: "5,000+", label: "Products" },
      { value: "5 cities", label: "& growing" },
    ],
    ctas: [
      { label: "Start Shopping", href: "/search", primary: true, icon: <ChevronRight className="h-4 w-4" /> },
      { label: "Browse Stores", href: "/stores", primary: false, icon: <Store className="h-4 w-4 text-primary" /> },
    ],
    bg: "from-emerald-50 via-white to-white",
    accentBlobs:
      "radial-gradient(ellipse 80% 60% at 10% 50%, rgba(212,168,83,0.12) 0%, transparent 60%), " +
      "radial-gradient(ellipse 60% 80% at 90% 30%, rgba(34,197,94,0.08) 0%, transparent 60%)",
  },
  {
    id: "fresh-produce-week",
    type: "promo",
    badge: {
      icon: <Tag className="h-3 w-3" />,
      text: "Flash Sale · Ends Sunday",
      color: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    },
    headline: (
      <>
        Fresh Produce{" "}
        <span className="text-orange-400">Week</span>
        <br />
        <span className="text-3xl sm:text-4xl md:text-5xl">Up to{" "}
          <span className="text-primary font-black">40% Off</span>
        </span>
      </>
    ),
    subtext: (
      <>
        Plantains, cassava, scotch bonnets, yams and more — direct from{" "}
        <span className="text-gray-900 font-medium">local immigrant farmers</span> and vendors near you.
        Buy 2 get 1 free on selected items.
      </>
    ),
    stats: [
      { value: "40%", label: "Max discount" },
      { value: "80+", label: "Items on sale" },
      { value: "Today", label: "Delivery available" },
    ],
    ctas: [
      { label: "Shop the Sale", href: "/deals", primary: true, icon: <Tag className="h-4 w-4" /> },
      { label: "See All Deals", href: "/deals", primary: false },
    ],
    bg: "from-orange-50 via-white to-white",
    accentBlobs:
      "radial-gradient(ellipse 70% 70% at 15% 60%, rgba(251,146,60,0.15) 0%, transparent 55%), " +
      "radial-gradient(ellipse 50% 60% at 85% 20%, rgba(212,168,83,0.10) 0%, transparent 55%)",
  },
  {
    id: "seller-spotlight",
    type: "seller_spotlight",
    badge: {
      icon: <Star className="h-3 w-3" />,
      text: "Seller Spotlight",
      color: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    },
    headline: (
      <>
        <span className="text-yellow-400">Mama&apos;s Market</span>
        <br />
        <span className="text-3xl sm:text-4xl">Your Neighborhood&apos;s{" "}
          <span className="text-gray-900">Favorite Store</span>
        </span>
      </>
    ),
    subtext: (
      <>
        <span className="text-gray-900 font-medium">Amara Okafor</span> left Lagos and built a thriving
        West African grocery right here in Austin. Over{" "}
        <span className="text-gray-900 font-medium">312 five-star reviews</span> and growing daily.
      </>
    ),
    stats: [
      { value: "4.8★", label: "Store rating" },
      { value: "312", label: "Reviews" },
      { value: "0.3 mi", label: "From you" },
    ],
    ctas: [
      { label: "Visit Store", href: "/stores", primary: true, icon: <Store className="h-4 w-4" /> },
      { label: "Start Selling Too", href: "/sell", primary: false },
    ],
    bg: "from-yellow-50 via-white to-white",
    accentBlobs:
      "radial-gradient(ellipse 60% 70% at 5% 40%, rgba(234,179,8,0.12) 0%, transparent 55%), " +
      "radial-gradient(ellipse 50% 50% at 80% 70%, rgba(212,168,83,0.10) 0%, transparent 55%)",
  },
  {
    id: "first-order",
    type: "offer",
    badge: {
      icon: <Gift className="h-3 w-3" />,
      text: "New customer offer",
      color: "border-violet-500/30 bg-violet-500/10 text-violet-400",
    },
    headline: (
      <>
        <span className="text-violet-400">First Order?</span>
        <br />
        Free Delivery{" "}
        <span className="text-gray-900">on Us.</span>
      </>
    ),
    subtext: (
      <>
        Create your account today and get{" "}
        <span className="text-gray-900 font-medium">free delivery on your first order</span> from any
        store in Austin. No minimum spend required.
      </>
    ),
    stats: [
      { value: "Free", label: "First delivery" },
      { value: "25–40", label: "Min delivery" },
      { value: "$0", label: "Minimum spend" },
    ],
    ctas: [
      { label: "Create Account", href: "/auth/register", primary: true, icon: <ChevronRight className="h-4 w-4" /> },
      { label: "Learn More", href: "/about", primary: false },
    ],
    bg: "from-violet-50 via-white to-white",
    accentBlobs:
      "radial-gradient(ellipse 70% 60% at 20% 60%, rgba(139,92,246,0.15) 0%, transparent 55%), " +
      "radial-gradient(ellipse 50% 50% at 85% 30%, rgba(212,168,83,0.08) 0%, transparent 55%)",
  },
]

const INTERVAL_MS = 6000

export function HeroCarousel({ slides = DEFAULT_SLIDES }: { slides?: HeroSlide[] }) {
  const [current, setCurrent] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const go = useCallback(
    (idx: number) => {
      if (isAnimating) return
      setIsAnimating(true)
      setCurrent((idx + slides.length) % slides.length)
      setTimeout(() => setIsAnimating(false), 500)
    },
    [isAnimating, slides.length]
  )

  const prev = useCallback(() => go(current - 1), [current, go])
  const next = useCallback(() => go(current + 1), [current, go])

  // Auto-advance
  useEffect(() => {
    timerRef.current = setInterval(() => next(), INTERVAL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [next])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [prev, next])

  const slide = slides[current]

  return (
    <section
      className={`relative overflow-hidden min-h-[480px] flex items-center bg-gradient-to-br ${slide.bg}`}
      aria-label="Promotional carousel"
    >
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${slide.badge.color}`}
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
        {slides.map((s, i) => (
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
