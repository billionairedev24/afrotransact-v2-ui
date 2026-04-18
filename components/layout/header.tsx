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
  X,
  Loader2,
  Menu,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/stores/cart-store"
import { useCartHydration } from "@/components/providers/CartMergeProvider"
import { useSignOut } from "@/hooks/useSignOut"
import { StartSellingLink } from "@/components/selling/StartSellingLink"
import { searchSuggest, getCategories, type SearchSuggestion, type CategoryRef } from "@/lib/api"

const SLUG_ICON_MAP: Record<string, { icon: typeof Leaf; accent: string }> = {
  produce:     { icon: Leaf,    accent: "#16a34a" },
  spices:      { icon: Flame,   accent: "#ea580c" },
  meats:       { icon: Beef,    accent: "#dc2626" },
  fashion:     { icon: Shirt,   accent: "#9333ea" },
  pantry:      { icon: Package, accent: "#ca8a04" },
  beverages:   { icon: Wine,    accent: "#0891b2" },
  home:        { icon: Home,    accent: "#7c3aed" },
}

function getCategoryIcon(slug: string) {
  const key = Object.keys(SLUG_ICON_MAP).find(k => slug.toLowerCase().includes(k))
  return key ? SLUG_ICON_MAP[key] : { icon: Package, accent: "#6b7280" }
}

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

const isServicesCategory = (slug: string) => slug.toLowerCase().includes("service")

function MobileMenuSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-y border-gray-200/80 bg-gray-50 px-4 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">{children}</p>
    </div>
  )
}

function MobileMenuRow({
  href,
  onClick,
  children,
}: {
  href: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex min-h-[3.25rem] items-center justify-between gap-3 border-b border-gray-100 px-4 active:bg-gray-50/80"
    >
      <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-gray-900">{children}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" strokeWidth={2} aria-hidden />
    </Link>
  )
}

