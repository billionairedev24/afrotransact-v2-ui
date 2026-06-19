"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, usePathname } from "next/navigation"
import { useSession, signIn } from "next-auth/react"
import {
  ShoppingCart,
  Search,
  ChevronDown,
  CircleUser,
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
  Heart,
  LayoutGrid,
  Eye,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/stores/cart-store"
import { useCartHydration } from "@/components/providers/CartMergeProvider"
import { useSignOut } from "@/hooks/useSignOut"
import { StartSellingLink } from "@/components/selling/StartSellingLink"
import { AiNavButton } from "@/components/ai/AiWidget"
import { searchSuggest, getCategories, type SearchSuggestion, type CategoryRef } from "@/lib/api"

const SLUG_ICON_MAP: Record<string, { icon: typeof Leaf; accent: string }> = {
  produce:     { icon: Leaf,    accent: "#16a34a" },
  spices:      { icon: Flame,   accent: "#ea580c" },
  meats:       { icon: Beef,    accent: "#dc2626" },
  fashion:     { icon: Shirt,   accent: "#9333ea" },
  pantry:      { icon: Package, accent: "#F5C518" },
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

// Self-service seller signup is open. Buyer-side surfaces show the
// "Sell on AfroTransact" CTA to guests + buyers (StartSellingLink handles
// the per-role hiding for admins + existing sellers).

function MobileMenuSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
      {children}
    </p>
  )
}

