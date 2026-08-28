"use client"

/**
 * AccountClient — self-contained "Your Account" settings experience.
 *
 * Everything happens on this one page: a left sidebar lists the sections
 * (Profile, Login & security, Addresses, Payments, Communications); clicking
 * one swaps `activeSection` state and renders that section's form in the
 * main panel. There is NO route navigation here — no <Link> to another
 * account route, no router.push. On small screens the sidebar collapses
 * into a horizontal scrollable tab bar above the panel.
 *
 * The section forms themselves (ProfileSection, SecuritySection, etc.) are
 * untouched — they still live at their standalone /account/<name> routes
 * (kept for bookmarks) and are simply re-hosted here.
 */

import { useEffect, useMemo, useState } from "react"
import {
  User as UserIcon,
  Lock,
  MapPin,
  CreditCard,
  Bell,
  type LucideIcon,
} from "lucide-react"
import { SignOutButton } from "@/components/account/SignOutButton"
import { ProfileSection } from "@/app/(main)/account/profile/page"
import { SecuritySection } from "@/app/(main)/account/security/page"
import { AddressesSection } from "@/app/(main)/account/addresses/page"
import { PaymentsSection } from "@/app/(main)/account/payments/page"
import { NotificationsSection } from "@/app/(main)/account/notifications/page"

type SectionId = "profile" | "security" | "addresses" | "payments" | "notifications"

interface SectionDef {
  id: SectionId
  label: string
  description: string
  icon: LucideIcon
  Component: () => React.JSX.Element | null
}

const SECTIONS: SectionDef[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Your personal information on file with AfroTransact.",
    icon: UserIcon,
    Component: ProfileSection,
  },
  {
    id: "security",
    label: "Login & security",
    description: "Manage how you sign in and protect your account.",
    icon: Lock,
    Component: SecuritySection,
  },
  {
    id: "addresses",
    label: "Addresses",
    description: "Add, edit, or set a default delivery address for checkout.",
    icon: MapPin,
    Component: AddressesSection,
  },
  {
    id: "payments",
    label: "Payments",
    description: "Cards you have saved at checkout. Tokenized by Stripe — we never store raw card numbers.",
    icon: CreditCard,
    Component: PaymentsSection,
  },
  {
    id: "notifications",
    label: "Communications",
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

export function AccountClient({ firstName, email }: { firstName: string; email: string }) {
  const [activeSection, setActiveSection] = useState<SectionId>("profile")

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

  const active = useMemo(
    () => SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0],
    [activeSection],
  )
  const ActiveComponent = active.Component

  return (
    <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-8 lg:py-12">
      <header className="mb-8 lg:mb-10">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          Your Account
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          Hi {firstName} — signed in as{" "}
          <span className="font-semibold text-foreground">{email}</span>.
        </p>
      </header>

      {/* Mobile: horizontal scrollable tab bar */}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <nav
            aria-label="Account sections"
            className="sticky top-6 rounded-2xl border border-border bg-card p-2 shadow-sm"
          >
            {SECTIONS.map((section) => {
              const Icon = section.icon
              const isActive = section.id === activeSection
              return (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => selectSection(section.id)}
                  className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${
                    isActive
                      ? "bg-brand-gold/15 text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-brand-gold"
                    />
                  )}
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-foreground" : ""}`} aria-hidden="true" />
                  {section.label}
                </button>
              )
            })}
          </nav>

          <div className="mt-4">
            <SignOutButton />
          </div>
        </aside>

        {/* Main panel */}
        <section className="min-w-0" role="tabpanel" aria-live="polite">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <header className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold-ink">
                <active.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">{active.label}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{active.description}</p>
              </div>
            </header>
            <ActiveComponent />
          </div>

          {/* Mobile sign-out, below the panel */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-5 lg:hidden">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">Signed in as {email}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Need to switch accounts or take a break?
              </p>
            </div>
            <SignOutButton />
          </div>
        </section>
      </div>
    </div>
  )
}