export function Header() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [query, setQuery] = useState("")
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [locationDisplay] = useState("Austin, TX")
  const inputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))
  const { cartReady } = useCartHydration()
  const signOut = useSignOut()

  const isAuthenticated = status === "authenticated"
  const userName = session?.user?.name
  const userEmail = session?.user?.email
  const roles: string[] = (session?.user as { roles?: string[] })?.roles ?? []
  const isAdmin = roles.includes("admin")
  const isSeller = roles.includes("seller")

  const closeMobileMenu = () => setMobileMenuOpen(false)
  const firstName = userName?.trim().split(/\s+/)[0] ?? null

  const [categories, setCategories] = useState<CategoryRef[]>([])

  useEffect(() => {
    getCategories()
      .then(cats => setCategories(cats.filter(c => !c.parentId).slice(0, 8)))
      .catch(() => {})
  }, [])

  const navLinks = [
    ...categories.slice(0, 6).map(cat => {
      const style = getCategoryIcon(cat.slug)
      return { name: cat.name, href: `/category/${cat.slug}`, icon: style.icon, accent: style.accent, disabled: isServicesCategory(cat.slug) }
    }),
    { name: "Deals", href: "/deals", icon: Tag, accent: "#ca8a04", disabled: false },
  ]

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
  }, [])

  // Auto-focus mobile search input when opened
  useEffect(() => {
    if (mobileSearchOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 50)
    }
  }, [mobileSearchOpen])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    if (!mobileMenuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileMenuOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [mobileMenuOpen])

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
      setShowSuggestions(false)
      setMobileSearchOpen(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">

        {/* ── Row 1: Logo · Location · Search · Account · Cart ── */}
        <div className="border-b border-gray-100">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex h-[58px] items-center gap-2 sm:gap-3">

              <button
                type="button"
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-gray-800 hover:bg-gray-100 shrink-0 -ml-1"
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => {
                  setMobileSearchOpen(false)
                  setMobileMenuOpen(true)
                }}
              >
                <Menu className="h-6 w-6" strokeWidth={2} />
              </button>

              {/* Logo */}
              <Link href="/" className="flex items-center gap-1.5 shrink-0 mr-1" aria-label="AfroTransact home">
                <Image src="/logo.png" alt="" width={28} height={28} className="rounded-md" />
                <span className="text-[20px] sm:text-[22px] font-black tracking-tight text-primary leading-none">Afro</span>
                <span className="text-[20px] sm:text-[22px] font-black tracking-tight text-gray-900 leading-none">Transact</span>
              </Link>

              {/* Location — large desktop only */}
              <button
                className="hidden lg:flex flex-col items-start shrink-0 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                aria-label="Change delivery location"
              >
                <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" />
                  Deliver to
                </span>
                <span className="text-[13px] font-semibold text-gray-900 flex items-center gap-0.5 leading-tight">
                  {locationDisplay}
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                </span>
              </button>

              {/* Search — desktop only */}
              <div className="hidden md:flex flex-1 relative" ref={searchRef}>
                <form
                  onSubmit={(e) => { handleSearch(e); setShowSuggestions(false) }}
                  className="flex flex-1 items-stretch h-[40px] rounded-lg overflow-hidden ring-2 ring-transparent focus-within:ring-primary/60 border border-gray-300 transition-all"
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
                    <Search className="h-4 w-4 text-black" strokeWidth={2.5} />
                  </button>
                </form>

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-gray-200 shadow-xl bg-white z-[60] py-1 overflow-hidden max-h-[360px] overflow-y-auto">
                    {suggestions.map((item, idx) => (
                      <button
                        key={`${item.product_id}-${idx}`}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          setShowSuggestions(false)
                          setQuery(item.text)
                          router.push(`/product/${item.product_id}`)
                        }}
                      >
                        {item.image_url ? (
                          <div className="relative h-10 w-10 rounded-md overflow-hidden shrink-0 bg-gray-100">
                            <Image
                              src={item.image_url}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                            <Search className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900 truncate">{item.text}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {item.category && <span>{item.category}</span>}
                            {item.price > 0 && <span className="ml-2 text-primary font-medium">${item.price.toFixed(2)}</span>}
                          </p>
                        </div>
                      </button>
                    ))}
                    <button
                      className="w-full px-4 py-2 text-xs text-primary font-medium text-center hover:bg-gray-50 transition-colors border-t border-gray-100"
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

              <div className="flex-1 md:hidden min-w-0" />

              {/* Mobile search icon */}
              <button
                className="md:hidden flex items-center justify-center w-9 h-9 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0"
                onClick={() => {
                  setMobileMenuOpen(false)
                  setMobileSearchOpen(true)
                }}
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>

              {/* ── Auth area — desktop only ── */}
              {isAuthenticated ? (
                <div className="relative hidden md:block" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen((p) => !p)}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
                    aria-label="User menu"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-black">
                      {getInitials(userName)}
                    </div>
                    <ChevronDown className="h-3 w-3 text-gray-400" />
                  </button>

                  {/* Desktop dropdown */}
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-200 shadow-xl bg-white z-[60] py-2 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900 truncate">{userName ?? "User"}</p>
                        <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                      </div>

                      <div className="py-1">
                        <Link href="/account" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                          <User className="h-4 w-4 text-gray-400" />
                          My Account
                        </Link>
                        <Link href="/orders" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                          <Package className="h-4 w-4 text-gray-400" />
                          Orders
                        </Link>
                        {(isSeller || isAdmin) && (
                          <Link href="/dashboard" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                            <LayoutDashboard className="h-4 w-4 text-gray-400" />
                            Seller Dashboard
                          </Link>
                        )}
                        {isAdmin && (
                          <Link href="/admin" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-yellow-700 hover:text-yellow-800 hover:bg-yellow-50 transition-colors">
                            <ShieldCheck className="h-4 w-4" />
                            Admin Panel
                          </Link>
                        )}
                        <Link href="/account/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                          <Settings className="h-4 w-4 text-gray-400" />
                          Settings
                        </Link>
                      </div>

                      <div className="border-t border-gray-100 py-1">
                        <button
                          onClick={() => { setUserMenuOpen(false); signOut() }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
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
                  <span className="text-[10px] text-gray-500">{getGreeting()}</span>
                  <span className="text-[13px] leading-tight">
                    <Link href="/auth/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                      Sign in
                    </Link>
                    <span className="text-gray-400 mx-1">or</span>
                    <Link href="/auth/register" className="font-semibold text-gray-900 hover:text-primary transition-colors">
                      Register
                    </Link>
                  </span>
                </div>
              )}

              {/* Cart */}
              <Link
                href="/cart"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-50 transition-colors shrink-0"
              >
                <div className="relative">
                  <ShoppingCart className="h-6 w-6 text-gray-700" strokeWidth={1.75} />
                  {!cartReady ? (
                    <span className="absolute -top-1.5 -right-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-gray-200">
                      <Loader2 className="h-3 w-3 animate-spin text-gray-600" aria-hidden />
                      <span className="sr-only">Loading cart</span>
                    </span>
                  ) : cartCount > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-black px-0.5">
                      {cartCount}
                    </span>
                  ) : null}
                </div>
                <span className="hidden sm:block text-[13px] font-semibold text-gray-700">Cart</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Row 2: Slim category strip — desktop only ── */}
        <nav className="hidden md:block bg-gray-50 border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-[34px] gap-0">
              {navLinks.map((link, i) => {
                const Icon = link.icon
                const hideClass =
                  i >= 5 ? "hidden xl:flex" :
                  i >= 4 ? "hidden lg:flex" :
                  "flex"
                if (link.disabled) {
                  return (
                    <span
                      key={link.name}
                      title="Coming Soon"
                      className={`group items-center gap-1.5 px-3 h-full text-[13px] text-gray-400 whitespace-nowrap cursor-default select-none ${hideClass}`}
                    >
                      <Icon className="h-3.5 w-3.5 opacity-40 shrink-0" style={{ color: link.accent }} />
                      {link.name}
                      <span className="ml-1 text-[9px] font-semibold bg-gray-200 text-gray-500 rounded px-1 py-0.5 leading-none">Soon</span>
                    </span>
                  )
                }
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`group items-center gap-1.5 px-3 h-full text-[13px] text-gray-600 whitespace-nowrap hover:text-gray-900 hover:bg-gray-100 transition-colors ${hideClass}`}
                  >
                    <Icon className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 shrink-0" style={{ color: link.accent }} />
                    {link.name}
                  </Link>
                )
              })}

              <span className="w-px h-4 bg-gray-300 mx-1 shrink-0" />

              <Link
                href="/stores"
                className="flex items-center gap-1.5 px-3 h-full text-[13px] text-yellow-700 font-medium whitespace-nowrap hover:text-yellow-800 hover:bg-yellow-50 transition-colors"
              >
                <Store className="h-3.5 w-3.5" />
                Stores Near Me
              </Link>

              <div className="flex-1" />

              <StartSellingLink variant="header" />
            </div>
          </div>
        </nav>
      </header>

      {/* ── Mobile slide-out menu (Amazon-inspired sheet; omits Search/Cart/Home — already in navbar) ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[45] flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity"
            aria-label="Close menu"
            onClick={closeMobileMenu}
          />
          <nav
            className="relative flex h-full w-[min(22rem,calc(100vw-14px))] max-w-[90vw] flex-col overflow-hidden rounded-r-2xl bg-white shadow-2xl animate-in slide-in-from-left duration-200 ease-out"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
            aria-label="Main menu"
          >
            {/* Greeting strip — not a copy of Amazon; same UX pattern */}
            <div className="shrink-0 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 px-4 pb-5 pt-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/10">
                    <User className="h-5 w-5 text-white/90" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-xs font-medium text-white/60">Hello</p>
                    {isAuthenticated && firstName ? (
                      <>
                        <p className="truncate text-lg font-semibold leading-tight text-white">{firstName}</p>
                        {userEmail ? (
                          <p className="mt-0.5 truncate text-xs text-white/55">{userEmail}</p>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold leading-tight text-white">there</p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/85">
                          <Link
                            href="/auth/login"
                            onClick={closeMobileMenu}
                            className="font-semibold text-primary underline decoration-primary/50 underline-offset-2 transition-colors hover:text-primary/90"
                          >
                            Sign in
                          </Link>
                          <span className="text-white/35">·</span>
                          <Link
                            href="/auth/register"
                            onClick={closeMobileMenu}
                            className="font-medium text-white/80 transition-colors hover:text-white"
                          >
                            Create account
                          </Link>
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
                  aria-label="Close menu"
                  onClick={closeMobileMenu}
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
              {isAuthenticated ? (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-white/50">
                  <MapPin className="h-3 w-3 shrink-0 text-primary/90" />
                  <span>Delivering to {locationDisplay}</span>
                </p>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
              <MobileMenuSectionTitle>Shop</MobileMenuSectionTitle>
              <MobileMenuRow href="/categories" onClick={closeMobileMenu}>
                All categories
              </MobileMenuRow>
              {navLinks.map((link) => {
                if (link.disabled) {
                  return (
                    <div
                      key={link.name}
                      className="flex min-h-[3.25rem] items-center justify-between gap-3 border-b border-gray-100 px-4 text-[15px] text-gray-400"
                    >
                      <span className="min-w-0 flex-1 truncate">{link.name}</span>
                      <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        Soon
                      </span>
                    </div>
                  )
                }
                return (
                  <MobileMenuRow key={link.name} href={link.href} onClick={closeMobileMenu}>
                    {link.name}
                  </MobileMenuRow>
                )
              })}
              <MobileMenuRow href="/stores" onClick={closeMobileMenu}>
                Stores near you
              </MobileMenuRow>
              <MobileMenuRow href="/search" onClick={closeMobileMenu}>
                Shop all products
              </MobileMenuRow>

              <MobileMenuSectionTitle>For sellers</MobileMenuSectionTitle>
              <StartSellingLink
                variant="bare"
                className={cn(
                  "flex min-h-[3.25rem] w-full items-center justify-between gap-3 border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/90 to-white px-4 text-[15px] font-semibold text-emerald-900 active:bg-emerald-50",
                )}
                onNavigate={closeMobileMenu}
              >
                <span className="min-w-0 flex-1 text-left">Start selling</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-600/70" aria-hidden />
              </StartSellingLink>

              {isAuthenticated ? (
                <>
                  <MobileMenuSectionTitle>Your account</MobileMenuSectionTitle>
                  <MobileMenuRow href="/account" onClick={closeMobileMenu}>
                    Account and profile
                  </MobileMenuRow>
                  <MobileMenuRow href="/orders" onClick={closeMobileMenu}>
                    Your orders
                  </MobileMenuRow>
                  {(isSeller || isAdmin) && (
                    <MobileMenuRow href="/dashboard" onClick={closeMobileMenu}>
                      Seller dashboard
                    </MobileMenuRow>
                  )}
                  {isAdmin && (
                    <MobileMenuRow href="/admin" onClick={closeMobileMenu}>
                      Admin
                    </MobileMenuRow>
                  )}
                  <MobileMenuRow href="/account/settings" onClick={closeMobileMenu}>
                    Settings
                  </MobileMenuRow>
                  <button
                    type="button"
                    onClick={() => {
                      closeMobileMenu()
                      signOut()
                    }}
                    className="flex min-h-[3.25rem] w-full items-center border-b border-gray-100 px-4 text-left text-[15px] font-medium text-red-600 active:bg-red-50/60"
                  >
                    Sign out
                  </button>
                </>
              ) : null}
            </div>
          </nav>
        </div>
      )}

      {/* ── Mobile Full-Screen Search Overlay ── */}
      {mobileSearchOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col">
          {/* Search bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white">
            <form onSubmit={handleSearch} className="flex flex-1 items-stretch h-11 rounded-xl overflow-hidden border border-gray-300 focus-within:border-primary transition-colors">
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search products, stores, spices…"
                className="flex-1 px-4 text-sm text-gray-900 placeholder:text-gray-400 bg-white outline-none"
                autoComplete="off"
              />
              <button type="submit" className="flex items-center justify-center w-11 bg-primary shrink-0" aria-label="Search">
                <Search className="h-4 w-4 text-black" />
              </button>
            </form>
            <button
              onClick={() => { setMobileSearchOpen(false); setQuery(""); setSuggestions([]); setShowSuggestions(false) }}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Suggestions */}
          <div className="flex-1 overflow-y-auto">
            {showSuggestions && suggestions.length > 0 ? (
              <div className="py-2">
                {suggestions.map((item, idx) => (
                  <button
                    key={`${item.product_id}-${idx}`}
                    className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50"
                    onClick={() => {
                      setShowSuggestions(false)
                      setMobileSearchOpen(false)
                      setQuery(item.text)
                      router.push(`/product/${item.product_id}`)
                    }}
                  >
                    {item.image_url ? (
                      <div className="relative h-12 w-12 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                        <Image
                          src={item.image_url}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Search className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.text}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {item.category && <span>{item.category}</span>}
                        {item.price > 0 && <span className="ml-2 text-primary font-semibold">${item.price.toFixed(2)}</span>}
                      </p>
                    </div>
                  </button>
                ))}
                <button
                  className="w-full px-4 py-3 text-sm text-primary font-medium text-center hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setShowSuggestions(false)
                    setMobileSearchOpen(false)
                    router.push(`/search?q=${encodeURIComponent(query)}`)
                  }}
                >
                  See all results for &ldquo;{query}&rdquo;
                </button>
              </div>
            ) : query.length > 1 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Search className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
              </div>
            ) : (
              <div className="px-4 py-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Categories</p>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map(cat => {
                    const style = getCategoryIcon(cat.slug)
                    const Icon = style.icon
                    if (isServicesCategory(cat.slug)) return null
                    return (
                      <Link
                        key={cat.slug}
                        href={`/category/${cat.slug}`}
                        onClick={() => setMobileSearchOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <Icon className="h-4 w-4 shrink-0" style={{ color: style.accent }} />
                        {cat.name}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
