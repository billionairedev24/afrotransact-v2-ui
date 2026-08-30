"use client"

/**
 * AccountClient — "Your Account", a single branded page that reproduces the
 * approved account-hub mockup: a greeting header, a left rail of sections
 * (emoji icon + label + count badge, active item marked with a gold ground +
 * gold left accent bar), and a content column that renders the active section.
 *
 * Everything happens on this one page: clicking a rail item swaps
 * `activeSection` client state. There is NO route navigation here — the URL
 * hash is kept in sync via `history.replaceState` only, for bookmarking. On
 * small screens the rail collapses into a horizontal scrollable chip bar.
 *
 * All sections always render (Recipients / My preorders / Followed sellers /
 * Wallet included); the four without a backend render an on-brand
 * "coming soon" / empty state rather than being hidden. Count badges show
 * only where a real number exists (Orders, Wishlist) — never a fabricated one.
 *
 * Icons are emoji to match the mockup; the running text uses the app's own
 * font (font-display for headings), per request.
 */

import { useEffect, useMemo, useState } from "react"
import { signOut } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { clearClientCartOnly } from "@/lib/client-cart-cleanup"
import { getAccessToken } from "@/lib/auth-helpers"
import { getBuyerOrders, getWishlist, getReferralMe } from "@/lib/api"
import { OrdersSection } from "@/components/account/sections/OrdersSection"
import { RecipientsSection } from "@/components/account/sections/RecipientsSection"
import { PreordersSection } from "@/components/account/sections/PreordersSection"
import { FollowedSellersSection } from "@/components/account/sections/FollowedSellersSection"
import { ReviewsToWriteSection } from "@/components/account/sections/ReviewsToWriteSection"
import { WalletSection } from "@/components/account/sections/WalletSection"
import { ProfileSection } from "@/components/account/sections/ProfileSection"
import { SecuritySection } from "@/components/account/sections/SecuritySection"
import { WishlistSection } from "@/components/account/sections/WishlistSection"
import { AddressesSection } from "@/components/account/sections/AddressesSection"
import { PaymentsSection } from "@/components/account/sections/PaymentsSection"
import { NotificationsSection } from "@/components/account/sections/NotificationsSection"

type SectionId =
  | "orders"
  | "recipients"
  | "preorders"
  | "sellers"
  | "reviews"
  | "wallet"
  | "wishlist"
  | "addresses"
  | "payments"
  | "profile"
  | "security"
  | "notifications"

interface SectionDef {
  id: SectionId
  label: string
  headerLabel: string
  description: string
  /** Emoji icon, matching the approved mockup. */
  icon: string
  Component: () => React.JSX.Element | null
}

const DEFAULT_SECTION: SectionId = "orders"

// Rail order, per the approved mockup: Orders, Recipients, My preorders,
// Followed sellers, Reviews to write, Wallet & credit, Wishlist, — divider —
// Addresses, Payments, Profile, Login & security, Communications,
// — divider — Sign out (rendered separately below).
const SECTIONS: SectionDef[] = [
  { id: "orders", label: "Orders", headerLabel: "Orders", icon: "📦",
    description: "Track deliveries, download receipts, buy again, or start a return.",
    Component: OrdersSection },
  { id: "recipients", label: "Recipients", headerLabel: "Recipients", icon: "👪",
    description: "Your family & friends address book. Ship to them in one tap at checkout.",
    Component: RecipientsSection },
  { id: "preorders", label: "My preorders", headerLabel: "My preorders", icon: "⏳",
    description: "Campaign pledges you've committed to. You're charged only when the campaign locks.",
    Component: PreordersSection },
  { id: "sellers", label: "Followed sellers", headerLabel: "Followed sellers", icon: "🏪",
    description: "Shops you follow. Get first word on new drops, restocks, and campaigns.",
    Component: FollowedSellersSection },
  { id: "reviews", label: "Reviews to write", headerLabel: "Reviews to write", icon: "⭐",
    description: "Rate and review the items you've received.",
    Component: ReviewsToWriteSection },
  { id: "wallet", label: "Wallet & credit", headerLabel: "Wallet & credit", icon: "💳",
    description: "Store credit and referral earnings. Applied automatically at checkout.",
    Component: WalletSection },
  { id: "wishlist", label: "Wishlist", headerLabel: "Wishlist", icon: "❤️",
    description: "Products you've saved for later. Move them to your cart anytime.",
    Component: WishlistSection },
  { id: "addresses", label: "Addresses", headerLabel: "Addresses", icon: "📍",
    description: "Add, edit, or set a default delivery address for checkout.",
    Component: AddressesSection },
  { id: "payments", label: "Payments", headerLabel: "Payment methods", icon: "💠",
    description: "Cards you saved at checkout. Tokenized by Stripe — we never store raw card numbers.",
    Component: PaymentsSection },
  { id: "profile", label: "Profile", headerLabel: "Profile", icon: "👤",
    description: "Your personal information on file with AfroTransact.",
    Component: ProfileSection },
  { id: "security", label: "Login & security", headerLabel: "Login and security", icon: "🔒",
    description: "Manage how you sign in and protect your account.",
    Component: SecuritySection },
  { id: "notifications", label: "Communications", headerLabel: "Communications", icon: "🔔",
    description: "Choose which emails you want to receive. Changes save automatically.",
    Component: NotificationsSection },
]

const SECTION_IDS = new Set<string>(SECTIONS.map((s) => s.id))

// Sections after which a divider renders in the rail, per the mockup.
const DIVIDER_AFTER: ReadonlySet<SectionId> = new Set(["wishlist", "notifications"])

