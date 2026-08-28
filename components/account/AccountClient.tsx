"use client"

/**
 * AccountClient — "Your Account" settings, laid out like Chrome's
 * chrome://settings: a fixed left sidebar of sections (icon + label, active
 * item shown as a rounded pill) next to a wide main column that starts with
 * a search box and then renders the active section as a stack of rounded
 * row-cards.
 *
 * Everything happens on this one page: clicking a sidebar item swaps
 * `activeSection` client state and renders that section's content in the
 * main column. There is NO route navigation here — no <Link> to another
 * account route, no router.push. The URL hash is kept in sync via
 * `history.replaceState` only, for bookmarking/refresh, never for
 * navigation. On small screens the sidebar collapses into a horizontal
 * scrollable pill bar above the content.
 *
 * The section forms themselves (ProfileSection, SecuritySection, etc.) are
 * untouched — their data/handlers/validation are unchanged. They still live
 * at their standalone /account/<name> routes (kept for bookmarks) and are
 * simply re-hosted here; only the row/card presentation around them (e.g.
 * notifications' toggle rows) has been restyled to match Chrome.
 */

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  User as UserIcon,
  Lock,
  MapPin,
  CreditCard,
  Bell,
  Search,
  LogOut,
  type LucideIcon,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { clearClientCartOnly } from "@/lib/client-cart-cleanup"
import { ProfileSection } from "@/app/(main)/account/profile/page"
import { SecuritySection } from "@/app/(main)/account/security/page"
import { AddressesSection } from "@/app/(main)/account/addresses/page"
import { PaymentsSection } from "@/app/(main)/account/payments/page"
import { NotificationsSection } from "@/app/(main)/account/notifications/page"

type SectionId = "profile" | "security" | "addresses" | "payments" | "notifications"

interface SectionDef {
  id: SectionId
  label: string
  headerLabel: string
  description: string
  icon: LucideIcon
  keywords: string[]
  Component: () => React.JSX.Element | null
}

const SECTIONS: SectionDef[] = [
  {
    id: "profile",
    label: "Profile",
    headerLabel: "Profile",
    description: "Your personal information on file with AfroTransact.",
    icon: UserIcon,
    keywords: ["name", "email", "phone", "profile", "personal"],
    Component: ProfileSection,
  },
  {
    id: "security",
    label: "Login & security",
    headerLabel: "Login and security",
    description: "Manage how you sign in and protect your account.",
    icon: Lock,
    keywords: ["password", "security", "login", "sign in", "close account", "delete"],
    Component: SecuritySection,
  },
  {
    id: "addresses",
    label: "Addresses",
    headerLabel: "Addresses",
    description: "Add, edit, or set a default delivery address for checkout.",
    icon: MapPin,
    keywords: ["address", "delivery", "shipping", "default"],
    Component: AddressesSection,
  },
  {
    id: "payments",
    label: "Payments",
    headerLabel: "Payment methods",
    description: "Cards you have saved at checkout. Tokenized by Stripe — we never store raw card numbers.",
    icon: CreditCard,
    keywords: ["card", "payment", "stripe", "billing"],
    Component: PaymentsSection,
  },
  {
    id: "notifications",
    label: "Communications",
    headerLabel: "Communications",
    description: "Choose which emails you want to receive. Changes save automatically.",
    icon: Bell,
    keywords: ["notification", "email", "newsletter", "promotion", "communication"],
    Component: NotificationsSection,
  },
]

const SECTION_IDS = new Set<string>(SECTIONS.map((s) => s.id))

function sectionFromHash(): SectionId {
  if (typeof window === "undefined") return "profile"
  const hash = window.location.hash.replace("#", "")
  return SECTION_IDS.has(hash) ? (hash as SectionId) : "profile"
}

