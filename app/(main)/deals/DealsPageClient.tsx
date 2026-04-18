"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ChevronRight,
  Flame,
  Clock,
  Tag,
  Sparkles,
  ArrowRight,
  Loader2,
  ShoppingBag,
  Percent,
  Store,
  TrendingUp,
  Star,
  Zap,
  Gift,
  BadgePercent,
} from "lucide-react"
import { getActiveDeals, type DealData } from "@/lib/api"
import { StartSellingLink } from "@/components/selling/StartSellingLink"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface PlatformDeal {
  id: string
  title: string
  description: string | null
  content: string | null
  badgeText: string | null
  bannerImageUrl: string | null
  primaryColor: string
  secondaryColor: string
  textColor: string
  ctaText: string | null
  ctaLink: string | null
  targetAudience: string
  enabled: boolean
  active: boolean
  startAt: string | null
  endAt: string | null
  sortOrder: number
  createdAt: string
}

function TimeRemaining({ endAt }: { endAt: string }) {
  const end = new Date(endAt)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  if (diffMs <= 0) return null
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 24)
    return (
      <span className="inline-flex items-center gap-1 text-orange-500 font-semibold">
        <Clock className="h-3 w-3" />
        {diffH}h left
      </span>
    )
  const diffD = Math.floor(diffH / 24)
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
      <Clock className="h-3 w-3" />
      Ends {end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
    </span>
  )
}

function CountdownPill({ endAt }: { endAt: string }) {
  const end = new Date(endAt)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  if (diffMs <= 0) return null
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 48) {
    return (
      <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 shadow-lg">
        <Zap className="h-2.5 w-2.5" />
        {diffH}h left
      </span>
    )
  }
  const diffD = Math.floor(diffH / 24)
  return (
    <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 text-white text-[10px] font-medium px-2.5 py-1 backdrop-blur-sm">
      <Clock className="h-2.5 w-2.5" />
      {diffD}d left
    </span>
  )
}

