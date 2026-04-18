/**
 * Ad slot configuration.
 *
 * Colors are stored as hex strings (e.g. "#064e3b") so any color is possible
 * and a native <input type="color"> can be used in the admin UI.
 *
 * The frontend loads ads from GET /api/v1/config/ads on mount and falls back
 * to DEFAULT_ADS if the API is unreachable.
 *
 * Design contract:
 * - AdSlot reads ONLY from the ads store — it never throws.
 * - If a slotId doesn't exist or is disabled, AdSlot renders null silently.
 */

export type AdType = "banner" | "strip"

export interface AdConfig {
  id: string          // must match the slotId used in <AdSlot slotId="..." />
  type: AdType
  enabled: boolean
  title: string
  body?: string
  ctaLabel?: string
  ctaHref?: string
  badgeText?: string
  imageUrl?: string   // optional background / illustration image URL
  // All colors are hex strings e.g. "#064e3b"
  bgColor: string        // gradient start color
  bgColorEnd: string     // gradient end color
  titleColor: string     // headline text color
  bodyColor: string      // body / subtitle text color
  ctaBgColor: string     // CTA button background
  ctaTextColor: string   // CTA button text
  dismissible: boolean
  createdAt: string
  updatedAt: string
}

export const DEFAULT_ADS: AdConfig[] = [
  {
    id: "mid-page-1",
    type: "banner",
    enabled: true,
    badgeText: "This Weekend Only",
    title: "Free Delivery Across Austin",
    body: "Order from any store before Sunday midnight and get free delivery. No code needed.",
    ctaLabel: "Shop Now",
    ctaHref: "/search",
    bgColor: "#064e3b",
    bgColorEnd: "#022c22",
    titleColor: "#6ee7b7",
    bodyColor: "#a7f3d0",
    ctaBgColor: "#10b981",
    ctaTextColor: "#022c22",
    dismissible: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mid-page-2",
    type: "banner",
    enabled: true,
    badgeText: "For Sellers",
    title: "First Month Free — Open Your Store Today",
    body: "200+ immigrant entrepreneurs are already earning on AfroTransact. Set up in minutes.",
    ctaLabel: "Start Selling",
    ctaHref: "/sell",
    bgColor: "#1a0a00",
    bgColorEnd: "#2d1a00",
    titleColor: "#d4a853",
    bodyColor: "#c9a96e",
    ctaBgColor: "#d4a853",
    ctaTextColor: "#1a0a00",
    dismissible: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "bottom-strip",
    type: "strip",
    enabled: true,
    title: "Refer a friend and both get $5 off your next order",
    ctaLabel: "Refer Now",
    ctaHref: "/referral",
    bgColor: "#2e1065",
    bgColorEnd: "#1e1b4b",
    titleColor: "#c4b5fd",
    bodyColor: "#ddd6fe",
    ctaBgColor: "#7c3aed",
    ctaTextColor: "#ffffff",
    dismissible: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]
