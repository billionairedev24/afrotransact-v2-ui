"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronRight, Flame, Clock, Tag, Sparkles, ArrowRight, Loader2, ExternalLink } from "lucide-react"
import { getActiveDeals, type DealData } from "@/lib/api"

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

const SELLER_DEAL_COLORS = [
  { bg: "from-orange-50 to-orange-100", border: "border-orange-200", accent: "text-orange-700", badge: "bg-orange-600" },
  { bg: "from-emerald-50 to-emerald-100", border: "border-emerald-200", accent: "text-emerald-700", badge: "bg-emerald-600" },
  { bg: "from-blue-50 to-blue-100", border: "border-blue-200", accent: "text-blue-700", badge: "bg-blue-600" },
  { bg: "from-purple-50 to-purple-100", border: "border-purple-200", accent: "text-purple-700", badge: "bg-purple-600" },
  { bg: "from-rose-50 to-rose-100", border: "border-rose-200", accent: "text-rose-700", badge: "bg-rose-600" },
  { bg: "from-sky-50 to-sky-100", border: "border-sky-200", accent: "text-sky-700", badge: "bg-sky-600" },
]

export default function DealsPage() {
  const [platformDeals, setPlatformDeals] = useState<PlatformDeal[]>([])
  const [sellerDeals, setSellerDeals] = useState<DealData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [pRes, sRes] = await Promise.allSettled([
          fetch(`${API_BASE}/api/v1/platform-deals`).then(r => r.ok ? r.json() : []),
          getActiveDeals(),
        ])
        if (pRes.status === "fulfilled") setPlatformDeals(pRes.value)
        if (sRes.status === "fulfilled") setSellerDeals(sRes.value)
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 py-10">
      <div className="flex items-center gap-2 mb-1 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900">Deals</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-2">
            <Flame className="h-7 w-7 text-orange-400" />
            Today&apos;s Deals
          </h1>
          <p className="text-gray-500 mt-1">Limited-time offers from the platform and sellers near you</p>
        </div>
        <Link href="/search?sort=discount" className="hidden sm:flex items-center gap-1 text-sm text-primary hover:text-primary/80">
          All discounted items <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading deals...
        </div>
      )}

      {/* Platform Deals / Banners */}
      {platformDeals.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-bold text-gray-900">Featured Promotions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {platformDeals.map((deal) => (
              <div
                key={deal.id}
                className="group relative rounded-2xl overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow"
                style={{
                  background: deal.bannerImageUrl
                    ? `url(${deal.bannerImageUrl}) center/cover no-repeat`
                    : `linear-gradient(135deg, ${deal.secondaryColor}, ${deal.primaryColor}20)`,
                }}
              >
                <div
                  className="relative p-6 min-h-[180px] flex flex-col justify-between"
                  style={{
                    background: deal.bannerImageUrl ? "rgba(0,0,0,0.5)" : undefined,
                  }}
                >
                  <div>
                    {deal.badgeText && (
                      <span
                        className="inline-block rounded-full px-3 py-0.5 text-xs font-bold mb-3"
                        style={{ backgroundColor: deal.primaryColor, color: deal.secondaryColor }}
                      >
                        {deal.badgeText}
                      </span>
                    )}
                    <h3
                      className="text-xl font-bold leading-snug mb-1"
                      style={{ color: deal.textColor }}
                    >
                      {deal.title}
                    </h3>
                    {deal.description && (
                      <p className="text-sm opacity-80 leading-relaxed" style={{ color: deal.textColor }}>
                        {deal.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    {deal.endAt && (
                      <span className="flex items-center gap-1 text-xs opacity-60" style={{ color: deal.textColor }}>
                        <Clock className="h-3 w-3" />
                        Ends {new Date(deal.endAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {deal.ctaLink && (
                      <Link
                        href={deal.ctaLink}
                        className="flex items-center gap-1 text-sm font-semibold rounded-lg px-4 py-2 transition-transform hover:scale-105"
                        style={{ backgroundColor: deal.primaryColor, color: deal.secondaryColor }}
                      >
                        {deal.ctaText || "Learn More"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Seller Deals */}
      {sellerDeals.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-bold text-gray-900">Seller Deals</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sellerDeals.map((deal, idx) => {
              const colors = SELLER_DEAL_COLORS[idx % SELLER_DEAL_COLORS.length]
              return (
                <Link
                  key={deal.id}
                  href={deal.productSlug ? `/product/${deal.productSlug}` : "/search?sort=discount"}
                  className={`group rounded-2xl border ${colors.border} bg-gradient-to-br ${colors.bg} p-5 hover:shadow-md hover:scale-[1.01] transition-all duration-200`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <span className={`text-[11px] font-bold rounded-full px-2.5 py-0.5 text-white ${colors.badge}`}>
                        {deal.badgeText || "Deal"}
                      </span>
                      {deal.endAt && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <Clock className="h-3 w-3" />
                          Ends {new Date(deal.endAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>

                    {deal.productImageUrl && (
                      <div className="relative h-32 w-full rounded-xl overflow-hidden bg-white">
                        <img
                          src={deal.productImageUrl}
                          alt={deal.productTitle || deal.title}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}

                    <div>
                      <h3 className={`font-bold ${colors.accent} leading-snug`}>{deal.title}</h3>
                      {deal.productTitle && (
                        <p className="text-sm text-gray-600 mt-0.5 truncate">{deal.productTitle}</p>
                      )}
                      {deal.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{deal.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        {deal.discountPercent && (
                          <span className={`text-sm font-bold ${colors.accent}`}>{deal.discountPercent}% OFF</span>
                        )}
                        {deal.dealPriceCents && deal.originalPriceCents && (
                          <span className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-gray-900">${(deal.dealPriceCents / 100).toFixed(2)}</span>
                            <span className="text-xs text-gray-400 line-through">${(deal.originalPriceCents / 100).toFixed(2)}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[12px] font-semibold text-gray-500 group-hover:text-gray-900 flex items-center gap-0.5 transition-colors">
                        Shop <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>

                    {deal.storeName && (
                      <p className="text-[11px] text-gray-400">by {deal.storeName}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {!loading && platformDeals.length === 0 && sellerDeals.length === 0 && (
        <div className="text-center py-20">
          <Tag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">No deals available right now</h2>
          <p className="text-gray-500 text-sm">Check back soon for amazing offers from our sellers!</p>
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
        <Tag className="h-6 w-6 text-primary mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900">Want to run a deal on your store?</h2>
        <p className="text-gray-500 text-sm mt-1 mb-4">Sellers can create promotions directly from their dashboard.</p>
        <Link href="/dashboard/deals" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-header hover:bg-primary/90 transition-colors">
          Go to Seller Dashboard <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  )
}
