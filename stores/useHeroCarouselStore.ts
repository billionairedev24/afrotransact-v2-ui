"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type HeroMediaType = "none" | "image" | "video"

export interface HeroCarouselSlideConfig {
  id: string
  enabled: boolean
  order: number

  badgeText?: string
  badgeColor?: string // tailwind classes e.g. "border-primary/30 bg-primary/10 text-primary"

  headline: string
  subtext: string

  primaryCtaLabel: string
  primaryCtaHref: string
  secondaryCtaLabel?: string
  secondaryCtaHref?: string

  // Background
  bg: string // tailwind gradient classes e.g. "from-emerald-50 via-white to-white"
  accentBlobs?: string // CSS background string

  // Optional media
  mediaType?: HeroMediaType
  mediaUrl?: string
  mediaOverlay?: string // CSS color, e.g. "rgba(0,0,0,0.35)"
}

const DEFAULT_HERO_SLIDES: HeroCarouselSlideConfig[] = [
  {
    id: "brand",
    enabled: true,
    order: 0,
    badgeText: "Now in Austin, TX",
    badgeColor: "border-primary/30 bg-primary/10 text-primary",
    headline: "Every Flavor of Home,\nDelivered to You.",
    subtext:
      "Authentic food, spices, and cultural goods from 200+ immigrant-owned stores across Austin. Support your neighbors. Taste the world.",
    primaryCtaLabel: "Start Shopping",
    primaryCtaHref: "/search",
    secondaryCtaLabel: "Browse Stores",
    secondaryCtaHref: "/stores",
    bg: "from-emerald-50 via-white to-white",
    accentBlobs:
      "radial-gradient(ellipse 80% 60% at 10% 50%, rgba(212,168,83,0.12) 0%, transparent 60%), " +
      "radial-gradient(ellipse 60% 80% at 90% 30%, rgba(34,197,94,0.08) 0%, transparent 60%)",
    mediaType: "none",
  },
  {
    id: "flash-sale",
    enabled: true,
    order: 1,
    badgeText: "Flash Sale · Ends Sunday",
    badgeColor: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    headline: "Fresh Produce Week\nUp to 40% Off",
    subtext:
      "Plantains, cassava, scotch bonnets, yams and more — direct from local immigrant farmers and vendors near you.",
    primaryCtaLabel: "Shop the Sale",
    primaryCtaHref: "/deals",
    secondaryCtaLabel: "See All Deals",
    secondaryCtaHref: "/deals",
    bg: "from-orange-50 via-white to-white",
    accentBlobs:
      "radial-gradient(ellipse 70% 70% at 15% 60%, rgba(251,146,60,0.15) 0%, transparent 55%), " +
      "radial-gradient(ellipse 50% 60% at 85% 20%, rgba(212,168,83,0.10) 0%, transparent 55%)",
    mediaType: "none",
  },
]

interface HeroCarouselState {
  slides: HeroCarouselSlideConfig[]
  upsertSlide: (slide: HeroCarouselSlideConfig) => void
  deleteSlide: (id: string) => void
  toggleSlide: (id: string) => void
  moveSlide: (id: string, dir: "up" | "down") => void
  getEnabledSlides: () => HeroCarouselSlideConfig[]
}

function sortSlides(slides: HeroCarouselSlideConfig[]) {
  return [...slides].sort((a, b) => a.order - b.order)
}

export const useHeroCarouselStore = create<HeroCarouselState>()(
  persist(
    (set, get) => ({
      slides: sortSlides(DEFAULT_HERO_SLIDES),

      upsertSlide: (slide) =>
        set((state) => {
          const exists = state.slides.some((s) => s.id === slide.id)
          const next = exists
            ? state.slides.map((s) => (s.id === slide.id ? slide : s))
            : [...state.slides, slide]
          return { slides: sortSlides(next) }
        }),

      deleteSlide: (id) => set((state) => ({ slides: state.slides.filter((s) => s.id !== id) })),

      toggleSlide: (id) =>
        set((state) => ({
          slides: state.slides.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
        })),

      moveSlide: (id, dir) =>
        set((state) => {
          const sorted = sortSlides(state.slides)
          const idx = sorted.findIndex((s) => s.id === id)
          if (idx < 0) return state
          const swapWith = dir === "up" ? idx - 1 : idx + 1
          if (swapWith < 0 || swapWith >= sorted.length) return state
          const a = sorted[idx]
          const b = sorted[swapWith]
          const swapped = sorted.map((s) => {
            if (s.id === a.id) return { ...s, order: b.order }
            if (s.id === b.id) return { ...s, order: a.order }
            return s
          })
          return { slides: sortSlides(swapped) }
        }),

      getEnabledSlides: () => sortSlides(get().slides).filter((s) => s.enabled),
    }),
    {
      name: "afrotransact-hero-carousel",
    }
  )
)

