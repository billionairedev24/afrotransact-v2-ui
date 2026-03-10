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
  Ticket,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getAccessToken } from "@/lib/auth-helpers"
import { getAdminProducts, getAdminSellers } from "@/lib/api"

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
  { href: "/admin/coupons",       label: "Coupons",       icon: Ticket           },
  { href: "/admin/regions",       label: "Regions",       icon: MapPin           },
  { href: "/admin/feature-flags", label: "Feature Flags", icon: ToggleLeft       },
  { href: "/admin/commission",    label: "Commission",    icon: Percent          },
  { href: "/admin/subscription",  label: "Subscriptions", icon: ShieldCheck      },
  { href: "/admin/reviews",       label: "Reviews",       icon: Star             },
  { href: "/admin/payouts",       label: "Payouts",       icon: Banknote         },
  { href: "/admin/ads",           label: "Ad Slots",      icon: Megaphone        },
  { href: "/admin/users",         label: "Users",         icon: Users            },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { status: sessionStatus } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    if (sessionStatus !== "authenticated") return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const [products, sellers] = await Promise.all([
          getAdminProducts(token, "pending_review", 0, 1).catch(() => ({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 0 })),
          getAdminSellers(token, undefined, 0, 1, "submitted").catch(() => ({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 0 })),
        ])
        if (!cancelled) setQueueCount(products.totalElements + sellers.totalElements)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [sessionStatus])

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
            : "text-gray-400 hover:bg-white/5 hover:text-white"
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
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-bold text-white text-sm">Admin</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => navLink(item, onClose))}
      </nav>
      <div className="border-t border-white/10 p-4 space-y-2">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Marketplace
        </Link>
        <button
          onClick={() => { window.location.href = "/api/auth/signout" }}
          className="flex w-full items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: "hsl(0 0% 7%)" }}>
      {/* Mobile header */}
      <header
        className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 px-4 lg:hidden"
        style={{ background: "hsl(0 0% 9%)" }}
      >
        <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-bold text-white text-sm flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Admin Panel
        </span>
        <div className="w-5" />
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside
          className="hidden lg:flex lg:w-56 lg:flex-col lg:fixed lg:inset-y-0 border-r border-white/10"
          style={{ background: "hsl(0 0% 9%)" }}
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
              className="absolute inset-y-0 left-0 w-56 border-r border-white/10 shadow-2xl"
              style={{ background: "hsl(0 0% 9%)" }}
            >
              {sidebar(() => setSidebarOpen(false))}
            </aside>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 lg:pl-56 px-4 sm:px-6 py-8">
          <div className="max-w-[1100px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