export default function DealsPageClient() {
  const [platformDeals, setPlatformDeals] = useState<PlatformDeal[]>([])
  const [sellerDeals, setSellerDeals] = useState<DealData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [pRes, sRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/v1/platform-deals`).then((r) => (r.ok ? r.json() : [])),
        getActiveDeals(),
      ])
      if (pRes.status === "fulfilled") setPlatformDeals(pRes.value)
      if (sRes.status === "fulfilled") setSellerDeals(sRes.value)
      setLoading(false)
    }
    load()
  }, [])

  const isEmpty = !loading && platformDeals.length === 0 && sellerDeals.length === 0

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Deals</span>
      </div>

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 p-8 sm:p-12 mb-10 text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 50%), " +
              "radial-gradient(circle at 80% 70%, rgba(255,200,0,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-bold uppercase tracking-wider mb-4">
              <Flame className="h-3.5 w-3.5 text-yellow-300" />
              Limited Time
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-2">
              Today&apos;s Best Deals
            </h1>
            <p className="text-white/80 text-sm sm:text-base max-w-md">
              Handpicked offers from the AfroTransact marketplace — save big on authentic products from our community.
            </p>
          </div>
          <Link
            href="/search?sort=discount"
            className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-white text-orange-600 font-bold px-6 py-3 text-sm hover:bg-orange-50 transition-colors shadow-lg"
          >
            All discounts
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Trust chips */}
        <div className="relative mt-6 flex flex-wrap gap-3">
          {[
            { icon: <Star className="h-3.5 w-3.5 text-yellow-300" />, text: "Verified sellers" },
            { icon: <BadgePercent className="h-3.5 w-3.5 text-green-300" />, text: "Up to 70% off" },
            { icon: <Gift className="h-3.5 w-3.5 text-pink-300" />, text: "Authentic products" },
          ].map(({ icon, text }) => (
            <span
              key={text}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-xs font-medium"
            >
              {icon}
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Finding the best deals for you…</p>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative mb-8">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-red-50 border-2 border-orange-100">
              <Tag className="h-12 w-12 text-orange-400" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white text-lg font-black shadow-lg">
              0
            </span>
          </div>
          <h2 className="text-2xl font-black text-foreground mb-2">No deals right now</h2>
          <p className="text-muted-foreground text-sm max-w-xs mb-2 leading-relaxed">
            Our sellers are cooking up something special. The best deals are coming your way soon!
          </p>
          <p className="text-muted-foreground/60 text-xs mb-8">Check back daily — new deals drop every morning.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/search?sort=rating"
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-md"
            >
              <ShoppingBag className="h-4 w-4" />
              Browse Products
            </Link>
            <Link
              href="/search?sort=newest"
              className="inline-flex items-center gap-2 rounded-2xl border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              New Arrivals
            </Link>
          </div>

          {/* Illustration */}
          <div className="mt-12 grid grid-cols-3 gap-4 w-full max-w-sm opacity-30 pointer-events-none select-none">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-dashed border-border aspect-[3/4] flex items-center justify-center bg-muted/30">
                <Tag className="h-6 w-6 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform / Featured Deals */}
      {platformDeals.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Featured Promotions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {platformDeals.map((deal) => (
              <div
                key={deal.id}
                className="group relative rounded-3xl overflow-hidden border border-border hover:shadow-2xl hover:shadow-black/10 transition-all duration-300"
                style={{
                  background: deal.bannerImageUrl
                    ? `url(${deal.bannerImageUrl}) center/cover no-repeat`
                    : `linear-gradient(135deg, ${deal.secondaryColor || "#f3f4f6"}, ${deal.primaryColor || "#e5e7eb"}40)`,
                }}
              >
                <div
                  className="relative p-7 sm:p-9 min-h-[220px] flex flex-col justify-between"
                  style={{ background: deal.bannerImageUrl ? "rgba(0,0,0,0.5)" : undefined }}
                >
                  <div>
                    {deal.badgeText && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold mb-4 uppercase tracking-wide"
                        style={{ backgroundColor: deal.primaryColor, color: deal.secondaryColor }}
                      >
                        <Zap className="h-3 w-3" />
                        {deal.badgeText}
                      </span>
                    )}
                    <h3
                      className="text-2xl sm:text-3xl font-black leading-tight mb-2"
                      style={{ color: deal.textColor }}
                    >
                      {deal.title}
                    </h3>
                    {deal.description && (
                      <p
                        className="text-sm leading-relaxed opacity-80 max-w-md"
                        style={{ color: deal.textColor }}
                      >
                        {deal.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-6 gap-3">
                    {deal.endAt && (
                      <span
                        className="flex items-center gap-1.5 text-xs opacity-70"
                        style={{ color: deal.textColor }}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        Ends{" "}
                        {new Date(deal.endAt).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    )}
                    {deal.ctaLink && (
                      <Link
                        href={deal.ctaLink}
                        className="flex items-center gap-2 text-sm font-bold rounded-2xl px-5 py-2.5 transition-all hover:scale-105 active:scale-100 shrink-0 shadow-lg"
                        style={{
                          backgroundColor: deal.primaryColor,
                          color: deal.secondaryColor,
                        }}
                      >
                        {deal.ctaText || "Shop Now"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Seller / Product Deals */}
      {sellerDeals.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Deals of the Day</h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                {sellerDeals.length}
              </span>
            </div>
            <Link
              href="/search?sort=discount"
              className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {sellerDeals.map((deal) => (
              <Link
                key={deal.id}
                href={deal.productSlug ? `/product/${deal.productSlug}` : "/search?sort=discount"}
                className="group flex flex-col rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-200 overflow-hidden"
              >
                {/* Product image */}
                <div className="relative h-44 w-full bg-muted overflow-hidden">
                  {deal.productImageUrl ? (
                    <Image
                      src={deal.productImageUrl}
                      alt={deal.productTitle || deal.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-contain p-3 group-hover:scale-[1.04] transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                      <Tag className="h-12 w-12 text-primary/30" />
                    </div>
                  )}
                  {deal.discountPercent && (
                    <span className="absolute top-2.5 left-2.5 rounded-xl bg-red-500 text-white text-xs font-black px-2.5 py-1 shadow-md">
                      -{deal.discountPercent}%
                    </span>
                  )}
                  {deal.endAt && <CountdownPill endAt={deal.endAt} />}
                </div>

                <div className="flex flex-col flex-1 p-3.5 gap-1.5">
                  {deal.badgeText && (
                    <span className="inline-block w-fit rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wide">
                      {deal.badgeText}
                    </span>
                  )}
                  <h3 className="font-bold text-foreground text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {deal.productTitle || deal.title}
                  </h3>
                  {deal.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {deal.description}
                    </p>
                  )}

                  <div className="mt-auto pt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      {deal.dealPriceCents && (
                        <span className="text-base font-black text-primary">
                          ${(deal.dealPriceCents / 100).toFixed(2)}
                        </span>
                      )}
                      {deal.originalPriceCents &&
                        deal.dealPriceCents &&
                        deal.originalPriceCents !== deal.dealPriceCents && (
                          <span className="text-xs text-muted-foreground line-through">
                            ${(deal.originalPriceCents / 100).toFixed(2)}
                          </span>
                        )}
                    </div>

                    {deal.storeName && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Store className="h-3 w-3 shrink-0" />
                        <span className="truncate">{deal.storeName}</span>
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      {deal.endAt && (
                        <div className="text-[10px]">
                          <TimeRemaining endAt={deal.endAt} />
                        </div>
                      )}
                      <span className="ml-auto text-xs font-semibold text-muted-foreground group-hover:text-primary flex items-center gap-0.5 transition-colors">
                        Shop <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sell on AfroTransact — bottom banner (buyer-appropriate, tasteful) */}
      {!loading && (
        <section className="mt-4 rounded-3xl overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700">
          <div className="px-8 sm:px-12 py-10 flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="flex items-start gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20 border border-primary/30">
                <TrendingUp className="h-7 w-7 text-primary" />
              </div>
              <div>
                <span className="inline-block rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 mb-2">
                  For Sellers
                </span>
                <h3 className="font-black text-white text-lg sm:text-xl leading-snug">
                  Sell your products, run your own deals
                </h3>
                <p className="text-gray-400 text-sm mt-1.5 leading-relaxed max-w-sm">
                  Join hundreds of vendors on AfroTransact. Create exclusive offers and reach thousands of customers in your community.
                </p>
              </div>
            </div>
            <StartSellingLink
              variant="bare"
              className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Open Your Store
              <ArrowRight className="h-4 w-4" />
            </StartSellingLink>
          </div>
        </section>
      )}
    </main>
  )
}
