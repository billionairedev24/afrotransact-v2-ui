"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  Star,
  MessageCircle,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BarChart3,
} from "lucide-react"
import { toast } from "sonner"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getSellerProducts,
  getReviewsByProducts,
  type ProductReviewsResponse,
  type Review,
  type Product,
} from "@/lib/api"

const PAGE_SIZE = 10
const EMPTY_DISTRIBUTION: Record<string, number> = {}

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={
            i < Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-white/20"
          }
        />
      ))}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function snippet(text: string | null, max = 120) {
  if (!text) return "—"
  return text.length > max ? text.slice(0, max) + "…" : text
}

export default function SellerReviewsPage() {
  const { status } = useSession()

  const [products, setProducts] = useState<Product[]>([])
  const [reviewData, setReviewData] = useState<ProductReviewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const productMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of products) map.set(p.id, p.title)
    return map
  }, [products])

  const fetchReviews = useCallback(
    async (productIds: string[], pageNum: number) => {
      if (productIds.length === 0) return
      try {
        const data = await getReviewsByProducts(productIds, pageNum, PAGE_SIZE)
        setReviewData(data)
      } catch {
        toast.error("Failed to load reviews")
      }
    },
    [],
  )

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setLoading(false)
      return
    }

    let cancelled = false

    async function init() {
      const token = await getAccessToken()
      if (!token || cancelled) return

      try {
        const res = await getSellerProducts(token)
        if (cancelled) return
        setProducts(res.content)

        const ids = res.content.map((p) => p.id)
        if (ids.length > 0) {
          const data = await getReviewsByProducts(ids, 1, PAGE_SIZE)
          if (!cancelled) setReviewData(data)
        }
      } catch {
        if (!cancelled) toast.error("Failed to load reviews")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [status])

  useEffect(() => {
    if (products.length === 0 || page === 1) return
    fetchReviews(
      products.map((p) => p.id),
      page,
    )
  }, [page, products, fetchReviews])

  const reviews: Review[] = reviewData?.reviews ?? []
  const totalReviews = reviewData?.total ?? 0
  const avgRating = reviewData?.avg_rating ?? 0
  const distribution = reviewData?.distribution ?? EMPTY_DISTRIBUTION
  const totalPages = Math.max(1, Math.ceil(totalReviews / PAGE_SIZE))

  const distributionEntries = useMemo(() => {
    const entries: { star: number; count: number; pct: number }[] = []
    for (let s = 5; s >= 1; s--) {
      const count = distribution[String(s)] ?? 0
      entries.push({ star: s, count, pct: totalReviews > 0 ? (count / totalReviews) * 100 : 0 })
    }
    return entries
  }, [distribution, totalReviews])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Reviews</h1>
        <p className="mt-1 text-sm text-gray-400">
          Reviews from customers on your products
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Average Rating */}
        <div className="rounded-2xl border border-white/10 bg-[hsl(0_0%_11%)] p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
            <Star size={16} />
            Average Rating
          </div>
          <div className="mt-3 flex items-end gap-3">
            <span className="text-4xl font-bold text-white">
              {avgRating > 0 ? avgRating.toFixed(1) : "—"}
            </span>
            {avgRating > 0 && <Stars rating={avgRating} size={18} />}
          </div>
        </div>

        {/* Total Reviews */}
        <div className="rounded-2xl border border-white/10 bg-[hsl(0_0%_11%)] p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
            <MessageCircle size={16} />
            Total Reviews
          </div>
          <p className="mt-3 text-4xl font-bold text-white">
            {totalReviews.toLocaleString()}
          </p>
        </div>

        {/* Star Distribution */}
        <div className="rounded-2xl border border-white/10 bg-[hsl(0_0%_11%)] p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
            <BarChart3 size={16} />
            Distribution
          </div>
          <div className="mt-3 space-y-1.5">
            {distributionEntries.map((d) => (
              <div key={d.star} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right text-gray-400">{d.star}</span>
                <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
                <span className="w-8 text-right tabular-nums text-gray-500">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[hsl(0_0%_11%)]">
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageCircle className="h-10 w-10 text-white/20" />
            <p className="mt-4 text-sm text-gray-400">
              No reviews yet. Reviews from your customers will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden border-b border-white/10 bg-white/[0.03] px-5 py-3 sm:grid sm:grid-cols-[1fr_100px_1fr_1.5fr_90px_80px] sm:gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Product
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Rating
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Title
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Review
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Date
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">
                Verified
              </span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/5">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_100px_1fr_1.5fr_90px_80px] sm:items-center sm:gap-4"
                >
                  {/* Product */}
                  <span className="truncate text-sm font-medium text-white">
                    {productMap.get(r.product_id) ?? "Unknown Product"}
                  </span>

                  {/* Stars */}
                  <div>
                    <Stars rating={r.rating} size={14} />
                  </div>

                  {/* Title */}
                  <span className="truncate text-sm text-gray-300">
                    {r.title || "—"}
                  </span>

                  {/* Body Snippet */}
                  <span className="text-sm text-gray-400 line-clamp-2">
                    {snippet(r.body)}
                  </span>

                  {/* Date */}
                  <span className="text-xs text-gray-500">
                    {formatDate(r.created_at)}
                  </span>

                  {/* Verified */}
                  <div className="flex justify-center">
                    {r.verified_purchase ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400">
                        <BadgeCheck size={12} />
                        Verified
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} &middot; {totalReviews} review{totalReviews !== 1 && "s"}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
