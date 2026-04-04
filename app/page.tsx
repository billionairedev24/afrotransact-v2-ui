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
  TrendingUp,
  Clock,
  Sparkles,
  Tag,
  Gift,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { StartSellingLink } from "@/components/selling/StartSellingLink"
import { HeroCarousel } from "@/components/home/HeroCarousel"
import { AdSlot } from "@/components/home/AdSlot"
import { FeaturedProducts } from "@/components/home/FeaturedProducts"
import { CategoryShowcaseAmazon } from "@/components/categories/CategoryShowcaseAmazon"
import { getCategories, getAllStores, getFeaturedDeals, type CategoryRef, type StoreInfo, type DealData } from "@/lib/api"
import { StoreCardSkeleton } from "@/components/ui/Skeleton"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface PlatformDeal {
  id: string
  title: string
  description: string | null
  badgeText: string | null
  bannerImageUrl: string | null
  primaryColor: string
  secondaryColor: string
  textColor: string
  ctaText: string | null
  ctaLink: string | null
}

const BANNER_GRADIENTS = [
  "linear-gradient(135deg, #1a2e1a, #0f1f0f)",
  "linear-gradient(135deg, #2e1a1a, #1f0f0f)",
  "linear-gradient(135deg, #1a1a2e, #0f0f1f)",
  "linear-gradient(135deg, #2e2a1a, #1f180f)",
  "linear-gradient(135deg, #1a2e2e, #0f1f1f)",
]

const DEFAULT_DEAL_COLORS = [
  "bg-orange-900 border-orange-700",
  "bg-emerald-900 border-emerald-700",
  "bg-blue-900 border-blue-700",
  "bg-purple-900 border-purple-700",
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
  const [deals, setDeals] = useState<DealData[]>([])
  const [platformDeals, setPlatformDeals] = useState<PlatformDeal[]>([])

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {})

    getAllStores()
      .then((s) => setStores(s.slice(0, 6)))
      .catch(() => {})

    getFeaturedDeals()
      .then((list) => setDeals(list))
      .catch(() => {})

    fetch(`${API_BASE}/api/v1/platform-deals`)
      .then(r => r.ok ? r.json() : [])
      .then(list => setPlatformDeals(Array.isArray(list) ? list.slice(0, 3) : []))
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pb-[env(safe-area-inset-bottom,0px)] md:pb-0">

        <HeroCarousel />

        <section className="bg-card/70 border-y border-border">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
              <span className="shrink-0 text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                Today&apos;s Deals
              </span>
              <span className="w-px h-5 bg-border shrink-0" />
              {(deals.length > 0 ? deals : []).map((deal, idx) => {
                const color = DEFAULT_DEAL_COLORS[idx % DEFAULT_DEAL_COLORS.length]
                return (
                  <Link
                    key={deal.id}
                    href={deal.productSlug ? `/product/${deal.productSlug}` : "/deals"}
                    className={`shrink-0 flex items-center gap-2 rounded-lg border ${color} px-3 py-1.5 text-xs font-medium text-white/90 hover:brightness-110 transition-all`}
                  >
                    <span>{deal.badgeText || "Deal"}</span>
                    <span className="text-white/70">·</span>
                    <span className="text-white/80">
                      {deal.title}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        <AdSlot slotId="mid-page-1" />

        {platformDeals.length > 0 && (
          <section className="mx-auto max-w-[1440px] px-4 sm:px-6 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {platformDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="group relative rounded-2xl overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow"
                  style={{
                    background: deal.bannerImageUrl
                      ? `url(${deal.bannerImageUrl}) center/cover no-repeat`
                      : `linear-gradient(135deg, ${deal.secondaryColor}, ${deal.primaryColor}40)`,
                  }}
                >
                  <div
                    className="relative p-5 min-h-[150px] flex flex-col justify-between"
                    style={{ background: deal.bannerImageUrl ? "rgba(0,0,0,0.45)" : undefined }}
                  >
                    <div>
                      {deal.badgeText && (
                        <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold mb-2"
                          style={{ backgroundColor: deal.primaryColor, color: deal.secondaryColor }}>
                          {deal.badgeText}
                        </span>
                      )}
                      <h3 className="text-lg font-bold leading-snug" style={{ color: deal.textColor }}>{deal.title}</h3>
                      {deal.description && (
                        <p className="text-xs opacity-75 mt-1 line-clamp-2" style={{ color: deal.textColor }}>{deal.description}</p>
                      )}
                    </div>
                    {deal.ctaLink && (
                      <Link
                        href={deal.ctaLink}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-bold rounded-lg px-3 py-1.5 self-start hover:scale-105 transition-transform"
                        style={{ backgroundColor: deal.primaryColor, color: deal.secondaryColor }}
                      >
                        {deal.ctaText || "Learn More"} <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="bg-[#eaeded] border-y border-gray-200">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-10 sm:py-12">
            <div className="flex items-end justify-between mb-5 sm:mb-6 gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Shop by category</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Explore subcategories with real product photos
                </p>
              </div>
              <Link
                href="/categories"
                className="text-sm font-medium text-blue-700 hover:text-blue-900 shrink-0 flex items-center gap-1"
              >
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {categories.length > 0 ? (
              <CategoryShowcaseAmazon categories={categories} maxParents={8} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm animate-pulse"
                  >
                    <div className="h-5 bg-gray-100 rounded w-2/3 mb-3" />
                    <div className="grid grid-cols-2 gap-2">
                      {Array.from({ length: 4 }).map((__, j) => (
                        <div key={j} className="aspect-square bg-gray-100 rounded-md" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                    <StoreCardSkeleton key={i} />
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
                <StartSellingLink variant="button">
                  Start Selling Today
                  <ChevronRight className="h-4 w-4" />
                </StartSellingLink>
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
    </div>
  )
}
