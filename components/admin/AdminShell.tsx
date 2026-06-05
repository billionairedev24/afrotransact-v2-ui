"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard,
  MapPin,
  ToggleLeft,
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
}

const BASE_NAV_ITEMS: NavItem[] = [
  { href: "/admin",               label: "Overview",      icon: LayoutDashboard, exact: true },
  { href: "/admin/analytics",    label: "Analytics",     icon: BarChart2        },
  { href: "/admin/work-queue",    label: "Work Queue",    icon: ClipboardList    },
  { href: "/admin/categories",    label: "Categories",    icon: FolderTree       },
  { href: "/admin/sellers",       label: "Sellers",       icon: Store            },
  { href: "/admin/products",      label: "Products",      icon: Package          },
  { href: "/admin/orders",        label: "Orders",        icon: ShoppingCart     },
  { href: "/admin/regions",       label: "Regions",       icon: MapPin           },
  { href: "/admin/feature-flags", label: "Feature Flags", icon: ToggleLeft       },
  { href: "/admin/subscription",     label: "Subscriptions",    icon: ShieldCheck   },
  { href: "/admin/reviews",          label: "Reviews",          icon: Star          },
  { href: "/admin/payouts",          label: "Payouts",          icon: Banknote      },
  { href: "/admin/settings",         label: "Settings",         icon: Settings      },
  { href: "/admin/coupons",       label: "Coupons",       icon: Ticket           },
  { href: "/admin/deals",         label: "Deals",         icon: Sparkles         },
  { href: "/admin/hero-carousel", label: "Hero Carousel", icon: Sparkles         },
  { href: "/admin/email-templates", label: "Email Templates", icon: Mail          },
  { href: "/admin/notification-routing", label: "Alert Routing", icon: Bell     },
  { href: "/admin/users",         label: "Users",         icon: Users            },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { status: sessionStatus } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: qStats } = useWorkQueueCounts()
  const queueCount = qStats?.total ?? 0
  const signOut = useSignOut()
  const showAdminAnalytics = useAdminAnalyticsNavVisible()

  const navItems: NavItem[] = BASE_NAV_ITEMS.filter(
    (item) => showAdminAnalytics || item.href !== "/admin/analytics",
  ).map((item) =>
    item.href === "/admin/work-queue" ? { ...item, badge: queueCount } : item,
  )

  const navLink = (item: NavItem, onClick?: () => void) => {
    const Icon = item.icon
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors",
          active
            ? "bg-brand-gold text-brand-gold-foreground font-bold"
            : "text-white/70 font-medium hover:bg-white/5 hover:text-brand-gold",
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
            {item.badge}
          </span>
        )}
      </Link>
    )
  }

  const sidebar = (onClose?: () => void) => (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-brand-gold">AfroTransact</span>
          <span className="rounded-sm bg-brand-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-gold-foreground">
            Admin
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => navLink(item, onClose))}
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
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 px-4 lg:hidden bg-white">
        <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-foreground transition-colors">
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-bold text-foreground text-sm flex items-center gap-2">
          AfroTransact
          <span className="rounded bg-brand-gold px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-gold-foreground">
            Admin
          </span>
        </span>
        <div className="w-5" />
      </header>

      <div className="flex min-w-0">
        {/* Desktop sidebar — wider (72) + white surface to match seller dashboard chrome */}
        <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-brand-dark">
          {sidebar()}
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
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
        <main className="min-w-0 flex-1 lg:pl-72">
          <div className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
