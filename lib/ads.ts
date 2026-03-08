/**
 * Ad slot configuration store.
 *
 * In production this would be fetched from an API endpoint backed by the
 * Config Service. For now it's a module-level store that the admin UI
 * updates in-memory (across page navigation via zustand persist).
 *
 * Design contract:
 * - AdSlot reads ONLY from this store — it never throws.
 * - If a slotId doesn't exist in the config, AdSlot renders null silently.
 * - The admin panel is the single source of truth for ad content.
 */

export type AdType = "banner" | "strip" | "card"

export interface AdConfig {
  id: string          // must match the slotId used in <AdSlot slotId="..." />
  type: AdType
  enabled: boolean
  title: string
  body?: string
  ctaLabel?: string
  ctaHref?: string
  badgeText?: string
  sponsor?: string
  gradient: string    // tailwind gradient classes e.g. "from-emerald-950 via-emerald-900/60 to-transparent"
  accentColor: string // tailwind text-* class e.g. "text-emerald-400"
  dismissible: boolean
  /** ISO timestamp — shown in admin for reference */
  createdAt: string
  updatedAt: string
}

/** Default ad configurations seeded for every installation */
export const DEFAULT_ADS: AdConfig[] = [
  {
    id: "mid-page-1",
    type: "banner",
    enabled: true,
    badgeText: "Sponsored",
    title: "Free Delivery This Weekend",
    body: "Order from any store in Austin before Sunday midnight and get free delivery. No code needed.",
    ctaLabel: "Order Now",
    ctaHref: "/search",
    gradient: "from-emerald-950 via-emerald-900/60 to-transparent",
    accentColor: "text-emerald-400",
    sponsor: "AfroTransact",
    dismissible: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mid-page-2",
    type: "banner",
    enabled: true,
    badgeText: "Partner Offer",
    title: "Sell Your Products — First Month Free",
    body: "Over 200 immigrant entrepreneurs are already earning on AfroTransact. Set up your store in minutes.",
    ctaLabel: "Start Selling",
    ctaHref: "/sell",
    gradient: "from-primary/20 via-primary/10 to-transparent",
    accentColor: "text-primary",
    sponsor: "AfroTransact for Sellers",
    dismissible: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "bottom-strip",
    type: "strip",
    enabled: true,
    title: "🎉 Refer a friend and both get $5 off your next order",
    ctaLabel: "Refer Now",
    ctaHref: "/referral",
    gradient: "from-violet-950 to-violet-900/40",
    accentColor: "text-violet-300",
    dismissible: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]
