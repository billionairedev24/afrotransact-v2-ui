"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ChevronRight,
  MapPin,
  Star,
  Store,
  Truck,
  ShieldCheck,
  Users,
  Leaf,
  Flame,
  Beef,
  Cookie,
  Cpu,
  Shirt,
  Wine,
  Package,
  TrendingUp,
  Clock,
  Sparkles,
  Tag,
  Gift,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileNav } from "@/components/layout/mobile-nav"
import { HeroCarousel } from "@/components/home/HeroCarousel"
import { AdSlot } from "@/components/home/AdSlot"
import { FeaturedProducts } from "@/components/home/FeaturedProducts"
import { getCategories, getAllStores, type CategoryRef, type StoreInfo } from "@/lib/api"

const CATEGORY_STYLE_MAP: Record<string, { icon: typeof Leaf; bg: string; border: string; iconColor: string }> = {
  produce:     { icon: Leaf,    bg: "from-emerald-950 to-emerald-900", border: "border-emerald-800/50", iconColor: "text-emerald-400" },
  spices:      { icon: Flame,   bg: "from-orange-950 to-orange-900",  border: "border-orange-800/50",  iconColor: "text-orange-400"  },
  meats:       { icon: Beef,    bg: "from-red-950 to-red-900",        border: "border-red-800/50",     iconColor: "text-red-400"     },
  baked:       { icon: Cookie,  bg: "from-amber-950 to-amber-900",    border: "border-amber-800/50",   iconColor: "text-amber-400"   },
  beverages:   { icon: Wine,    bg: "from-sky-950 to-sky-900",        border: "border-sky-800/50",     iconColor: "text-sky-400"     },
  fashion:     { icon: Shirt,   bg: "from-purple-950 to-purple-900",  border: "border-purple-800/50",  iconColor: "text-purple-400"  },
  electronics: { icon: Cpu,     bg: "from-blue-950 to-blue-900",      border: "border-blue-800/50",    iconColor: "text-blue-400"    },
  pantry:      { icon: Package, bg: "from-yellow-950 to-yellow-900",  border: "border-yellow-800/50",  iconColor: "text-yellow-400"  },
}

const DEFAULT_STYLE = {
  icon: Package,
  bg: "from-gray-900 to-gray-800",
  border: "border-gray-700/50",
  iconColor: "text-gray-400",
}

function getCategoryStyle(slug: string) {
  const key = Object.keys(CATEGORY_STYLE_MAP).find((k) => slug.toLowerCase().includes(k))
  return key ? CATEGORY_STYLE_MAP[key] : DEFAULT_STYLE
}

const BANNER_GRADIENTS = [
  "linear-gradient(135deg, #1a2e1a, #0f1f0f)",
  "linear-gradient(135deg, #2e1a1a, #1f0f0f)",
  "linear-gradient(135deg, #1a1a2e, #0f0f1f)",
  "linear-gradient(135deg, #2e2a1a, #1f180f)",
  "linear-gradient(135deg, #1a2e2e, #0f1f1f)",
]

const deals = [
  { label: "Flash Sale", detail: "Spices up to 40% off", color: "bg-orange-900 border-orange-700" },
  { label: "Fresh Produce Week", detail: "Buy 2 get 1 free", color: "bg-emerald-900 border-emerald-700" },
  { label: "New Seller Spotlight", detail: "Roots & Culture — free delivery", color: "bg-blue-900 border-blue-700" },
  { label: "Weekend Bundle", detail: "Starter pack — $24.99", color: "bg-purple-900 border-purple-700" },
]

const trustPoints = [
  {
    icon: Users,
    title: "Community-Owned",
    body: "Every vendor is a member of your immigrant community. Your purchase directly supports a neighbor.",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
  },
  {
    icon: ShieldCheck,
    title: "Verified & Trusted",
    body: "All sellers are identity-verified and held to our quality standards. Shop with complete confidence.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: Truck,
    title: "Same-Day Local Delivery",
    body: "Orders placed before 2 PM delivered today across Austin, Georgetown, Round Rock, and Leander.",
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
  },
]

