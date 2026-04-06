"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { getAdminReviews, type ProductReviewsResponse, type Review } from "@/lib/api"
import { toast } from "sonner"
import { logError } from "@/lib/errors"
import {
  Star,
  MessageCircle,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BarChart3,
  Users,
  Package,
} from "lucide-react"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function truncateId(id: string, len = 8) {
  return id.length > len ? id.slice(0, len) + "…" : id
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600"
          }`}
        />
      ))}
    </span>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
}) {
  return (
    <div
      className="rounded-2xl border border-gray-200 p-5 bg-white"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
          {label}
        </p>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function DistributionBar({
  distribution,
  total,
}: {
  distribution: Record<string, number>
  total: number
}) {
  const bars = [5, 4, 3, 2, 1].map((star) => {
    const count = distribution[String(star)] ?? 0
    const pct = total > 0 ? (count / total) * 100 : 0
    return { star, count, pct }
  })

  return (
    <div
      className="rounded-2xl border border-gray-200 p-5 space-y-2.5 bg-white"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50">
          <BarChart3 className="h-4.5 w-4.5 text-gray-400" />
        </div>
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Star Distribution
        </p>
      </div>
      {bars.map(({ star, count, pct }) => (
        <div key={star} className="flex items-center gap-3">
          <span className="w-14 text-xs text-gray-500 flex items-center gap-1 shrink-0">
            {star}
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          </span>
          <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-yellow-400/80 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-16 text-right text-xs text-gray-500 shrink-0">
            {count} ({pct.toFixed(0)}%)
          </span>
        </div>
      ))}
    </div>
  )
}

export default function AdminReviewsPage() {
  const { status: sessionStatus } = useSession()
  const [data, setData] = useState<ProductReviewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 50

  const loadReviews = useCallback(async (p: number) => {
    try {
      setLoading(true)
      const token = await getAccessToken()
      if (!token) return
      const res = await getAdminReviews(token, p, pageSize)
      setData(res)
    } catch (e) {
      logError(e, "loading reviews")
      toast.error("Failed to load reviews")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === "authenticated") loadReviews(page)
    else setLoading(false)
  }, [sessionStatus, page, loadReviews])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1
  const reviews = data?.reviews ?? []
  const avgRating = data?.avg_rating ?? 0
  const totalReviews = data?.total ?? 0
  const distribution = data?.distribution ?? {}

  const fiveStarPct =
    totalReviews > 0
      ? (((distribution["5"] ?? 0) / totalReviews) * 100).toFixed(1)
      : "0.0"
  const oneStarPct =
    totalReviews > 0
      ? (((distribution["1"] ?? 0) / totalReviews) * 100).toFixed(1)
      : "0.0"

  if (sessionStatus !== "authenticated" && !loading) {
    return (
      <div className="py-20 text-center text-gray-500">
        Sign in as admin to view reviews.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Reviews</h1>
        <p className="text-sm text-gray-500 mt-1">
          All product reviews across the marketplace
        </p>
      </div>

      {/* Stats Row */}
      {!loading && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Reviews"
              value={totalReviews.toLocaleString()}
              icon={MessageCircle}
            />
            <StatCard
              label="Average Rating"
              value={avgRating.toFixed(2)}
              sub={`out of 5.00`}
              icon={Star}
            />
            <StatCard
              label="5-Star Reviews"
              value={`${fiveStarPct}%`}
              sub={`${distribution["5"] ?? 0} reviews`}
              icon={BadgeCheck}
            />
            <StatCard
              label="1-Star Reviews"
              value={`${oneStarPct}%`}
              sub={`${distribution["1"] ?? 0} reviews`}
              icon={Users}
            />
          </div>

          <DistributionBar distribution={distribution} total={totalReviews} />
        </>
      )}

      {/* Loading */}
      {loading && (
        <div
          className="flex items-center justify-center gap-3 rounded-2xl border border-gray-200 p-16 bg-white"
        >
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          <span className="text-sm text-gray-500">Loading reviews…</span>
        </div>
      )}

      {/* Reviews Table */}
      {!loading && (
        <div
          className="rounded-2xl border border-gray-200 overflow-hidden bg-white"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  style={{ borderBottom: "1px solid #e5e7eb" }}
                >
                  <th className="px-4 py-3">Review ID</th>
                  <th className="px-4 py-3">Product ID</th>
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3 min-w-[200px]">Body</th>
                  <th className="px-4 py-3">Verified</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {reviews.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="h-10 w-10 text-gray-600" />
                        <p className="text-gray-500">No reviews found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reviews.map((r: Review) => (
                    <tr
                      key={r.id}
                      className="transition-colors hover:bg-gray-50"
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {truncateId(r.id)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {truncateId(r.product_id)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {truncateId(r.user_id)}
                      </td>
                      <td className="px-4 py-3">
                        <Stars rating={r.rating} />
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium max-w-[180px] truncate">
                        {r.title || <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[240px] truncate">
                        {r.body || <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.verified_purchase ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
                            <BadgeCheck className="h-3 w-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(r.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: "1px solid #e5e7eb" }}
            >
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages} &middot; {totalReviews.toLocaleString()} total reviews
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
