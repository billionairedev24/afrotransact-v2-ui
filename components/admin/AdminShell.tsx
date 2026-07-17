"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard,
  MapPin,
  Users,
  Menu,
  X,
  ChevronLeft,
  ShieldCheck,
  FolderTree,
  Store,
  Package,
  ShoppingCart,
  LogOut,
  Star,
  ClipboardList,
  Banknote,
  BookOpen,
  Mail,
  Bell,
  Ticket,
  Sparkles,
  BarChart2,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSignOut } from "@/hooks/useSignOut"
import { getAccessToken } from "@/lib/auth-helpers"
import { getAdminProducts, getAdminSellers } from "@/lib/api"
import { useWorkQueueCounts } from "@/hooks/use-admin-stats"
import { useAdminAnalyticsNavVisible } from "@/hooks/use-analytics-settings"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
  badge?: number
  // Phase 9: when true, render as an outbound link to another property
  // (typically the Inventory app for catalog management). Catalog admin
  // is intentionally NOT duplicated in this UI; it lives in the
  // Inventory app per the architecture-target-state revision.
  external?: boolean
}

interface NavGroup {
  title: string | null   // null = top-level (no group header)
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [
      { href: "/admin",            label: "Overview",   icon: LayoutDashboard, exact: true },
      { href: "/admin/analytics",  label: "Analytics",  icon: BarChart2 },
      { href: "/admin/work-queue", label: "Work Queue", icon: ClipboardList },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/admin/products",      label: "Products",      icon: Package },
      { href: "/admin/categories",    label: "Categories",    icon: FolderTree },
      {
        // Catalog item curation lives in the Inventory app — same team
        // who manages physical stock also owns the master catalog. URL
        // is env-driven so dev (3010) / staging / prod each land on the
        // right host. NEXT_PUBLIC_INVENTORY_WEB_URL is the public name
        // the admin's browser can reach.
        href: process.env.NEXT_PUBLIC_INVENTORY_WEB_URL || "http://localhost:3010",
        label: "Inventory",
        icon: BookOpen,
        external: true,
      },
      { href: "/admin/deals",         label: "Deals",         icon: Sparkles },
      { href: "/admin/coupons",       label: "Coupons",       icon: Ticket },
      { href: "/admin/promotions", label: "Promotions", icon: Sparkles },
    ],
  },
  {
    title: "Commerce",
    items: [
      { href: "/admin/orders",     label: "Orders",     icon: ShoppingCart },
      { href: "/admin/abandoned-checkouts", label: "Abandoned Carts", icon: ShoppingCart },
      { href: "/admin/refunds",    label: "Refunds",    icon: Banknote },
      { href: "/admin/payouts",    label: "Payouts",    icon: Banknote },
      { href: "/admin/accounting", label: "Accounting", icon: BookOpen },
      { href: "/admin/reviews",    label: "Reviews",    icon: Star },
    ],
  },
  {
    title: "Sellers",
    items: [
      { href: "/admin/sellers", label: "Sellers", icon: Store },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
    ],
  },
  {
    title: "Settings",
    items: [
      // Service Locations is now the ONLY place to configure operational
      // areas — shipping rates, free-shipping threshold, tax, and per-
      // location feature toggles all live here. Legacy /admin/regions
      // is hidden; /admin/zones remains reachable via URL only.
      { href: "/admin/zones",                label: "Service Locations", icon: MapPin },
      { href: "/admin/subscription",         label: "Plans",           icon: ShieldCheck },
      { href: "/admin/email-templates",      label: "Email Templates", icon: Mail },
      { href: "/admin/notification-routing", label: "Alert Routing",   icon: Bell },
      { href: "/admin/settings",             label: "Settings",        icon: Settings },
    ],
  },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { status: sessionStatus } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: qStats } = useWorkQueueCounts()
  const queueCount = qStats?.total ?? 0
  const signOut = useSignOut()
  const showAdminAnalytics = useAdminAnalyticsNavVisible()

  const navGroups: NavGroup[] = NAV_GROUPS.map((g) => ({
    title: g.title,
    items: g.items
      .filter((item) => showAdminAnalytics || item.href !== "/admin/analytics")
      .map((item) =>
        item.href === "/admin/work-queue" ? { ...item, badge: queueCount } : item,
      ),
  })).filter((g) => g.items.length > 0)

  const navLink = (item: NavItem, onClick?: () => void) => {
    const Icon = item.icon
    const active = !item.external && (item.exact ? pathname === item.href : pathname.startsWith(item.href))
    const body = (
      <>
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
            {item.badge}
          </span>
        )}
        {item.external && (
          <span aria-hidden className="text-[10px] text-white/40">↗</span>
        )}
      </>
    )
    const cls = cn(
      "flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors",
      active
        ? "bg-brand-gold text-brand-gold-foreground font-bold"
        : "text-white/70 font-medium hover:bg-white/5 hover:text-brand-gold",
    )
    if (item.external) {
      return (
        <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
           onClick={onClick} className={cls}>
          {body}
        </a>
      )
    }
    return (
      <Link key={item.href} href={item.href} onClick={onClick}
            aria-current={active ? "page" : undefined} className={cls}>
        {body}
      </Link>
    )
  }

  const sidebar = (onClose?: () => void) => (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-6 px-2">
        <Image
          src="/brand/logo-mark.svg"
          alt="AfroTransact"
          width={32}
          height={37}
          className="h-8 w-auto"
          priority
        />
        {onClose && (
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto scrollbar-hide">
        {navGroups.map((group, gi) => (
          <div key={group.title ?? `g-${gi}`} className={cn(gi > 0 && "mt-4")}>
            {group.title && (
              <p className="px-4 mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                {group.title}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => navLink(item, onClose))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-auto pt-6 border-t border-white/10 flex flex-col gap-2">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2 px-2 text-sm text-white/60 hover:text-brand-gold transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Marketplace
        </Link>
        <button
          onClick={() => { signOut() }}
          className="flex w-full items-center gap-2 px-2 py-2 text-sm font-semibold text-white/60 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen min-w-0 bg-gray-50">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-input px-4 md:hidden bg-white">
        <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-foreground transition-colors">
          <Menu className="h-5 w-5" />
        </button>
        <Image
          src="/brand/logo-mark.svg"
          alt="AfroTransact"
          width={28}
          height={32}
          className="h-7 w-auto"
        />
        <div className="w-5" />
      </header>

      <div className="flex min-w-0">
        {/* Desktop sidebar — wider (72) + white surface to match seller dashboard chrome */}
        <aside className="hidden md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 bg-brand-dark">
          {sidebar()}
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-72 flex flex-col shadow-xl bg-brand-dark">
              {sidebar(() => setSidebarOpen(false))}
            </aside>
          </div>
        )}

        {/* Content */}
        <main className="min-w-0 flex-1 md:pl-72">
          <div className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
