"use client"

/**
 * Shared chrome for every page under /account.
 *
 * Layout:
 *  - Mobile (< lg): no sidebar; back-to-hub breadcrumb above the title.
 *  - Desktop (lg+): sticky left rail with active-link highlighting and
 *    the section title rendered to its right.
 *
 * Subpages render `<AccountShell title=... subtitle=...>{content}</AccountShell>`.
 * The hub page (/account) renders <AccountHubGrid/> as children with `variant="hub"`,
 * which hides the breadcrumb (there's nowhere to go back to).
 */

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Package,
  User,
  Lock,
  MapPin,
  CreditCard,
  Bell,
  Heart,
  HelpCircle,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  external?: boolean
}

const NAV: NavItem[] = [
  { href: "/orders", label: "Your Orders", icon: Package, external: true },
  { href: "/account/profile", label: "Profile", icon: User },
  { href: "/account/security", label: "Login & Security", icon: Lock },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/payments", label: "Payment Methods", icon: CreditCard },
  { href: "/account/notifications", label: "Notifications", icon: Bell },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart, external: true },
  { href: "/help", label: "Help & Support", icon: HelpCircle, external: true },
]

export interface AccountShellProps {
  title: string
  subtitle?: string
  variant?: "subpage" | "hub"
  children: ReactNode
}

export function AccountShell({ title, subtitle, variant = "subpage", children }: AccountShellProps) {
  const pathname = usePathname() ?? ""

  return (
    <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-6 lg:py-8">
      {variant === "subpage" && (
        <Link
          href="/account"
          className="md:hidden inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" /> Your Account
        </Link>
      )}

      <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden md:block">
          <nav
            aria-label="Account navigation"
            className="sticky top-6 rounded-2xl border border-border bg-card p-2 shadow-sm"
          >
            {NAV.map((item) => {
              const Icon = item.icon
              const active =
                !item.external &&
                (pathname === item.href || pathname.startsWith(item.href + "/"))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-brand-gold/15 text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-foreground" : ""}`} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          </header>
          {children}
        </section>
      </div>
    </div>
  )
}
