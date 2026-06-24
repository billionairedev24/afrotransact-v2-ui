"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

export type PromoPlacement = "HERO" | "STRIP_TOP" | "SIDEBAR" | "FOOTER"

export interface Promotion {
  id: string
  title: string
  subtitle?: string | null
  imageUrl: string
  ctaUrl?: string | null
  ctaLabel?: string | null
  placement: PromoPlacement
  startsAt?: string | null
  endsAt?: string | null
  sortOrder: number
  active: boolean
}

interface PromoSlotProps {
  placement: PromoPlacement
  className?: string
  /** Optional pre-fetched payload (used by the admin live preview). */
  promotions?: Promotion[]
}

/**
 * Placement-aware marketing surface. Server pages can mount this directly; it
 * fetches `/api/public/promotions?placement=X` via the Next.js proxy which
 * caches upstream with `revalidate: 60`. Renders `null` when no promos exist
 * so layouts never collapse with empty gutters.
 */
export function PromoSlot({ placement, className, promotions }: PromoSlotProps) {
  const [items, setItems] = useState<Promotion[]>(promotions ?? [])
  const [loaded, setLoaded] = useState<boolean>(!!promotions)

  useEffect(() => {
    if (promotions) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/public/promotions?placement=${placement}`, {
          cache: "no-store",
        })
        if (!res.ok) {
          if (!cancelled) setLoaded(true)
          return
        }
        const data = (await res.json()) as { promotions?: Promotion[] }
        if (!cancelled) {
          setItems(Array.isArray(data.promotions) ? data.promotions : [])
          setLoaded(true)
        }
      } catch {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [placement, promotions])

  if (!loaded) return null
  if (items.length === 0) return null

  switch (placement) {
    case "HERO":
      return <HeroSlot items={items} className={className} />
    case "STRIP_TOP":
      return <StripTopSlot items={items} className={className} />
    case "SIDEBAR":
      return <SidebarSlot items={items} className={className} />
    case "FOOTER":
      return <FooterSlot items={items} className={className} />
  }
}

// ── Shared building blocks ───────────────────────────────────────────────────

function PromoCTA({ promo, size = "md" }: { promo: Promotion; size?: "sm" | "md" | "lg" }) {
  if (!promo.ctaUrl || !promo.ctaLabel) return null
  const sizeCls =
    size === "lg" ? "px-6 py-3 text-base" : size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
  return (
    <Link
      href={promo.ctaUrl}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-brand-gold font-bold text-brand-gold-foreground shadow-md hover:bg-brand-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 transition-colors",
        sizeCls,
      )}
      aria-label={promo.ctaLabel}
    >
      {promo.ctaLabel}
    </Link>
  )
}

function PromoOverlay({
  promo,
  align = "left",
  size = "md",
}: {
  promo: Promotion
  align?: "left" | "center"
  size?: "sm" | "md" | "lg"
}) {
  const titleCls =
    size === "lg" ? "text-3xl md:text-5xl" : size === "sm" ? "text-base md:text-lg" : "text-xl md:text-2xl"
  const subCls = size === "lg" ? "text-base md:text-lg" : "text-xs md:text-sm"
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col justify-end p-4 md:p-8 gap-2 md:gap-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent text-white",
        align === "center" && "items-center text-center",
      )}
    >
      <h3 className={cn("font-bold leading-tight drop-shadow-md", titleCls)}>
        {promo.title}
      </h3>
      {promo.subtitle ? (
        <p className={cn("max-w-2xl text-white/90 drop-shadow", subCls)}>{promo.subtitle}</p>
      ) : null}
      <div className="mt-1">
        <PromoCTA promo={promo} size={size} />
      </div>
    </div>
  )
}

// ── HERO: ~21:9 desktop / 4:3 mobile, autoplay 5s, swipe ────────────────────

function HeroSlot({ items, className }: { items: Promotion[]; className?: string }) {
  const [index, setIndex] = useState(0)
  const len = items.length

  useEffect(() => {
    if (len <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % len), 5000)
    return () => clearInterval(t)
  }, [len])

  // Touch swipe
  const [touchX, setTouchX] = useState<number | null>(null)

  return (
    <section
      className={cn("relative w-full overflow-hidden rounded-2xl bg-gray-100", className)}
      aria-roledescription="carousel"
      aria-label="Featured promotions"
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX == null) return
        const delta = e.changedTouches[0].clientX - touchX
        if (Math.abs(delta) > 40) {
          setIndex((i) => (delta < 0 ? (i + 1) % len : (i - 1 + len) % len))
        }
        setTouchX(null)
      }}
    >
      {/* Aspect ratio container: 4:3 mobile, ~21:9 desktop */}
      <div className="relative aspect-[4/3] md:aspect-[21/9]">
        {items.map((promo, i) => (
          <div
            key={promo.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-in-out",
              i === index ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
            aria-hidden={i !== index}
          >
            <Image
              src={promo.imageUrl}
              alt={promo.title}
              fill
              sizes="(max-width: 768px) 100vw, 100vw"
              className="object-cover"
              priority={i === 0}
            />
            <PromoOverlay promo={promo} size="lg" />
          </div>
        ))}
      </div>

      {len > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {items.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2",
                i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80",
              )}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ── STRIP_TOP: 8:1, crossfade every 8s ──────────────────────────────────────

function StripTopSlot({ items, className }: { items: Promotion[]; className?: string }) {
  const [index, setIndex] = useState(0)
  const len = items.length

  useEffect(() => {
    if (len <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % len), 8000)
    return () => clearInterval(t)
  }, [len])

  return (
    <section
      className={cn("relative w-full overflow-hidden rounded-xl bg-gray-100", className)}
      aria-label="Promotional banner"
    >
      <div className="relative aspect-[8/1]">
        {items.map((promo, i) => (
          <div
            key={promo.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-in-out",
              i === index ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
            aria-hidden={i !== index}
          >
            <Image
              src={promo.imageUrl}
              alt={promo.title}
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-between gap-4 px-6 bg-gradient-to-r from-black/60 via-black/20 to-transparent text-white">
              <div className="min-w-0">
                <p className="font-bold truncate text-sm md:text-lg">{promo.title}</p>
                {promo.subtitle ? (
                  <p className="text-xs md:text-sm text-white/85 truncate">{promo.subtitle}</p>
                ) : null}
              </div>
              <div className="shrink-0">
                <PromoCTA promo={promo} size="sm" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── SIDEBAR: 4:5 stacked ────────────────────────────────────────────────────

function SidebarSlot({ items, className }: { items: Promotion[]; className?: string }) {
  return (
    <aside className={cn("flex flex-col gap-3", className)} aria-label="Promotions">
      {items.map((promo) => (
        <div
          key={promo.id}
          className="relative overflow-hidden rounded-xl bg-gray-100 border border-input"
        >
          <div className="relative aspect-[4/5]">
            <Image
              src={promo.imageUrl}
              alt={promo.title}
              fill
              sizes="(max-width: 1024px) 100vw, 280px"
              className="object-cover"
            />
            <PromoOverlay promo={promo} size="sm" />
          </div>
        </div>
      ))}
    </aside>
  )
}

// ── FOOTER: 6:1, single banner ──────────────────────────────────────────────

function FooterSlot({ items, className }: { items: Promotion[]; className?: string }) {
  const promo = useMemo(() => items[0], [items])
  if (!promo) return null
  return (
    <section
      className={cn("relative w-full overflow-hidden rounded-xl bg-gray-100", className)}
      aria-label="Promotional footer"
    >
      <div className="relative aspect-[6/1]">
        <Image
          src={promo.imageUrl}
          alt={promo.title}
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-between gap-4 px-6 bg-gradient-to-r from-black/55 via-black/20 to-transparent text-white">
          <div className="min-w-0">
            <p className="font-bold truncate text-base md:text-xl">{promo.title}</p>
            {promo.subtitle ? (
              <p className="text-xs md:text-sm text-white/85 truncate">{promo.subtitle}</p>
            ) : null}
          </div>
          <div className="shrink-0">
            <PromoCTA promo={promo} size="md" />
          </div>
        </div>
      </div>
    </section>
  )
}
