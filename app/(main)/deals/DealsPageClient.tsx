"use client"

/**
 * Deals page — faithful port of public/ux-designs/deals.html.
 *
 * Wires to:
 *   • GET /api/v1/deals          (UnifiedDealsResponse.marketplaceDeals)  via getActiveDeals()
 *
 * Filters are client-side only (the deals endpoint does not yet accept
 * facets); filtering is shallow so the UI matches the mockup without
 * blocking on backend work. Each deal becomes a BrandProductCard so the
 * card style is identical to /search (All Products) and any future listing
 * page — one card definition, one place to restyle.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, Grid3X3, LayoutList, Loader2, Star, Tag } from "lucide-react"
import { cn } from "@/lib/utils"
import { getActiveDeals, getCategories, type DealData, type CategoryRef } from "@/lib/api"
import { BrandProductCard, type BrandProductCardItem } from "@/components/products/BrandProductCard"
import { Pagination } from "@/components/products/Pagination"

const PAGE_SIZE = 24
const DISCOUNT_TIERS = [10, 25, 50, 70] as const

function dealToCardItem(deal: DealData): BrandProductCardItem | null {
  if (!deal.productId) return null
  const price = deal.dealPriceCents != null ? deal.dealPriceCents / 100 : null
  const original =
    deal.originalPriceCents != null ? deal.originalPriceCents / 100 : null
  if (price == null) return null
  return {
    productId: deal.productId,
    storeId: deal.storeId,
    storeName: deal.storeName,
    title: deal.productTitle || deal.title,
    slug: deal.productSlug,
    imageUrl: deal.productImageUrl,
    price,
    originalPrice: original,
    discountPercent: deal.discountPercent ?? null,
    inStock: true,
    endsAt: deal.endAt,
  }
}

export default function DealsPageClient() {
  const [deals, setDeals] = useState<DealData[]>([])
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [loading, setLoading] = useState(true)

  // Client-side filter state — backend has no deal-faceting endpoint yet.
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<Set<string>>(new Set())
  const [discountMin, setDiscountMin] = useState<number | null>(null)
  const [ratingMin, setRatingMin] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [dRes, cRes] = await Promise.allSettled([getActiveDeals(), getCategories()])
      if (cancelled) return
      if (dRes.status === "fulfilled") setDeals(dRes.value)
      if (cRes.status === "fulfilled") {
        setCategories(cRes.value.filter((c) => !c.parentId && c.slug !== "services"))
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (discountMin != null && (d.discountPercent ?? 0) < discountMin) return false
      // Rating filter requires a join to product data that DealData doesn't
      // currently carry; honoured as a no-op until backend exposes it. Kept
      // here so the UI control behaves as expected when data arrives.
      if (ratingMin != null) {
        // no-op; left intentionally — see comment above.
      }
      if (selectedCategorySlugs.size > 0) {
        // DealData has no category — fall back to "match all" to avoid hiding
        // every deal. When backend adds product.categories[] to DealData, swap
        // this for an Array.some() check.
        return true
      }
      return true
    })
  }, [deals, discountMin, ratingMin, selectedCategorySlugs])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const startIdx = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endIdx = Math.min(page * PAGE_SIZE, total)

  function toggleCategory(slug: string) {
    setSelectedCategorySlugs((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
    setPage(1)
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Deals</span>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar — mockup lines 163-242 */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-24 space-y-8">
          <section>
            <h3 className="text-xl font-bold text-foreground mb-3">Department</h3>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedCategorySlugs.size === 0}
                  onChange={() => { setSelectedCategorySlugs(new Set()); setPage(1) }}
                  className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold accent-brand-gold"
                />
                <span className="text-foreground group-hover:text-brand-gold-hover transition-colors">
                  All Deals
                </span>
              </label>
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedCategorySlugs.has(c.slug)}
                    onChange={() => toggleCategory(c.slug)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold accent-brand-gold"
                  />
                  <span className="text-foreground group-hover:text-brand-gold-hover transition-colors">
                    {c.name}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold text-foreground mb-3">Discount</h3>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="discount"
                  checked={discountMin == null}
                  onChange={() => { setDiscountMin(null); setPage(1) }}
                  className="h-4 w-4 border-gray-300 text-brand-gold focus:ring-brand-gold accent-brand-gold"
                />
                <span className="text-foreground group-hover:text-brand-gold-hover transition-colors">
                  Any
                </span>
              </label>
              {DISCOUNT_TIERS.map((tier) => (
                <label key={tier} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="discount"
                    checked={discountMin === tier}
                    onChange={() => { setDiscountMin(tier); setPage(1) }}
                    className="h-4 w-4 border-gray-300 text-brand-gold focus:ring-brand-gold accent-brand-gold"
                  />
                  <span className="text-foreground group-hover:text-brand-gold-hover transition-colors">
                    {tier}% Off or more
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold text-foreground mb-3">Customer Rating</h3>
            <div className="flex flex-col gap-2 text-sm">
              {[4, 3].map((stars) => (
                <label key={stars} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="rating"
                    checked={ratingMin === stars}
                    onChange={() => { setRatingMin(stars); setPage(1) }}
                    className="h-4 w-4 border-gray-300 text-brand-gold focus:ring-brand-gold accent-brand-gold"
                  />
                  <span className="flex items-center">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-4 w-4",
                          i < stars ? "fill-brand-gold text-brand-gold" : "fill-gray-200 text-gray-200",
                        )}
                      />
                    ))}
                  </span>
                  <span className="text-foreground group-hover:text-brand-gold-hover transition-colors">
                    &amp; Up
                  </span>
                </label>
              ))}
            </div>
          </section>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Header & view toggle — mockup lines 246-260 */}
          <div className="flex justify-between items-end mb-6 pb-4 border-b border-gray-200">
            <div>
              <h1 className="text-3xl font-bold text-brand-gold">Today&apos;s Deals</h1>
              <p className="text-sm text-gray-500 mt-1">
                {loading
                  ? "Finding the best deals…"
                  : total === 0
                    ? "No deals match your filters"
                    : `Showing ${startIdx}-${endIdx} of ${total} ${total === 1 ? "deal" : "deals"}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 mr-1 hidden sm:inline">
                View:
              </span>
              <div className="flex items-center rounded-lg bg-gray-100 p-1">
                <button
                  aria-label="Grid view"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "rounded p-1.5 transition-colors",
                    viewMode === "grid"
                      ? "bg-brand-gold text-brand-gold-foreground shadow-sm"
                      : "text-gray-500 hover:text-foreground",
                  )}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  aria-label="List view"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "rounded p-1.5 transition-colors",
                    viewMode === "list"
                      ? "bg-brand-gold text-brand-gold-foreground shadow-sm"
                      : "text-gray-500 hover:text-foreground",
                  )}
                >
                  <LayoutList className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* States */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-foreground" />
              <p className="text-sm">Loading deals…</p>
            </div>
          ) : total === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="rounded-2xl bg-gray-50 p-6 mb-5">
                <Tag className="h-10 w-10 text-gray-300" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">No deals right now</h2>
              <p className="max-w-md text-gray-500 text-sm">
                Check back daily — new deals drop every morning.
              </p>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                    : "flex flex-col gap-4",
                )}
              >
                {pageItems.map((deal) => {
                  const card = dealToCardItem(deal)
                  if (!card) return null
                  return <BrandProductCard key={deal.id} item={card} />
                })}
              </div>

              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => {
                  setPage(p)
                  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
                }}
              />
            </>
          )}
        </div>
      </div>
    </main>
  )
}
