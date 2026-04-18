"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard,
  MapPin,
  Megaphone,
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
  { href: "/admin/ads",           label: "Ad Slots",      icon: Megaphone        },
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
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
            {item.badge}
          </span>
        )}
      </Link>
    )
  }

  const sidebar = (onClose?: () => void) => (
    <div className="flex flex-col h-full">
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground text-sm">Admin</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => navLink(item, onClose))}
      </nav>
      <div className="border-t border-border p-4 space-y-2">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Marketplace
        </Link>
        <button
          onClick={() => { signOut() }}
          className="flex w-full items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen min-w-0 bg-background">
      {/* Mobile header */}
      <header
        className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border px-4 lg:hidden bg-card"
      >
        <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground transition-colors">
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Admin Panel
        </span>
        <div className="w-5" />
      </header>

      <div className="flex min-w-0">
        {/* Desktop sidebar */}
        <aside
          className="hidden lg:flex lg:w-56 lg:flex-col lg:fixed lg:inset-y-0 border-r border-border bg-card"
        >
          {sidebar()}
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <aside
              className="absolute inset-y-0 left-0 w-64 flex flex-col border-r border-border shadow-xl bg-card"
            >
              {sidebar(() => setSidebarOpen(false))}
            </aside>
          </div>
        )}

        {/* Content */}
        <main className="min-w-0 flex-1 lg:pl-56">
          <div className="mx-auto min-w-0 max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
