"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  ShoppingCart,
  MapPin,
  Search,
  ChevronDown,
  Menu,
  X,
  Leaf,
  Flame,
  Beef,
  Store,
  Tag,
  User,
  Shirt,
  Package,
  Wine,
  Home,
  LogOut,
  Settings,
  LayoutDashboard,
  ShieldCheck,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/stores/cart-store"
import { searchSuggest, type SearchSuggestion } from "@/lib/api"

const navLinks = [
  { name: "Fresh Produce",  href: "/category/produce",    icon: Leaf,    accent: "#4ade80" },
  { name: "Spices & Herbs", href: "/category/spices",     icon: Flame,   accent: "#fb923c" },
  { name: "Meats & Seafood",href: "/category/meats",      icon: Beef,    accent: "#f87171" },
  { name: "Fashion",        href: "/category/fashion",    icon: Shirt,   accent: "#c084fc" },
  { name: "Pantry & Dry",   href: "/category/pantry",     icon: Package, accent: "#fbbf24" },
  { name: "Beverages",      href: "/category/beverages",  icon: Wine,    accent: "#67e8f9" },
  { name: "Deals",          href: "/deals",               icon: Tag,     accent: "#facc15" },
]

const drawerCategories = [
  ...navLinks,
  { name: "Home & Living", href: "/category/home", icon: Home, accent: "#a78bfa" },
]

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning!"
  if (hour < 17) return "Good afternoon!"
  return "Good evening!"
}

function getInitials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0][0]?.toUpperCase() ?? "?"
}

