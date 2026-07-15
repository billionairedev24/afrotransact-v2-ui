import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import type { CategoryRef } from "@/lib/api"

/**
 * Storefront hero — the brand thesis, and the one part of the homepage that
 * must hold up with ZERO catalog data. Unlike the admin-managed <PromoSlot>
 * (which renders null when no campaign exists), this always renders: a woven
 * kente/mudcloth-inspired band, a display headline, buyer CTAs, and category
 * quick-links. A live promotion still overrides it via <PromoSlot> below.
 *
 * Server component — no client JS. Category chips come from real roots when
 * available and fall back to the storefront's core departments so the hero is
 * never empty.
 */

const FALLBACK_CHIPS: { label: string; href: string }[] = [
  { label: "Groceries", href: "/search?q=groceries" },
  { label: "Beauty & Hair", href: "/search?q=beauty" },
  { label: "Fashion", href: "/search?q=fashion" },
  { label: "Home", href: "/search?q=home" },
  { label: "Spices", href: "/search?q=spices" },
]

export function Hero({ categories = [] }: { categories?: CategoryRef[] }) {
  const chips =
    categories.filter((c) => c.slug !== "services").slice(0, 5).map((c) => ({
      label: c.name,
      href: `/category/${c.slug}`,
    }))
  const quickLinks = chips.length >= 3 ? chips : FALLBACK_CHIPS

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-woven-strong">
        {/* Warm scrim so text stays legible over the motif in both themes. */}
        <div className="absolute inset-0 bg-gradient-to-r from-sand/95 via-sand/80 to-sand/40 dark:from-background/95 dark:via-background/85 dark:to-background/50" />

        <div className="relative grid gap-8 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/25 bg-brand-green-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-green">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Your community market
            </p>

            <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-foreground text-balance sm:text-5xl lg:text-[3.4rem]">
              African &amp; diaspora treasures, from your neighbourhood.
            </h1>

            <p className="mt-4 max-w-md text-base leading-relaxed text-sand-foreground sm:text-lg">
              Fresh groceries, spices, beauty, and homeware from immigrant-owned
              stores &mdash; discovered, shopped, and delivered close to you.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/search?is_deal=true"
                className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-6 py-3 text-sm font-bold text-brand-gold-foreground shadow-sm transition-colors hover:bg-brand-gold-hover"
              >
                Shop today&rsquo;s deals
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/stores"
                className="inline-flex items-center gap-2 rounded-full border border-brand-green bg-transparent px-6 py-3 text-sm font-bold text-brand-green transition-colors hover:bg-brand-green hover:text-brand-green-foreground"
              >
                Browse stores
              </Link>
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

          {/* Decorative brand panel — the bag/Africa mark on the woven ground.
              Hidden on small screens where the copy carries the hero alone. */}
          <div className="relative hidden lg:block">
            <div className="ml-auto flex aspect-[4/3] w-full max-w-sm items-center justify-center rounded-2xl border border-border/60 bg-background/40 backdrop-blur-sm">
              <img
                src="/brand/logo-mark.svg"
                alt=""
                aria-hidden
                className="h-28 w-28 drop-shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
