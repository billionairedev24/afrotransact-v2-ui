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
import {
  getActiveDeals,
  getCategories,
  getRatingAggregatesByProducts,
  type DealData,
  type CategoryRef,
} from "@/lib/api"
import { BrandProductCard, BrandProductRow, type BrandProductCardItem } from "@/components/products/BrandProductCard"
import { Pagination } from "@/components/products/Pagination"

const PAGE_SIZE = 24
const DISCOUNT_TIERS = [10, 25, 50, 70] as const

function dealToCardItem(deal: DealData): BrandProductCardItem | null {
  if (!deal.productId) return null
  if (deal.enabled === false) return null
  if (deal.active === false) return null
  const now = new Date()
  if (deal.startAt && new Date(deal.startAt) > now) return null
  if (deal.endAt && new Date(deal.endAt) < now) return null

  const price = deal.dealPriceCents != null ? deal.dealPriceCents / 100 : null
  const original =
    deal.originalPriceCents != null ? deal.originalPriceCents / 100 : null
  if (price == null) return null

  const hasRealDiscount =
    (deal.discountPercent != null && deal.discountPercent > 0) ||
    (original != null && price < original)
  if (!hasRealDiscount) return null
  // Extra guard: if original price exists and "deal price" is >= original, skip
  if (original != null && price >= original) return null

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
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<Set<string>>(new Set())
  const [discountMin, setDiscountMin] = useState<number | null>(null)
  // Star threshold (>=). `null` means "any", which is the default Any-radio.
  const [ratingMin, setRatingMin] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [dRes, cRes] = await Promise.allSettled([getActiveDeals(), getCategories()])
        if (cancelled) return
        if (dRes.status === "fulfilled") setDeals(dRes.value)
        if (cRes.status === "fulfilled") {
          setCategories(cRes.value.filter((c) => !c.parentId && c.slug !== "services"))
        }
        // Fetch per-product rating aggregates so the Customer Rating filter
        // can actually narrow results. Failures are non-fatal: with no
        // ratings data, picking a star threshold simply hides all deals.
        if (dRes.status === "fulfilled") {
          const productIds = dRes.value
            .map((d) => d.productId)
            .filter((id): id is string => !!id)
          if (productIds.length > 0) {
            try {
              const aggs = await getRatingAggregatesByProducts(productIds)
              if (!cancelled) {
                setRatings(Object.fromEntries(aggs.map((a) => [a.productId, a.avgRating])))
              }
            } catch {
              // ignore — rating data isn't critical for the page to render.
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (discountMin != null && (d.discountPercent ?? 0) < discountMin) return false
      if (selectedCategorySlugs.size > 0) {
        const slugs = d.categorySlugs ?? []
        if (!slugs.some((s) => selectedCategorySlugs.has(s))) return false
      }
      if (ratingMin != null) {
        const r = d.productId ? ratings[d.productId] : undefined
        if (r == null || r < ratingMin) return false
      }
      return true
    })
  }, [deals, discountMin, selectedCategorySlugs, ratingMin, ratings])

  function toggleCategory(slug: string) {
    setSelectedCategorySlugs((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
    setPage(1)
  }

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const startIdx = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endIdx = Math.min(page * PAGE_SIZE, total)

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
              <FilterRow>
                <FilterRadioDot
                  checked={selectedCategorySlugs.size === 0}
                  onSelect={() => { setSelectedCategorySlugs(new Set()); setPage(1) }}
                  ariaLabel="All deals"
                />
                <span className="text-foreground">All Deals</span>
              </FilterRow>
              {categories.map((c) => (
                <FilterRow key={c.id}>
                  <FilterCheckboxDot
                    checked={selectedCategorySlugs.has(c.slug)}
                    onToggle={() => toggleCategory(c.slug)}
                    ariaLabel={c.name}
                  />
                  <span className="text-foreground">{c.name}</span>
                </FilterRow>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold text-foreground mb-3">Discount</h3>
            <div className="flex flex-col gap-2 text-sm">
              <FilterRow>
                <FilterRadioDot
                  checked={discountMin == null}
                  onSelect={() => { setDiscountMin(null); setPage(1) }}
                  ariaLabel="Any discount"
                />
                <span className="text-foreground">Any</span>
              </FilterRow>
              {DISCOUNT_TIERS.map((tier) => (
                <FilterRow key={tier}>
                  <FilterRadioDot
                    checked={discountMin === tier}
                    onSelect={() => { setDiscountMin(tier); setPage(1) }}
                    ariaLabel={`${tier}% off or more`}
                  />
                  <span className="text-foreground">{tier}% Off or more</span>
                </FilterRow>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold text-foreground mb-3">Customer Rating</h3>
            <div className="flex flex-col gap-2 text-sm">
              <FilterRow>
                <FilterRadioDot
                  checked={ratingMin == null}
                  onSelect={() => { setRatingMin(null); setPage(1) }}
                  ariaLabel="Any rating"
                />
                <span className="text-foreground">Any</span>
              </FilterRow>
              {[5, 4, 3, 2, 1].map((stars) => (
                <FilterRow key={stars}>
                  <FilterRadioDot
                    checked={ratingMin === stars}
                    onSelect={() => { setRatingMin(stars); setPage(1) }}
                    ariaLabel={`${stars} stars and up`}
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
                  <span className="text-foreground">&amp; Up</span>
                </FilterRow>
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
                  return viewMode === "list"
                    ? <BrandProductRow key={deal.id} item={card} />
                    : <BrandProductCard key={deal.id} item={card} />
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

/**
 * Sidebar filter row: only the input is clickable, the label text is just
 * read-only context. Avoids the `<label>`-wraps-input pattern so a stray
 * click on the text never toggles the filter — Amazon-style facet UX.
 */
function FilterRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>
}

/**
 * See note in /search page — native controlled radios were flaky.
 * Button + aria-checked has deterministic visual state.
 */
function FilterRadioDot({
  checked,
  onSelect,
  ariaLabel,
}: {
  checked: boolean
  onSelect: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onSelect}
      className={cn(
        "h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold",
        checked ? "border-brand-gold" : "border-gray-300 hover:border-gray-400",
      )}
    >
      {checked && <span className="h-2 w-2 rounded-full bg-brand-gold" />}
    </button>
  )
}

function FilterCheckboxDot({
  checked,
  onToggle,
  ariaLabel,
}: {
  checked: boolean
  onToggle: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onToggle}
      className={cn(
        "h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold",
        checked ? "bg-brand-gold border-brand-gold" : "border-gray-300 hover:border-gray-400",
      )}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-brand-gold-foreground" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M2 6 L5 9 L10 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