function sectionFromHash(): SectionId {
  if (typeof window === "undefined") return DEFAULT_SECTION
  const hash = window.location.hash.replace("#", "")
  return SECTION_IDS.has(hash) ? (hash as SectionId) : DEFAULT_SECTION
}

function initialOf(name: string, email: string): string {
  const src = (name || email || "?").trim()
  return src ? src[0]!.toUpperCase() : "?"
}

export function AccountClient({ firstName, email }: { firstName: string; email: string }) {
  const [activeSection, setActiveSection] = useState<SectionId>(DEFAULT_SECTION)

  useEffect(() => {
    setActiveSection(sectionFromHash())
  }, [])

  // Real counts only where a backend exists — Orders and Wishlist. The other
  // rail items have no backend yet, so they never show a badge.
  const ordersCountQuery = useQuery({
    queryKey: ["account-hub", "orders-count"],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) return 0
      const page = await getBuyerOrders(token, 0, 1)
      return page.totalElements
    },
    staleTime: 30_000,
  })

  const wishlistCountQuery = useQuery({
    queryKey: ["account-hub", "wishlist-count"],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) return 0
      const page = await getWishlist(token, 0, 1)
      return page.totalElements
    },
    staleTime: 30_000,
  })

  const counts: Partial<Record<SectionId, number>> = {
    orders: ordersCountQuery.data,
    wishlist: wishlistCountQuery.data,
  }

  // Wallet ("Wallet & credit") is driven by the referral program — hide the
  // rail item entirely (not just an empty state) when referral is off.
  const referralEnabledQuery = useQuery({
    queryKey: ["account-hub", "referral-enabled"],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) return false
      const me = await getReferralMe(token)
      return me?.enabled === true
    },
    staleTime: 60_000,
  })
  const referralEnabled = referralEnabledQuery.data === true

  // Rail visibility: Recipients is hidden for now (diaspora ship-to not
  // launched), and Wallet only appears when the referral program is enabled.
  const visibleSections = useMemo(
    () => SECTIONS.filter(
      (s) => s.id !== "recipients" && (s.id !== "wallet" || referralEnabled),
    ),
    [referralEnabled],
  )

  function selectSection(id: SectionId) {
    setActiveSection(id)
    if (typeof window !== "undefined") {
      history.replaceState(null, "", `#${id}`)
    }
  }

  function handleSignOut() {
    clearClientCartOnly()
    void signOut({ callbackUrl: "/" })
  }

  const active = useMemo(
    () => visibleSections.find((s) => s.id === activeSection) ?? visibleSections[0],
    [activeSection, visibleSections],
  )
  const ActiveComponent = active.Component

  return (
    <div className="mx-auto max-w-[1140px] px-4 sm:px-6 py-6 lg:py-10">
      {/* Greeting header */}
      <header className="mb-6 flex items-center gap-4 rounded-3xl border border-border bg-card px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-gold text-2xl font-black text-brand-gold-foreground shadow-[0_2px_8px_rgba(255,212,0,0.35)]">
          {initialOf(firstName, email)}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {firstName ? `Hi, ${firstName}` : "Your Account"}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{email}</p>
        </div>
      </header>

      {/* Mobile: horizontal scrollable chip bar */}
      <nav aria-label="Account sections" className="mb-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {visibleSections.map((section) => {
          const isActive = section.id === activeSection
          const count = counts[section.id]
          return (
            <button
              key={section.id}
              type="button"
              aria-current={isActive ? "true" : undefined}
              onClick={() => selectSection(section.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "border-brand-gold bg-brand-gold/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-[15px] leading-none" aria-hidden="true">{section.icon}</span>
              {section.label}
              {typeof count === "number" && count > 0 && (
                <span className="rounded-full bg-brand-gold/15 px-1.5 py-0.5 text-[11px] font-bold text-brand-gold-ink">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* Desktop rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-[20px] border border-border bg-card p-2 shadow-sm">
            <nav aria-label="Account sections" role="tablist" aria-orientation="vertical" className="space-y-0.5">
              {visibleSections.map((section) => {
                const isActive = section.id === activeSection
                const count = counts[section.id]
                return (
                  <div key={section.id}>
                    <button
                      id={`account-tab-${section.id}`}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls="account-panel"
                      tabIndex={isActive ? 0 : -1}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => selectSection(section.id)}
                      className={`relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${
                        isActive
                          ? "bg-brand-gold/15 font-semibold text-foreground"
                          : "font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold"
                        />
                      )}
                      <span className="w-[18px] shrink-0 text-center text-[16px] leading-none" aria-hidden="true">
                        {section.icon}
                      </span>
                      <span className="flex-1 truncate">{section.label}</span>
                      {typeof count === "number" && count > 0 && (
                        <span className="rounded-full bg-brand-gold/15 px-2 py-0.5 text-[11px] font-bold text-brand-gold-ink">
                          {count}
                        </span>
                      )}
                    </button>
                    {DIVIDER_AFTER.has(section.id) && (
                      <div className="my-1.5 h-px bg-border" aria-hidden="true" />
                    )}
                  </div>
                )
              })}
            </nav>

            <div className="my-1.5 h-px bg-border" />

            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            >
              <span className="w-[18px] shrink-0 text-center text-[16px] leading-none" aria-hidden="true">↩︎</span>
              Sign out
            </button>
          </div>
        </aside>

        {/* Content column */}
        <section
          id="account-panel"
          className="min-w-0 max-w-[840px]"
          role="tabpanel"
          aria-labelledby={`account-tab-${active.id}`}
          tabIndex={0}
          aria-live="polite"
        >
          <div className="mb-5 border-b border-border pb-4">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              {active.headerLabel}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{active.description}</p>
          </div>
          <ActiveComponent />
        </section>
      </div>
    </div>
  )
}