export function Header() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [query, setQuery] = useState("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [locationDisplay] = useState("Austin, TX")
  const inputRef = useRef<HTMLInputElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  const isAuthenticated = status === "authenticated"
  const userName = session?.user?.name
  const userEmail = session?.user?.email
  const roles: string[] = (session?.user as { roles?: string[] })?.roles ?? []
  const isAdmin = roles.includes("admin")
  const isSeller = roles.includes("seller")

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [mobileMenuOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [userMenuOpen])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchSuggest(value.trim())
        setSuggestions(res.suggestions)
        setShowSuggestions(res.suggestions.length > 0)
      } catch {
        setSuggestions([])
      }
    }, 200)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      setMobileMenuOpen(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50" style={{ background: "hsl(0 0% 8%)" }}>

        {/* ── Row 1: Logo · Location · Search · Account · Cart ── */}
        <div style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}>
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex h-[58px] items-center gap-2 sm:gap-3">

              {/* Logo */}
              <Link href="/" className="flex items-center gap-1.5 shrink-0 mr-1" aria-label="AfroTransact home">
                <Image src="/logo.png" alt="" width={28} height={28} className="rounded-md" />
                <span className="text-[20px] sm:text-[22px] font-black tracking-tight text-primary leading-none">Afro</span>
                <span className="text-[20px] sm:text-[22px] font-black tracking-tight text-white leading-none">Transact</span>
              </Link>

              {/* Location — large desktop only */}
              <button
                className="hidden lg:flex flex-col items-start shrink-0 px-2 py-1 rounded hover:bg-white/5 transition-colors"
                aria-label="Change delivery location"
              >
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" />
                  Deliver to
                </span>
                <span className="text-[13px] font-semibold text-white flex items-center gap-0.5 leading-tight">
                  {locationDisplay}
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                </span>
              </button>

              {/* Search — desktop only */}
              <div className="hidden md:flex flex-1 relative" ref={searchRef}>
                <form
                  onSubmit={(e) => { handleSearch(e); setShowSuggestions(false) }}
                  className="flex flex-1 items-stretch h-[40px] rounded-lg overflow-hidden ring-2 ring-transparent focus-within:ring-primary/60 transition-all"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Search products, stores, spices…"
                    className="flex-1 min-w-0 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className="flex items-center justify-center w-11 bg-primary hover:bg-primary/90 transition-colors shrink-0"
                    aria-label="Search"
                  >
                    <Search className="h-4 w-4 text-[#0f0f10]" strokeWidth={2.5} />
                  </button>
                </form>

                {showSuggestions && suggestions.length > 0 && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-white/10 shadow-2xl shadow-black/40 z-[60] py-1 overflow-hidden max-h-[360px] overflow-y-auto"
                    style={{ background: "hsl(0 0% 11%)" }}
                  >
                    {suggestions.map((item, idx) => (
                      <button
                        key={`${item.product_id}-${idx}`}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                        onClick={() => {
                          setShowSuggestions(false)
                          setQuery(item.text)
                          router.push(`/product/${item.product_id}`)
                        }}
                      >
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="h-10 w-10 rounded-md object-cover shrink-0 bg-white/5" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                            <Search className="h-4 w-4 text-gray-600" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white truncate">{item.text}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {item.category && <span>{item.category}</span>}
                            {item.price > 0 && <span className="ml-2 text-primary font-medium">${item.price.toFixed(2)}</span>}
                          </p>
                        </div>
                      </button>
                    ))}
                    <button
                      className="w-full px-4 py-2 text-xs text-primary font-medium text-center hover:bg-white/5 transition-colors border-t border-white/10"
                      onClick={() => {
                        setShowSuggestions(false)
                        router.push(`/search?q=${encodeURIComponent(query)}`)
                      }}
                    >
                      See all results for &ldquo;{query}&rdquo;
                    </button>
                  </div>
                )}
              </div>

              {/* Spacer — mobile only */}
              <div className="flex-1 md:hidden" />

              {/* ── Auth area ── */}
              {isAuthenticated ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen((p) => !p)}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                    aria-label="User menu"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-[#0f0f10]">
                      {getInitials(userName)}
                    </div>
                    <ChevronDown className="h-3 w-3 text-gray-400 hidden sm:block" />
                  </button>

                  {/* Dropdown */}
                  {userMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-white/10 shadow-2xl shadow-black/40 z-[60] py-2 overflow-hidden"
                      style={{ background: "hsl(0 0% 11%)" }}
                    >
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-white/10">
                        <p className="text-sm font-semibold text-white truncate">{userName ?? "User"}</p>
                        <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                      </div>

                      <div className="py-1">
                        <Link
                          href="/account"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <User className="h-4 w-4 text-gray-500" />
                          My Account
                        </Link>
                        <Link
                          href="/orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <Package className="h-4 w-4 text-gray-500" />
                          Orders
                        </Link>

                        {(isSeller || isAdmin) && (
                          <Link
                            href="/dashboard"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <LayoutDashboard className="h-4 w-4 text-gray-500" />
                            Seller Dashboard
                          </Link>
                        )}

                        {isAdmin && (
                          <Link
                            href="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-amber-300 hover:text-amber-200 hover:bg-white/5 transition-colors"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            Admin Panel
                          </Link>
                        )}

                        <Link
                          href="/account/settings"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <Settings className="h-4 w-4 text-gray-500" />
                          Settings
                        </Link>
                      </div>

                      <div className="border-t border-white/10 py-1">
                        <button
                          onClick={() => { setUserMenuOpen(false); window.location.href = "/api/auth/signout" }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden md:flex flex-col items-start px-2 py-1 shrink-0">
                  <span className="text-[10px] text-gray-400">{getGreeting()}</span>
                  <span className="text-[13px] leading-tight">
                    <Link href="/auth/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                      Sign in
                    </Link>
                    <span className="text-gray-500 mx-1">or</span>
                    <Link href="/auth/register" className="font-semibold text-white hover:text-primary transition-colors">
                      Register
                    </Link>
                  </span>
                </div>
              )}

              {/* Cart */}
              <Link
                href="/cart"
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors shrink-0"
              >
                <div className="relative">
                  <ShoppingCart className="h-6 w-6 text-white" strokeWidth={1.75} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-[#0f0f10] px-0.5">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span className="hidden sm:block text-[13px] font-semibold text-white">Cart</span>
              </Link>

              {/* Hamburger — mobile only */}
              <button
                className="md:hidden flex items-center justify-center w-9 h-9 rounded text-gray-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Row 2: Slim category strip — desktop only ── */}
        <nav
          className="hidden md:block"
          style={{ background: "hsl(0 0% 11%)", borderBottom: "1px solid hsl(0 0% 16%)" }}
        >
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-[34px] gap-0">
              {navLinks.map((link, i) => {
                const Icon = link.icon
                const hideClass =
                  i >= 5 ? "hidden xl:flex" :
                  i >= 4 ? "hidden lg:flex" :
                  "flex"
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`group items-center gap-1.5 px-3 h-full text-[13px] text-gray-300 whitespace-nowrap hover:text-white hover:bg-white/10 transition-colors ${hideClass}`}
                  >
                    <Icon className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 shrink-0" style={{ color: link.accent }} />
                    {link.name}
                  </Link>
                )
              })}

              <span className="w-px h-4 bg-white/20 mx-1 shrink-0" />

              <Link
                href="/stores"
                className="flex items-center gap-1.5 px-3 h-full text-[13px] text-amber-300 font-medium whitespace-nowrap hover:text-amber-200 hover:bg-white/10 transition-colors"
              >
                <Store className="h-3.5 w-3.5" />
                Stores Near Me
              </Link>

              <div className="flex-1" />

              <Link
                href="/sell"
                className="flex items-center gap-1 px-3 h-full text-[13px] text-emerald-400 font-medium whitespace-nowrap hover:text-emerald-300 hover:bg-white/10 transition-colors"
              >
                Start Selling
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div
        className={cn(
          "md:hidden fixed left-0 right-0 top-[58px] z-50 border-b border-white/10 transition-transform duration-300 ease-in-out",
          mobileMenuOpen ? "translate-y-0" : "-translate-y-[110%]"
        )}
        style={{ background: "hsl(0 0% 9%)" }}
      >
        <div className="px-3 py-3 space-y-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex h-11 rounded-xl overflow-hidden border border-white/15">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, stores…"
              className="flex-1 px-4 text-sm text-white placeholder:text-gray-500 outline-none"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
            <button type="submit" className="flex items-center justify-center w-11 bg-primary shrink-0" aria-label="Search">
              <Search className="h-4 w-4 text-[#0f0f10]" />
            </button>
          </form>

          {/* Location */}
          <div className="flex items-center gap-2 text-sm text-gray-400 rounded-lg px-3 py-2 border border-white/10">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Delivering to <span className="font-semibold text-white">{locationDisplay}</span></span>
            <button className="ml-auto text-primary text-xs font-medium">Change</button>
          </div>

          {/* Categories grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {drawerCategories.map((cat) => {
              const Icon = cat.icon
              return (
                <Link
                  key={cat.name}
                  href={cat.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] text-gray-300 hover:text-white transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: cat.accent }} />
                  {cat.name}
                </Link>
              )
            })}
          </div>

          {/* Auth area at bottom */}
          <div className="pt-1 border-t border-white/10">
            {isAuthenticated ? (
              <div className="space-y-1">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-[#0f0f10]">
                    {getInitials(userName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{userName}</p>
                    <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                  </div>
                </div>
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] text-gray-300 hover:text-white transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <User className="h-4 w-4 text-gray-400" />
                  My Account
                </Link>
                <Link
                  href="/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] text-gray-300 hover:text-white transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <Package className="h-4 w-4 text-gray-400" />
                  Orders
                </Link>
                {(isSeller || isAdmin) && (
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] text-gray-300 hover:text-white transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    <LayoutDashboard className="h-4 w-4 text-gray-400" />
                    Seller Dashboard
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] text-amber-300 hover:text-amber-200 transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Admin Panel
                  </Link>
                )}
                <button
                  onClick={() => { setMobileMenuOpen(false); window.location.href = "/api/auth/signout" }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] text-red-400 hover:text-red-300 transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-[13px]"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <User className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <span className="text-[10px] text-gray-400 block">{getGreeting()}</span>
                  <span className="leading-tight">
                    <Link
                      href="/auth/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      Sign in
                    </Link>
                    <span className="text-gray-500 mx-1">or</span>
                    <Link
                      href="/auth/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="font-semibold text-white hover:text-primary transition-colors"
                    >
                      Register
                    </Link>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