export function AccountClient({ firstName, email }: { firstName: string; email: string }) {
  const [activeSection, setActiveSection] = useState<SectionId>("profile")
  const [query, setQuery] = useState("")

  // Pick up a deep-linked hash (e.g. #security) on mount only — this is a
  // read of the current URL, not a navigation.
  useEffect(() => {
    setActiveSection(sectionFromHash())
  }, [])

  function selectSection(id: SectionId) {
    setActiveSection(id)
    if (typeof window !== "undefined") {
      // Keep the hash in sync for bookmarking/refresh without navigating.
      history.replaceState(null, "", `#${id}`)
    }
  }

  function handleSignOut() {
    clearClientCartOnly()
    void signOut({ callbackUrl: "/" })
  }

  const active = useMemo(
    () => SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0],
    [activeSection],
  )
  const ActiveComponent = active.Component

  // Lightweight search: if the query doesn't match the active section at
  // all, surface the best-matching sections so the user can jump to them.
  // This keeps the search bar functional without needing to index every
  // row inside every section's own component.
  const normalizedQuery = query.trim().toLowerCase()
  const activeMatches =
    normalizedQuery.length === 0 ||
    active.label.toLowerCase().includes(normalizedQuery) ||
    active.description.toLowerCase().includes(normalizedQuery) ||
    active.keywords.some((k) => k.includes(normalizedQuery))

  const suggestions =
    normalizedQuery.length > 0
      ? SECTIONS.filter(
          (s) =>
            s.id !== active.id &&
            (s.label.toLowerCase().includes(normalizedQuery) ||
              s.description.toLowerCase().includes(normalizedQuery) ||
              s.keywords.some((k) => k.includes(normalizedQuery))),
        )
      : []

  return (
    <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-6 lg:py-10">
      {/* Mobile: horizontal scrollable pill bar */}
      <nav
        aria-label="Account sections"
        className="mb-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
      >
        {SECTIONS.map((section) => {
          const Icon = section.icon
          const isActive = section.id === activeSection
          return (
            <button
              key={section.id}
              type="button"
              aria-current={isActive ? "true" : undefined}
              onClick={() => selectSection(section.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${
                isActive
                  ? "border-brand-gold bg-brand-gold/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {section.label}
            </button>
          )
        })}
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[272px_minmax(0,1fr)]">
        {/* Desktop sidebar — Chrome settings style */}
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <div className="flex items-center gap-2.5 px-2 mb-1">
              <Image src="/brand/logo-gold.svg" alt="" width={22} height={22} className="shrink-0" />
              <h1 className="font-display text-lg font-bold tracking-tight text-foreground">
                Your Account
              </h1>
            </div>
            <p className="px-2 mb-5 text-xs text-muted-foreground truncate">
              Hi {firstName} · <span className="text-foreground/80">{email}</span>
            </p>

            <nav aria-label="Account sections" className="space-y-0.5">
              {SECTIONS.map((section) => {
                const Icon = section.icon
                const isActive = section.id === activeSection
                return (
                  <button
                    key={section.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => selectSection(section.id)}
                    className={`flex w-full items-center gap-3.5 rounded-full px-4 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${
                      isActive
                        ? "bg-brand-gold/15 text-foreground font-semibold"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 ${
                        isActive ? "text-brand-gold-ink" : "text-muted-foreground"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{section.label}</span>
                  </button>
                )
              })}
            </nav>

            <div className="my-3 h-px bg-border" />

            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3.5 rounded-full px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content column */}
        <section className="min-w-0 max-w-[820px]" role="tabpanel" aria-live="polite">
          {/* Search */}
          <div className="relative mb-8">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="account-settings-search" className="sr-only">
              Search settings
            </label>
            <input
              id="account-settings-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              className="h-11 w-full rounded-full border border-transparent bg-muted pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-brand-gold focus:bg-background focus:ring-2 focus:ring-brand-gold/30"
            />
          </div>

          {suggestions.length > 0 && (
            <div className="mb-6 rounded-2xl border border-border bg-card p-2">
              <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Other matching settings
              </p>
              {suggestions.map((s) => {
                const Icon = s.icon
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { selectSection(s.id); setQuery("") }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {s.label}
                  </button>
                )
              })}
            </div>
          )}

          {activeMatches ? (
            <div>
              <h2 className="mb-3 px-1 text-sm font-medium text-muted-foreground">
                {active.headerLabel}
              </h2>
              <p className="mb-4 px-1 text-sm text-muted-foreground/80">{active.description}</p>
              <ActiveComponent />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
              No settings here match &ldquo;{query}&rdquo;. Try another section from the list above.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