export default function HomePage() {
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [stores, setStores] = useState<StoreInfo[]>([])

  useEffect(() => {
    getCategories()
      .then((cats) => setCategories(cats.slice(0, 8)))
      .catch(() => {})

    getAllStores()
      .then((s) => setStores(s.slice(0, 6)))
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pb-16 md:pb-0">

        <HeroCarousel />

        <section className="bg-card/70 border-y border-border">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
              <span className="shrink-0 text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                Today&apos;s Deals
              </span>
              <span className="w-px h-5 bg-border shrink-0" />
              {deals.map((deal) => (
                <Link
                  key={deal.label}
                  href="/deals"
                  className={`shrink-0 flex items-center gap-2 rounded-lg border ${deal.color} px-3 py-1.5 text-xs font-medium text-white/90 hover:brightness-110 transition-all`}
                >
                  <span>{deal.label}</span>
                  <span className="text-white/70">·</span>
                  <span className="text-white/80">{deal.detail}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <AdSlot slotId="mid-page-1" />

        <section className="bg-card/40 border-y border-border">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Shop by Category</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Everything you need, all in one place
                </p>
              </div>
              <Link
                href="/categories"
                className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {categories.length > 0
                ? categories.map((cat) => {
                    const style = getCategoryStyle(cat.slug)
                    const Icon = style.icon
                    return (
                      <Link
                        key={cat.id}
                        href={`/category/${cat.slug}`}
                        className={`group relative overflow-hidden rounded-2xl border ${style.border} bg-gradient-to-br ${style.bg} p-5 hover:scale-[1.02] transition-transform duration-200 active:scale-[0.99]`}
                      >
                        <div className="space-y-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                            <Icon className={`h-5 w-5 ${style.iconColor}`} strokeWidth={1.75} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white text-sm leading-tight">
                              {cat.name}
                            </h3>
                            {cat.children && cat.children.length > 0 && (
                              <p className="text-[11px] text-white/60 mt-0.5">
                                {cat.children.slice(0, 3).map((c) => c.name).join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-white/50 group-hover:text-white/80 transition-colors">
                            <span>Shop now</span>
                            <ChevronRight className="h-3 w-3" />
                          </div>
                        </div>
                      </Link>
                    )
                  })
                : Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-border bg-muted/20 p-5 animate-pulse">
                      <div className="space-y-3">
                        <div className="h-11 w-11 rounded-xl bg-muted" />
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        </section>

        <FeaturedProducts
          title="Fresh Near You"
          subtitle="Based on Austin, TX"
          sortBy="rating"
          size={8}
          viewAllHref="/search?sort=rating"
        />

        <FeaturedProducts
          title="New Arrivals"
          subtitle="Recently added products"
          sortBy="newest"
          size={8}
          viewAllHref="/search?sort=newest"
          icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
        />

        <AdSlot slotId="mid-page-2" />

        <section className="bg-card/40 border-y border-border">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Top Stores</h2>
                <p className="text-sm text-muted-foreground mt-1">Discover vendors in your community</p>
              </div>
              <Link
                href="/stores"
                className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                All stores <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stores.length > 0
                ? stores.map((store, i) => (
                    <Link
                      key={store.id}
                      href={`/store/${store.slug || store.id}`}
                      className="group relative rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
                    >
                      <div
                        className="h-28 relative"
                        style={{
                          background: store.bannerUrl
                            ? `url(${store.bannerUrl}) center/cover`
                            : BANNER_GRADIENTS[i % BANNER_GRADIENTS.length],
                        }}
                      >
                        {!store.bannerUrl && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-10">
                            <Store className="h-16 w-16 text-white" />
                          </div>
                        )}
                        <div className="absolute -bottom-5 left-4 h-12 w-12 rounded-xl bg-card border-2 border-border flex items-center justify-center overflow-hidden">
                          {store.logoUrl ? (
                            <img src={store.logoUrl} alt={store.name} className="h-full w-full object-cover" />
                          ) : (
                            <Store className="h-6 w-6 text-primary" />
                          )}
                        </div>
                      </div>

                      <div className="pt-8 px-4 pb-4 space-y-2">
                        <div>
                          <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
                            {store.name}
                          </h3>
                          {store.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{store.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          {store.rating > 0 && (
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <Star className="h-3 w-3 fill-primary text-primary" />
                              {store.rating.toFixed(1)}
                              {store.reviewCount > 0 && (
                                <span className="text-muted-foreground font-normal">({store.reviewCount})</span>
                              )}
                            </span>
                          )}
                          {store.addressCity && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {store.addressCity}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))
                : Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
                      <div className="h-28 bg-muted" />
                      <div className="pt-8 px-4 pb-4 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Why thousands of immigrants shop with us
            </h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
              More than a marketplace — a bridge between your new home and your roots.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {trustPoints.map((point) => {
              const Icon = point.icon
              return (
                <div
                  key={point.title}
                  className={`rounded-2xl border ${point.bg} p-6 space-y-3`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${point.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-[17px] font-bold text-foreground">{point.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{point.body}</p>
                </div>
              )
            })}
          </div>
        </section>

        <AdSlot slotId="bottom-strip" />

        <section className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-card to-secondary/10 border-y border-border">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-5"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, rgba(212,168,83,0.4) 0%, transparent 50%), " +
                "radial-gradient(circle at 80% 50%, rgba(34,197,94,0.3) 0%, transparent 50%)",
            }}
          />
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-16 relative">
            <div className="max-w-2xl mx-auto text-center space-y-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <Store className="h-3 w-3" />
                For Vendors
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-foreground leading-tight">
                Turn your passion into{" "}
                <span className="text-primary">a thriving business</span>
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Join 200+ immigrant entrepreneurs already selling on AfroTransact. Set up your store in
                minutes, reach thousands of customers in Austin, and grow on your own terms.
              </p>

              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto pt-2">
                {[
                  { name: "Starter", price: "$29.99", tag: "Most popular" },
                  { name: "Growth",  price: "$79.99", tag: "Scale faster"  },
                  { name: "Pro",     price: "$149.99", tag: "Full power"   },
                ].map((plan) => (
                  <div
                    key={plan.name}
                    className="rounded-xl border border-gray-200 bg-white p-3 text-center"
                  >
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{plan.name}</p>
                    <p className="text-sm font-bold text-gray-900">{plan.price}<span className="text-[10px] font-normal text-gray-400">/mo</span></p>
                    <p className="text-[10px] text-emerald-400 mt-0.5">{plan.tag}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="text-primary font-semibold">First month free.</span>{" "}
                Second month free if you list 9+ products. Then pay monthly.
              </p>

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Link
                  href="/sell"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-8 text-[15px] font-bold text-header shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98]"
                >
                  Start Selling Today
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/sell/pricing"
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-gray-300 bg-white px-8 text-[15px] font-semibold text-gray-900 hover:bg-gray-50 transition-all"
                >
                  View Pricing
                </Link>
              </div>

              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
                {[
                  { icon: <ShieldCheck className="h-4 w-4 text-emerald-400" />, text: "No hidden fees" },
                  { icon: <Sparkles className="h-4 w-4 text-primary" />, text: "1st month free" },
                  { icon: <Gift className="h-4 w-4 text-violet-400" />, text: "Free onboarding support" },
                  { icon: <Tag className="h-4 w-4 text-sky-400" />, text: "Cancel anytime" },
                ].map(({ icon, text }) => (
                  <span key={text} className="flex items-center gap-1.5">
                    {icon}
                    {text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <MobileNav />
    </div>
  )
}
