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
  Percent,
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSignOut } from "@/hooks/useSignOut"
import { getAccessToken } from "@/lib/auth-helpers"
import { getAdminProducts, getAdminSellers } from "@/lib/api"
import { useWorkQueueCounts } from "@/hooks/use-admin-stats"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
  badge?: number
}

const BASE_NAV_ITEMS: NavItem[] = [
  { href: "/admin",               label: "Overview",      icon: LayoutDashboard, exact: true },
  { href: "/admin/work-queue",    label: "Work Queue",    icon: ClipboardList    },
  { href: "/admin/categories",    label: "Categories",    icon: FolderTree       },
  { href: "/admin/sellers",       label: "Sellers",       icon: Store            },
  { href: "/admin/products",      label: "Products",      icon: Package          },
  { href: "/admin/orders",        label: "Orders",        icon: ShoppingCart     },
  { href: "/admin/regions",       label: "Regions",       icon: MapPin           },
  { href: "/admin/feature-flags", label: "Feature Flags", icon: ToggleLeft       },
  { href: "/admin/commission",    label: "Commission",    icon: Percent          },
  {href: "/admin/subscription",  label: "Subscriptions", icon: ShieldCheck      },
  { href: "/admin/settings/billing", label: "Billing Settings", icon: ClipboardList   },
  { href: "/admin/reviews",       label: "Reviews",       icon: Star             },
  { href: "/admin/payouts",          label: "Payouts",          icon: Banknote      },
  { href: "/admin/payment-settings", label: "Payment Settings", icon: Percent       },
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

  const navItems: NavItem[] = BASE_NAV_ITEMS.map((item) =>
    item.href === "/admin/work-queue" ? { ...item, badge: queueCount } : item
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
            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
            {item.badge}
          </span>
        )}
      </Link>
    )
  }

  const sidebar = (onClose?: () => void) => (
    <div className="flex flex-col h-full">
      <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-bold text-gray-900 text-sm">Admin</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => navLink(item, onClose))}
      </nav>
      <div className="border-t border-gray-200 p-4 space-y-2">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Marketplace
        </Link>
        <button
          onClick={() => { signOut() }}
          className="flex w-full items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors"
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
      <header
        className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 px-4 lg:hidden bg-white"
      >
        <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-gray-900">
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Admin Panel
        </span>
        <div className="w-5" />
      </header>

      <div className="flex min-w-0">
        {/* Desktop sidebar */}
        <aside
          className="hidden lg:flex lg:w-56 lg:flex-col lg:fixed lg:inset-y-0 border-r border-gray-200 bg-white"
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
              className="absolute inset-y-0 left-0 w-64 flex flex-col border-r border-gray-200 shadow-xl bg-white"
            >
              {sidebar(() => setSidebarOpen(false))}
            </aside>
          </div>
        )}

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:pl-56">
          <div className="mx-auto min-w-0 max-w-[1100px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
