"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  Upload,
  Settings,
  Menu,
  X,
  DollarSign,
  CreditCard,
  ShoppingCart,
  LogOut,
  HelpCircle,
  Star,
  Ticket,
  Tag,
  BarChart2,
  ShieldAlert,
  RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSignOut } from "@/hooks/useSignOut"
import { StoreSwitcher } from "@/components/seller/StoreSwitcher"
import { StripeActionBanner } from "@/components/seller/StripeActionBanner"
import type { SellerInfo } from "@/lib/api"
import { useSellerAnalyticsNavVisible } from "@/hooks/use-analytics-settings"

// `exact: true` on Overview prevents it from matching every /dashboard/...
// sub-route (which is why "Overview" used to look permanently selected even
// when the seller was viewing Products, Orders, etc).
const NAV_ITEMS = [
  { href: "/dashboard",              label: "Overview",       icon: LayoutDashboard, exact: true },
  { href: "/dashboard/analytics",   label: "Analytics",      icon: BarChart2       },
  { href: "/dashboard/products",     label: "Products",       icon: Package         },
  { href: "/dashboard/orders",       label: "Orders",        icon: ShoppingCart    },
  { href: "/dashboard/returns",      label: "Returns",        icon: RotateCcw       },
  { href: "/dashboard/upload",       label: "Media Library",  icon: Upload         },
  { href: "/dashboard/reviews",      label: "Reviews",        icon: Star            },
  { href: "/dashboard/coupons",      label: "Coupons",        icon: Ticket          },
  { href: "/dashboard/deals",        label: "Deals",          icon: Tag             },
  { href: "/dashboard/payouts",      label: "Payouts",        icon: DollarSign      },
  { href: "/dashboard/subscription", label: "Subscription",   icon: CreditCard      },
  { href: "/dashboard/account-status", label: "Account Status", icon: ShieldAlert    },
  { href: "/dashboard/store",        label: "Store Settings", icon: Settings        },
]

interface SellerShellProps {
  children: React.ReactNode
  userName?: string
  userEmail?: string
  seller?: SellerInfo
}

export function SellerShell({ children, userName, userEmail, seller }: SellerShellProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const signOut = useSignOut()
  const showSellerAnalytics = useSellerAnalyticsNavVisible()
  const navItems = NAV_ITEMS.filter(
    (item) => showSellerAnalytics || item.href !== "/dashboard/analytics",
  )

  const avatarLetter = userName?.charAt(0)?.toUpperCase() ?? "S"

  const sellerAtRisk = !!seller && (
    (seller.lifecycleStage && seller.lifecycleStage !== "ACTIVE") ||
    (!seller.lifecycleStage && (seller.stripeRequirementsDue || !seller.chargesEnabled || !seller.payoutsEnabled))
  )

  return (
    <div className="min-h-screen min-w-0 bg-gray-50">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-input bg-white px-4 lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-1">
          <span className="text-lg font-bold text-foreground">Afro</span>
          <span className="text-lg font-bold text-foreground">Transact</span>
          <span className="ml-1 text-xs text-muted-foreground">Seller</span>
        </Link>
        <div className="w-5" />
      </header>

      <div className="flex min-w-0">
        {/* Desktop sidebar — mockup create-product-and-side-bar.html lines
            169-229: DARK surface, gold brand wordmark + uppercase pill,
            inactive items in light-gray text, active item = solid gold pill,
            footer = avatar + name/"Verified Merchant" subtitle, then a 2-col
            Help / Logout row. */}
        <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-brand-dark p-4 z-50">
          <div className="flex items-center gap-2 mb-6 px-2">
            <Link href="/dashboard" className="flex items-center">
              <span className="text-xl font-bold text-brand-gold">AfroTransact</span>
            </Link>
            <span className="rounded-sm bg-brand-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-gold-foreground">
              Seller
            </span>
          </div>

          <nav className="flex-1 flex flex-col gap-1 overflow-y-auto scrollbar-hide">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors",
                    active
                      ? "bg-brand-gold text-brand-gold-foreground font-bold"
                      : "text-white/70 hover:bg-white/5 hover:text-brand-gold",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                  {item.href === "/dashboard/account-status" && sellerAtRisk && (
                    <span className="ml-auto inline-flex h-2 w-2 rounded-full bg-rose-500" aria-label="Action required" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer — profile + Help/Logout */}
          <div className="mt-auto pt-6 border-t border-white/10 flex flex-col gap-2">
            {(userName || userEmail) && (
              <div className="flex items-center gap-3 px-2 mb-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white border-2 border-brand-gold">
                  {avatarLetter}
                </div>
                <div className="min-w-0">
                  {userName && (
                    <p className="truncate text-sm font-semibold text-white">{userName}</p>
                  )}
                  <p className="text-[11px] text-white/60">Verified Merchant</p>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Link
                href="/dashboard/help"
                className="flex-1 flex flex-col items-center justify-center py-2 text-white/60 hover:text-brand-gold transition-colors"
              >
                <HelpCircle className="h-5 w-5 mb-1" />
                <span className="text-[10px]">Help Center</span>
              </Link>
              <button
                type="button"
                onClick={() => { signOut() }}
                className="flex-1 flex flex-col items-center justify-center py-2 text-white/60 hover:text-red-400 transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5 mb-1" />
                <span className="text-[10px]">Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-72 bg-brand-dark shadow-xl animate-in slide-in-from-left duration-200 flex flex-col p-4">
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-2">
                  <Link href="/dashboard" className="flex items-center" onClick={() => setSidebarOpen(false)}>
                    <span className="text-xl font-bold text-brand-gold">AfroTransact</span>
                  </Link>
                  <span className="rounded-sm bg-brand-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-gold-foreground">
                    Seller
                  </span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-white/60 hover:text-white transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 flex flex-col gap-1 overflow-y-auto scrollbar-hide">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const active = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + "/")
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors",
                        active
                          ? "bg-brand-gold text-brand-gold-foreground font-bold"
                          : "text-white/70 hover:bg-white/5 hover:text-brand-gold",
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
              <div className="mt-auto pt-6 border-t border-white/10 flex flex-col gap-2">
                {(userName || userEmail) && (
                  <div className="flex items-center gap-3 px-2 mb-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white border-2 border-brand-gold">
                      {avatarLetter}
                    </div>
                    <div className="min-w-0">
                      {userName && (
                        <p className="truncate text-sm font-semibold text-white">{userName}</p>
                      )}
                      <p className="text-[11px] text-white/60">Verified Merchant</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Link
                    href="/dashboard/help"
                    onClick={() => setSidebarOpen(false)}
                    className="flex-1 flex flex-col items-center justify-center py-2 text-white/60 hover:text-brand-gold transition-colors"
                  >
                    <HelpCircle className="h-5 w-5 mb-1" />
                    <span className="text-[10px]">Help Center</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => { signOut() }}
                    className="flex-1 flex flex-col items-center justify-center py-2 text-white/60 hover:text-red-400 transition-colors"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-5 w-5 mb-1" />
                    <span className="text-[10px]">Logout</span>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1 lg:pl-72">
          {/* Slim top bar for desktop with store switcher. Mobile keeps the
              sticky header above, and we mirror the switcher there too. */}
          <div className="hidden lg:flex sticky top-0 z-30 bg-white border-b border-gray-200 px-6 lg:px-8 h-14 items-center">
            <StoreSwitcher />
          </div>
          <div className="lg:hidden border-b border-gray-200 bg-white px-4 py-2">
            <StoreSwitcher />
          </div>
          <div className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {seller && <StripeActionBanner seller={seller} />}
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
