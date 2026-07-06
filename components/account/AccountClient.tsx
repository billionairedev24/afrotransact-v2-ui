"use client"

/**
 * AccountClient — consolidated settings layout.
 *
 * Renders the buyer-account sections in a single scrolling page with a
 * sticky in-page nav on lg+ (anchor jumps, not route changes). On mobile
 * the nav collapses; sections stack.
 *
 * Each section is the *embeddable* part of its sub-page (Profile,
 * Login & Security, Addresses, Payments, Notifications) — the
 * standalone deep-link routes still exist and render the same section
 * inside an AccountShell wrapper.
 */

import { useEffect, useState } from "react"
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
import { cn } from "@/lib/utils"

interface Section {
  id: string
  title: string
  blurb: string
  icon: LucideIcon
  render: () => React.ReactNode
}

const SECTIONS: Section[] = [
  {
    id: "profile",
    title: "Profile",
    blurb: "Your name, email, and phone on file.",
    icon: UserIcon,
    render: () => <ProfileSection />,
  },
  {
    id: "security",
    title: "Login & Security",
    blurb: "Change your password or close your account.",
    icon: Lock,
    render: () => <SecuritySection />,
  },
  {
    id: "addresses",
    title: "Addresses",
    blurb: "Manage delivery addresses and the default for checkout.",
    icon: MapPin,
    render: () => <AddressesSection />,
  },
  {
    id: "payments",
    title: "Payment methods",
    blurb: "Saved cards, tokenised by Stripe. Set a default for 1-click reorder.",
    icon: CreditCard,
    render: () => <PaymentsSection />,
  },
  {
    id: "notifications",
    title: "Notifications",
    blurb: "Choose which emails and alerts you receive.",
    icon: Bell,
    render: () => <NotificationsSection />,
  },
]

/** Anchor-driven nav: highlights whichever section is currently in view. */
function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? "")
  useEffect(() => {
    if (typeof window === "undefined") return
    const obs = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting section.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [ids])
  return active
}

export function AccountClient({ firstName, email }: { firstName: string; email: string }) {
  const active = useActiveSection(SECTIONS.map((s) => s.id))

  return (
    <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-6 lg:py-10">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Hi {firstName}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Manage your account, addresses, and preferences. Signed in as{" "}
          <span className="font-semibold text-foreground">{email}</span>.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Sticky in-page nav. Anchor jumps within the same page — no route
            changes, no card-tile detour to a second screen. */}
        <aside className="hidden lg:block">
          <nav className="sticky top-6 space-y-0.5 rounded-2xl border border-border bg-card p-2 shadow-sm">
            {SECTIONS.map((s) => {
              const Icon = s.icon
              const isActive = active === s.id
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-muted font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {s.title}
                </a>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-12">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            return (
              <section
                key={s.id}
                id={s.id}
                aria-labelledby={`${s.id}-title`}
                className="scroll-mt-6"
              >
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id={`${s.id}-title`}
                      className="text-lg font-semibold text-foreground"
                    >
                      {s.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">{s.blurb}</p>
                  </div>
                </div>
                {s.render()}
              </section>
            )
          })}

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                Signed in as {email}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Need to switch accounts or take a break?
              </p>
            </div>
            <SignOutButton />
          </section>
        </div>
      </div>
    </div>
  )
}
