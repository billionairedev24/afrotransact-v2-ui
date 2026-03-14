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
  ChevronLeft,
  DollarSign,
  CreditCard,
  ShoppingCart,
  LogOut,
  Star,
  Ticket,
  Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSignOut } from "@/hooks/useSignOut"

const NAV_ITEMS = [
  { href: "/dashboard",              label: "Overview",       icon: LayoutDashboard },
  { href: "/dashboard/products",     label: "Products",       icon: Package         },
  { href: "/dashboard/orders",       label: "Orders",        icon: ShoppingCart    },
  { href: "/dashboard/upload",       label: "Media Library",  icon: Upload         },
  { href: "/dashboard/reviews",      label: "Reviews",        icon: Star            },
  { href: "/dashboard/coupons",      label: "Coupons",        icon: Ticket          },
  { href: "/dashboard/deals",        label: "Deals",          icon: Tag             },
  { href: "/dashboard/payouts",      label: "Payouts",        icon: DollarSign      },
  { href: "/dashboard/subscription", label: "Subscription",   icon: CreditCard      },
  { href: "/dashboard/store",        label: "Store Settings", icon: Settings        },
]

interface SellerShellProps {
  children: React.ReactNode
  userName?: string
  userEmail?: string
}

export function SellerShell({ children, userName, userEmail }: SellerShellProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const signOut = useSignOut()

  const avatarLetter = userName?.charAt(0)?.toUpperCase() ?? "S"

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-1">
          <span className="text-lg font-bold text-primary">Afro</span>
          <span className="text-lg font-bold text-foreground">Transact</span>
          <span className="ml-1 text-xs text-muted-foreground">Seller</span>
        </Link>
        <div className="w-5" />
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 border-r border-border bg-card">
          <div className="flex h-14 items-center gap-2 border-b border-border px-4">
            <Link href="/dashboard" className="flex items-center gap-1">
              <span className="text-lg font-bold text-primary">Afro</span>
              <span className="text-lg font-bold text-foreground">Transact</span>
            </Link>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Seller
            </span>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-border p-4 space-y-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Marketplace
            </Link>
            <button
              onClick={() => { signOut() }}
              className="flex w-full items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
            {(userName || userEmail) && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {avatarLetter}
                </div>
                <div className="min-w-0">
                  {userName && (
                    <p className="truncate text-sm font-medium text-foreground">
                      {userName}
                    </p>
                  )}
                  {userEmail && (
                    <p className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-60 border-r border-border bg-card shadow-xl animate-in slide-in-from-left duration-200">
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <Link href="/dashboard" className="flex items-center gap-1">
                  <span className="text-lg font-bold text-primary">Afro</span>
                  <span className="text-lg font-bold text-foreground">Transact</span>
                </Link>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="px-3 py-4 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/")
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
              <div className="border-t border-border p-4 space-y-2">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Marketplace
                </Link>
                <button
                  onClick={() => { signOut() }}
                  className="flex w-full items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 lg:pl-60">
          <div className="mx-auto max-w-6xl p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
