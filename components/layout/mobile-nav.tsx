"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useState } from "react"
import {
  Home,
  Search,
  ShoppingCart,
  User,
  LogOut,
  Package,
  LayoutDashboard,
  ShieldCheck,
  Settings,
  Store,
  Tag,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/stores/cart-store"
import { useSignOut } from "@/hooks/useSignOut"

function getInitials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0][0]?.toUpperCase() ?? "?"
}

export function MobileNav() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [accountOpen, setAccountOpen] = useState(false)
  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))
  const signOut = useSignOut()

  const isAuthenticated = status === "authenticated"
  const userName = session?.user?.name
  const userEmail = session?.user?.email
  const roles: string[] = (session?.user as { roles?: string[] })?.roles ?? []
  const isAdmin = roles.includes("admin")
  const isSeller = roles.includes("seller")

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <>
      {/* Account sheet overlay */}
      {accountOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setAccountOpen(false)}
          />
          <div className="md:hidden fixed bottom-[56px] left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 max-h-[80vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Close button */}
            <button
              onClick={() => setAccountOpen(false)}
              className="absolute top-3 right-4 flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>

            {isAuthenticated ? (
              <div className="px-4 pb-6 pt-2">
                {/* User info */}
                <div className="flex items-center gap-3 py-3 mb-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-black shrink-0">
                    {getInitials(userName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
                    <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Link
                    href="/account"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User className="h-5 w-5 text-gray-400 shrink-0" />
                    My Account
                  </Link>
                  <Link
                    href="/orders"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Package className="h-5 w-5 text-gray-400 shrink-0" />
                    My Orders
                  </Link>
                  <Link
                    href="/stores"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Store className="h-5 w-5 text-gray-400 shrink-0" />
                    Stores Near Me
                  </Link>
                  <Link
                    href="/deals"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Tag className="h-5 w-5 text-gray-400 shrink-0" />
                    Deals
                  </Link>

                  {(isSeller || isAdmin) && (
                    <Link
                      href="/dashboard"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <LayoutDashboard className="h-5 w-5 text-gray-400 shrink-0" />
                      Seller Dashboard
                    </Link>
                  )}

                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-yellow-700 hover:bg-yellow-50 transition-colors"
                    >
                      <ShieldCheck className="h-5 w-5 shrink-0" />
                      Admin Panel
                    </Link>
                  )}

                  <Link
                    href="/account/settings"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="h-5 w-5 text-gray-400 shrink-0" />
                    Settings
                  </Link>

                  <div className="pt-2 mt-2 border-t border-gray-100">
                    <button
                      onClick={() => { setAccountOpen(false); signOut() }}
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-5 w-5 shrink-0" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 pb-8 pt-2">
                <p className="text-sm text-gray-500 mb-4 text-center">
                  Sign in to access your account, orders, and more.
                </p>
                <Link
                  href="/auth/login"
                  onClick={() => setAccountOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-black shadow-sm transition-all hover:brightness-110 mb-3"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  onClick={() => setAccountOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </>
      )}

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white md:hidden safe-bottom">
        <div className="flex items-center justify-around h-14">
          {/* Home */}
          <Link
            href="/"
            className={cn(
              "flex flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] transition-colors min-w-[52px]",
              isActive("/") ? "text-primary" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </Link>

          {/* Search — opens search overlay in header */}
          <Link
            href="/search"
            className={cn(
              "flex flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] transition-colors min-w-[52px]",
              isActive("/search") ? "text-primary" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </Link>

          {/* Cart */}
          <Link
            href="/cart"
            className={cn(
              "flex flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] transition-colors min-w-[52px] relative",
              isActive("/cart") ? "text-primary" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary text-[9px] font-bold text-black px-0.5">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </div>
            <span>Cart</span>
          </Link>

          {/* Account */}
          <button
            onClick={() => setAccountOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] transition-colors min-w-[52px]",
              isActive("/account") || accountOpen ? "text-primary" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {isAuthenticated ? (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-black">
                {getInitials(userName)}
              </div>
            ) : (
              <User className="h-5 w-5" />
            )}
            <span>{isAuthenticated ? (userName?.split(" ")[0] ?? "Account") : "Sign In"}</span>
          </button>
        </div>
      </nav>
    </>
  )
}