function MobileMenuRow({
  href,
  onClick,
  icon: Icon,
  active,
  badge,
  children,
}: {
  href: string
  onClick: () => void
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  active?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "mx-3 flex items-center gap-4 rounded-lg px-3 py-3 transition-colors",
        active
          ? "bg-brand-gold text-brand-gold-foreground"
          : "text-gray-900 hover:bg-gray-100 active:bg-gray-100",
      )}
    >
      <Icon
        className={cn("h-5 w-5 shrink-0", active ? "text-brand-gold-foreground" : "text-gray-700")}
        strokeWidth={1.75}
      />
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium leading-snug">{children}</span>
      {badge ? <span className="shrink-0">{badge}</span> : null}
    </Link>
  )
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [query, setQuery] = useState("")
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // "All" category dropdown next to the search input — mockup lines 135-138.
  // Empty slug means "All categories". Persists across submits via local state.
  const [searchCategorySlug, setSearchCategorySlug] = useState<string>("")
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [authPending, setAuthPending] = useState<null | "signin" | "register">(null)

  function beginSignIn(kind: "signin" | "register") {
    if (authPending) return
    setAuthPending(kind)
    const callbackUrl =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/"
    // Defer the redirect so React commits the pending state and paints the
    // spinner before signIn() navigates the page away. Two rAFs guarantee a
    // paint in every browser; without this the user sees a blank dead time.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void signIn(kind === "signin" ? "keycloak" : "keycloak-register", { callbackUrl })
      })
    })
  }
  const categoryDropdownRef = useRef<HTMLDivElement>(null)

  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))
  const { cartReady } = useCartHydration()
  const signOut = useSignOut()

  const isAuthenticated = status === "authenticated"
  const userName = session?.user?.name
  const userEmail = session?.user?.email
  const roles: string[] = (session?.user as { roles?: string[] })?.roles ?? []
  const isAdmin = roles.includes("admin")
  const isSeller = roles.includes("seller")
  // Developers carry admin + seller + buyer via the composite role, so the
  // existing isAdmin / isSeller checks already grant access. We surface the
  // discriminator with a badge so it's obvious who has elevated debug access.
  const isDeveloper = roles.includes("developer")

  const closeMobileMenu = () => setMobileMenuOpen(false)
  const firstName = userName?.trim().split(/\s+/)[0] ?? null

  const [categories, setCategories] = useState<CategoryRef[]>([])

  useEffect(() => {
    getCategories()
      .then(cats => setCategories(cats.filter(c => !c.parentId).slice(0, 8)))
      .catch(() => {})
  }, [])

  const navLinks = [
    // Services category is intentionally filtered out — AfroTransact is
    // product-only during closed beta. (Server also enforces this via
    // V13__remove_services_category.sql.)
    ...categories
      .filter(cat => !isServicesCategory(cat.slug))
      .slice(0, 6)
      .map(cat => {
        const style = getCategoryIcon(cat.slug)
        return { name: cat.name, href: `/category/${cat.slug}`, icon: style.icon, accent: style.accent, disabled: false }
      }),
    { name: "Deals", href: "/deals", icon: Tag, accent: "#F5C518", disabled: false },
  ]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false)
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

  function navigateToSearch(opts: { query: string; categorySlug: string }) {
    const q = opts.query.trim()
    if (!q && !opts.categorySlug) return
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (opts.categorySlug) params.set("category", opts.categorySlug)
    router.push(`/search?${params.toString()}`)
    setShowSuggestions(false)
    setMobileSearchOpen(false)
    setCategoryDropdownOpen(false)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    navigateToSearch({ query, categorySlug: searchCategorySlug })
  }

  // Picking a category from the dropdown should immediately scope the
  // results, matching Amazon's behavior. If there's no query text we still
  // navigate (sends the user to a category-only listing).
  function handleCategoryPick(slug: string) {
    setSearchCategorySlug(slug)
    navigateToSearch({ query, categorySlug: slug })
  }

  const selectedCategoryLabel =
    categories.find((c) => c.slug === searchCategorySlug)?.name ?? "All"

  return (
    <>
      <header className="sticky top-0 z-40 bg-brand-dark shadow-md">

        {/* Single bar matching public/ux-designs/code.html lines 127-164. We
            intentionally do NOT render a second category strip — the mockup
            uses one row only. Category navigation happens via the bento grid
            on the landing page and the mobile menu. */}
        <div>
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex h-[64px] items-center gap-3 sm:gap-4">

              <button
                type="button"
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-white hover:bg-white/10 shrink-0 -ml-1"
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
                <span className="text-[20px] sm:text-[22px] font-black tracking-tight text-brand-gold leading-none">AfroTransact</span>
              </Link>

              {/* "Ask Victory" pill — placed right after the logo per the
                  Amazon Rufus pattern. Hidden on small screens to keep room
                  for the search bar, and hidden entirely when
                  NEXT_PUBLIC_AI_ENABLED !== "true" (beta default). */}
              <div className="hidden lg:flex shrink-0">
                <AiNavButton />
              </div>

              {/* Search — desktop only */}
              <div className="hidden md:flex flex-1 relative" ref={searchRef}>
                <form
                  onSubmit={(e) => { handleSearch(e); setShowSuggestions(false) }}
                  className="flex flex-1 items-stretch h-[40px] rounded-lg ring-2 ring-transparent focus-within:ring-brand-gold border border-transparent bg-white transition-all"
                >
                  {/* "All" category dropdown — mockup lines 135-138, wired to getCategories() */}
                  <div className="relative" ref={categoryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setCategoryDropdownOpen((p) => !p)}
                      aria-haspopup="listbox"
                      aria-expanded={categoryDropdownOpen}
                      className="h-full px-3 flex items-center gap-1 text-[12px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border-r border-gray-300 transition-colors whitespace-nowrap max-w-[140px] rounded-l-lg"
                    >
                      <span className="truncate">{selectedCategoryLabel}</span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                    </button>
                    {categoryDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 w-56 max-h-[60vh] overflow-y-auto rounded-lg border border-gray-200 shadow-xl bg-white z-[60] py-1">
                        <button
                          type="button"
                          onClick={() => handleCategoryPick("")}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors",
                            searchCategorySlug === "" ? "font-semibold text-foreground" : "text-gray-700",
                          )}
                        >
                          All categories
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        {categories
                          .filter((c) => !isServicesCategory(c.slug))
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleCategoryPick(c.slug)}
                              className={cn(
                                "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors",
                                searchCategorySlug === c.slug
                                  ? "font-semibold text-foreground"
                                  : "text-gray-700",
                              )}
                            >
                              {c.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
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
                    className="flex items-center justify-center w-12 bg-brand-gold hover:bg-brand-gold-hover transition-colors shrink-0 rounded-r-lg"
                    aria-label="Search"
                  >
                    <Search className="h-4 w-4 text-brand-gold-foreground" strokeWidth={2.5} />
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
                          const path = item.slug?.trim() ? `/product/${item.slug}` : `/product/${item.product_id}`
                          router.push(path)
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
                            {item.price > 0 && <span className="ml-2 text-foreground font-medium">${item.price.toFixed(2)}</span>}
                          </p>
                        </div>
                      </button>
                    ))}
                    <button
                      className="w-full px-4 py-2 text-xs text-foreground font-medium text-center hover:bg-gray-50 transition-colors border-t border-gray-100"
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
                className="md:hidden flex items-center justify-center w-9 h-9 rounded text-white hover:text-brand-gold hover:bg-white/10 transition-colors shrink-0"
                onClick={() => {
                  setMobileMenuOpen(false)
                  setMobileSearchOpen(true)
                }}
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>

              {/* ── Inline nav links — desktop only, mockup lines 145-150 ── */}
              <nav className="hidden lg:flex items-center gap-6 shrink-0">
                <Link
                  href="/deals"
                  className="text-white font-bold text-[14px] border-b-2 border-brand-gold pb-0.5 hover:text-brand-gold transition-colors"
                >
                  Deals
                </Link>
                <Link
                  href="/search?sort=newest"
                  className="text-white text-[14px] hover:text-brand-gold transition-colors"
                >
                  New Arrivals
                </Link>
                <Link
                  href="/help"
                  className="text-white text-[14px] hover:text-brand-gold transition-colors"
                >
                  Help
                </Link>
              </nav>

              {/* ── Account — single button → dropdown whose content depends on auth state ── */}
              <div className="relative hidden md:block" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((p) => !p)}
                  className="flex flex-col items-center justify-center text-white hover:text-brand-gold-hover transition-colors shrink-0"
                  aria-label="Account menu"
                  aria-expanded={userMenuOpen}
                >
                  <CircleUser className="h-6 w-6" strokeWidth={1.75} />
                  <span className="text-[12px] font-semibold tracking-[0.02em] leading-none mt-0.5">Account</span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-200 shadow-xl bg-white z-[60] py-2 overflow-hidden">
                    {isAuthenticated ? (
                      <>
                        <div className="px-4 py-3 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{userName ?? "User"}</p>
                            {isDeveloper && <RoleBadge label="DEV" />}
                            {!isDeveloper && isAdmin && <RoleBadge label="ADMIN" tone="amber" />}
                          </div>
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
                          <Link href="/account/wishlist" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                            <Heart className="h-4 w-4 text-gray-400" />
                            Wishlist
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
                      </>
                    ) : (
                      <>
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-900">Welcome</p>
                          <p className="text-xs text-gray-500">Sign in to your account, or create one.</p>
                        </div>
                        <div className="px-4 py-3 space-y-2">
                          <button
                            type="button"
                            disabled={authPending !== null}
                            onClick={() => {
                              setUserMenuOpen(false)
                              beginSignIn("signin")
                            }}
                            className="inline-flex w-full items-center justify-center gap-1.5 bg-brand-gold hover:bg-brand-gold-hover text-brand-gold-foreground font-bold text-sm py-2 rounded-full transition-colors disabled:cursor-wait disabled:opacity-80"
                          >
                            {authPending === "signin" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {authPending === "signin" ? "Signing in…" : "Sign in"}
                          </button>
                          <button
                            type="button"
                            disabled={authPending !== null}
                            onClick={() => {
                              setUserMenuOpen(false)
                              beginSignIn("register")
                            }}
                            className="inline-flex w-full items-center justify-center gap-1.5 bg-white border border-gray-300 hover:border-gray-400 text-gray-900 font-semibold text-sm py-2 rounded-full transition-colors disabled:cursor-wait disabled:opacity-80"
                          >
                            {authPending === "register" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {authPending === "register" ? "Opening…" : "Create account"}
                          </button>
                        </div>
                        <div className="border-t border-gray-100 py-1">
                          <Link
                            href="/orders"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                          >
                            <Package className="h-4 w-4 text-gray-400" />
                            Track an order
                          </Link>
                          <Link
                            href="/help"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                          >
                            <Settings className="h-4 w-4 text-gray-400" />
                            Help Center
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Cart — mockup lines 157-161 — text-only hover, badge on icon */}
              <Link
                href="/cart"
                onClick={() => setMobileMenuOpen(false)}
                className="flex flex-col items-center justify-center text-white hover:text-brand-gold-hover transition-colors shrink-0"
                aria-label="Cart"
              >
                <div className="relative">
                  <ShoppingCart className="h-6 w-6" strokeWidth={1.75} />
                  {!cartReady ? (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/20">
                      <Loader2 className="h-2.5 w-2.5 animate-spin text-white" aria-hidden />
                      <span className="sr-only">Loading cart</span>
                    </span>
                  ) : cartCount > 0 ? (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-gold text-[10px] font-bold text-brand-gold-foreground px-0.5">
                      {cartCount}
                    </span>
                  ) : null}
                </div>
                <span className="text-[12px] font-semibold tracking-[0.02em] leading-none mt-0.5">Cart</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Row 2 removed per mockup — keeping props/refs/nav data intact for restore ── */}
        {false && (
        <nav className="hidden md:block bg-[#3a3c3c] border-b border-black/30">
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
                      className={`group items-center gap-1.5 px-3 h-full text-[13px] text-white/40 whitespace-nowrap cursor-default select-none ${hideClass}`}
                    >
                      <Icon className="h-3.5 w-3.5 opacity-40 shrink-0" style={{ color: link.accent }} />
                      {link.name}
                      <span className="ml-1 text-[9px] font-semibold bg-white/10 text-white/50 rounded px-1 py-0.5 leading-none">Soon</span>
                    </span>
                  )
                }
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`group items-center gap-1.5 px-3 h-full text-[13px] text-white/85 whitespace-nowrap hover:text-brand-gold hover:bg-white/5 transition-colors ${hideClass}`}
                  >
                    <Icon className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 shrink-0" style={{ color: link.accent }} />
                    {link.name}
                  </Link>
                )
              })}

              <div className="flex-1" />

              <StartSellingLink variant="header" />
            </div>
          </div>
        </nav>
        )}

        {/* Mockup nav links — Deals / New Arrivals / Sellers / Help — rendered
            inline on desktop in Row 1 above is preferred, but to keep the diff
            surgical we render this slim accent strip ONLY when there are
            category links worth showing; the mobile menu still has all of them. */}
      </header>

      {/* ── Mobile slide-out menu — matches /public/ux-designs/mobile-{1,2}.png ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[45] flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity"
            aria-label="Close menu"
            onClick={closeMobileMenu}
          />
          <nav
            className="relative flex h-full w-[min(22rem,calc(100vw-14px))] max-w-[90vw] flex-col overflow-hidden rounded-r-2xl bg-gray-50 shadow-2xl animate-in slide-in-from-left duration-200 ease-out"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
            aria-label="Main menu"
          >
            {/* ── Dark greeting strip ── */}
            <div className="relative shrink-0 bg-brand-dark px-4 pb-5 pt-5 text-white rounded-br-3xl">
              <button
                type="button"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
                aria-label="Close menu"
                onClick={closeMobileMenu}
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>

              <div className="flex items-center gap-3">
                {/* Avatar — gold square w/ user icon (signed out) or initials (signed in) */}
                <div
                  className={cn(
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-white",
                    isAuthenticated ? "bg-brand-dark text-brand-gold" : "bg-brand-gold text-brand-gold-foreground",
                  )}
                >
                  {isAuthenticated && firstName ? (
                    <span className="text-xl font-bold uppercase">{firstName.charAt(0)}</span>
                  ) : (
                    <User className="h-6 w-6" strokeWidth={2} />
                  )}
                </div>

                <div className="min-w-0 flex-1 pr-10">
                  {isAuthenticated && firstName ? (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="truncate text-lg font-bold leading-tight">Hello, {firstName}</p>
                        {isDeveloper && <RoleBadge label="DEV" />}
                        {!isDeveloper && isAdmin && <RoleBadge label="ADMIN" tone="amber" />}
                      </div>
                      <Link
                        href="/account"
                        onClick={closeMobileMenu}
                        className="mt-0.5 inline-flex items-center text-sm font-semibold text-brand-gold"
                      >
                        Manage Profile &amp; Account
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold leading-tight">Welcome to AfroTransact</p>
                      <button
                        type="button"
                        disabled={authPending !== null}
                        onClick={() => {
                          closeMobileMenu()
                          beginSignIn("signin")
                        }}
                        className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-gold disabled:cursor-wait disabled:opacity-80"
                      >
                        {authPending === "signin" ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
                            Signing in…
                          </>
                        ) : (
                          <>
                            Sign in / Register
                            <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
              <MobileMenuSectionTitle>Shop</MobileMenuSectionTitle>
              <MobileMenuRow href="/categories" onClick={closeMobileMenu} icon={LayoutGrid}>
                All Categories
              </MobileMenuRow>
              <MobileMenuRow
                href="/deals"
                onClick={closeMobileMenu}
                icon={Tag}
                badge={
                  <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Hot
                  </span>
                }
              >
                Today&apos;s Deals
              </MobileMenuRow>

              <div className="mx-5 my-2 border-t border-gray-200" />

              <MobileMenuSectionTitle>
                {isAuthenticated ? "My Account" : "Account"}
              </MobileMenuSectionTitle>
              <MobileMenuRow
                href={isAuthenticated ? "/orders" : "/auth/login?callbackUrl=/orders"}
                onClick={closeMobileMenu}
                icon={Package}
              >
                My Orders
              </MobileMenuRow>
              <MobileMenuRow
                href={isAuthenticated ? "/account/wishlist" : "/auth/login?callbackUrl=/account/wishlist"}
                onClick={closeMobileMenu}
                icon={Eye}
              >
                Watchlist
              </MobileMenuRow>
              <MobileMenuRow
                href={isAuthenticated ? "/account/settings" : "/auth/login?callbackUrl=/account/settings"}
                onClick={closeMobileMenu}
                icon={Settings}
                active={pathname?.startsWith("/account/settings") ?? false}
              >
                Settings
              </MobileMenuRow>

              {/* ── For Sellers ── */}
              <div className="mx-5 my-2 border-t border-gray-200" />
              <MobileMenuSectionTitle>For Sellers</MobileMenuSectionTitle>
              {(isSeller || isAdmin) && (
                <MobileMenuRow href="/dashboard" onClick={closeMobileMenu} icon={LayoutGrid}>
                  Seller Dashboard
                </MobileMenuRow>
              )}
              {!isSeller && !isAdmin && (
                <MobileMenuRow href="/sell" onClick={closeMobileMenu} icon={Store}>
                  Sell on AfroTransact
                </MobileMenuRow>
              )}
              {isAdmin && (
                <MobileMenuRow href="/admin" onClick={closeMobileMenu} icon={ShieldCheck}>
                  Admin Panel
                </MobileMenuRow>
              )}

              <div className="flex-1" />

              {/* ── Footer ── */}
              <div className="shrink-0 border-t border-gray-200 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => {
                      closeMobileMenu()
                      void signOut()
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-bold uppercase tracking-wider text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={2.25} />
                    Sign Out
                  </button>
                ) : (
                  <p className="text-center text-sm font-semibold text-gray-500">AfroTransact</p>
                )}
              </div>
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
                      const path = item.slug?.trim() ? `/product/${item.slug}` : `/product/${item.product_id}`
                      router.push(path)
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
                        {item.price > 0 && <span className="ml-2 text-foreground font-semibold">${item.price.toFixed(2)}</span>}
                      </p>
                    </div>
                  </button>
                ))}
                <button
                  className="w-full px-4 py-3 text-sm text-foreground font-medium text-center hover:bg-gray-50 transition-colors"
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

/**
 * Small pill used to surface elevated-access roles next to the user name in
 * the desktop user-menu + the mobile menu greeting strip.
 *
 * Developers get DEV (purple) — the badge is the visible signal that a
 * Keycloak composite role is granting admin+seller+buyer at once. Admins get
 * ADMIN (amber). Sellers don't get a badge; the seller dashboard surface
 * already tells them.
 */
function RoleBadge({ label, tone = "purple" }: { label: string; tone?: "purple" | "amber" }) {
  const cls = tone === "amber"
    ? "bg-amber-100 text-amber-800 border-amber-300"
    : "bg-purple-100 text-purple-800 border-purple-300"
  return (
    <span
      title={`Signed in as ${label.toLowerCase()}`}
      className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  )
}
