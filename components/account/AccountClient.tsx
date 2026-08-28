"use client"

/**
 * AccountClient — "Your Account", laid out as a single branded page: a left
 * rail of sections (icon + label, active item marked with a gold ground and
 * accent bar) beside a content column that renders the active section.
 *
 * Everything happens on this one page: clicking a rail item swaps
 * `activeSection` client state and renders that section's content. There is
 * NO route navigation here — no <Link> to another account route, no
 * router.push. The URL hash is kept in sync via `history.replaceState` only,
 * for bookmarking/refresh, never for navigation. On small screens the rail
 * collapses into a horizontal scrollable chip bar above the content.
 *
 * The visual language is AfroTransact's own — brand gold (#FFD400) as the
 * single accent, deep amber-gold ink for text/icons on light, storefront
 * card + border tokens — not a generic settings-app grey. The section forms
 * (ProfileSection, SecuritySection, etc.) are unchanged; only the shell
 * around them lives here.
 */

import { useEffect, useMemo, useState } from "react"
import {
  User as UserIcon,
  Lock,
  MapPin,
  CreditCard,
  Bell,
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
  Component: () => React.JSX.Element | null
}

const SECTIONS: SectionDef[] = [
  {
    id: "profile",
    label: "Profile",
    headerLabel: "Profile",
    description: "Your personal information on file with AfroTransact.",
    icon: UserIcon,
    Component: ProfileSection,
  },
  {
    id: "security",
    label: "Login & security",
    headerLabel: "Login and security",
    description: "Manage how you sign in and protect your account.",
    icon: Lock,
    Component: SecuritySection,
  },
  {
    id: "addresses",
    label: "Addresses",
    headerLabel: "Addresses",
    description: "Add, edit, or set a default delivery address for checkout.",
    icon: MapPin,
    Component: AddressesSection,
  },
  {
    id: "payments",
    label: "Payments",
    headerLabel: "Payment methods",
    description: "Cards you saved at checkout. Tokenized by Stripe — we never store raw card numbers.",
    icon: CreditCard,
    Component: PaymentsSection,
  },
  {
    id: "notifications",
    label: "Communications",
    headerLabel: "Communications",
    description: "Choose which emails you want to receive. Changes save automatically.",
    icon: Bell,
    Component: NotificationsSection,
  },
]

const SECTION_IDS = new Set<string>(SECTIONS.map((s) => s.id))

function sectionFromHash(): SectionId {
  if (typeof window === "undefined") return "profile"
  const hash = window.location.hash.replace("#", "")
  return SECTION_IDS.has(hash) ? (hash as SectionId) : "profile"
}

function initialOf(name: string, email: string): string {
  const src = (name || email || "?").trim()
  return src ? src[0]!.toUpperCase() : "?"
}

export function AccountClient({ firstName, email }: { firstName: string; email: string }) {
  const [activeSection, setActiveSection] = useState<SectionId>("profile")

  // Pick up a deep-linked hash (e.g. #security) on mount only — a read of the
  // current URL, not a navigation.
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

  return (
    <div className="mx-auto max-w-[1140px] px-4 sm:px-6 py-6 lg:py-10">
      {/* Branded greeting header */}
      <header className="mb-7 flex items-center gap-4 rounded-3xl border border-border bg-card px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-gold text-2xl font-black text-brand-gold-foreground shadow-sm">
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
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${
                isActive
                  ? "border-brand-gold bg-brand-gold text-brand-gold-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {section.label}
            </button>
          )
        })}
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* Desktop rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-2xl border border-border bg-card p-2">
            <nav aria-label="Account sections" className="space-y-1">
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
                    className={`relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${
                      isActive
                        ? "bg-brand-gold/15 font-semibold text-foreground"
                        : "text-foreground/80 hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold"
                      />
                    )}
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

            <div className="my-2 h-px bg-border" />

            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </aside>

        {/* Content column */}
        <section className="min-w-0 max-w-[820px]" role="tabpanel" aria-live="polite">
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
