"use client"

/**
 * AccountClient — Amazon-style "Your Account" hub.
 *
 * A dashboard of link-cards, each punching out to its own dedicated
 * route (deep-linkable, bookmarkable, each wrapped in AccountShell).
 * This replaces the old single tall-scrolling page with sticky in-page
 * nav — there is no anchor-jump nav or inline section rendering here
 * anymore. Section components (ProfileSection, SecuritySection, etc.)
 * are untouched and still live at their own routes.
 */

import Link from "next/link"
import {
  User as UserIcon,
  Lock,
  MapPin,
  CreditCard,
  Bell,
  Heart,
  ShoppingBag,
  ChevronRight,
  type LucideIcon,
} from "lucide-react"
import { SignOutButton } from "@/components/account/SignOutButton"

interface AccountCard {
  title: string
  href: string
  description: string
  icon: LucideIcon
}

const CARDS: AccountCard[] = [
  {
    title: "Your Orders",
    href: "/orders",
    description: "Track, return, or buy again.",
    icon: ShoppingBag,
  },
  {
    title: "Login & Security",
    href: "/account/security",
    description: "Password and account access.",
    icon: Lock,
  },
  {
    title: "Your Addresses",
    href: "/account/addresses",
    description: "Edit or add delivery addresses.",
    icon: MapPin,
  },
  {
    title: "Payment Options",
    href: "/account/payments",
    description: "Manage your saved cards.",
    icon: CreditCard,
  },
  {
    title: "Your Profile",
    href: "/account/profile",
    description: "Name and personal details.",
    icon: UserIcon,
  },
  {
    title: "Communications",
    href: "/account/notifications",
    description: "Email & message preferences.",
    icon: Bell,
  },
  {
    title: "Your Wishlist",
    href: "/account/wishlist",
    description: "Items you're saving for later.",
    icon: Heart,
  },
]

export function AccountClient({ firstName, email }: { firstName: string; email: string }) {
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold-ink transition-colors group-hover:bg-brand-gold/25">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-1 text-base font-semibold text-foreground">
                  {card.title}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">Signed in as {email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Need to switch accounts or take a break?
          </p>
        </div>
        <SignOutButton />
      </div>
    </div>
  )
}
