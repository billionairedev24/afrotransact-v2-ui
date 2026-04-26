"use client"

import { useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getAdminReviews,
  getAdminReviewAnalyticsExtended,
  type AdminReviewAnalyticsExtended,
  type ProductReviewsResponse,
  type Review,
} from "@/lib/api"
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
  Reply,
  TrendingUp,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Sheet, SheetHeader, SheetBody } from "@/components/ui/Sheet"
import { useStoreNameMap } from "@/hooks/use-stores"
import { useProductLookup, useUserLookup } from "@/hooks/use-name-lookups"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`${cls} ${i < rating ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
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
    <div className="rounded-2xl border border-border p-5 bg-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function DistributionChart({ distribution }: { distribution: Record<string, number> }) {
  const data = [5, 4, 3, 2, 1].map((star) => ({
    star: `${star}★`,
    count: distribution[String(star)] ?? 0,
  }))
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Star Distribution
        </p>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="star" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function TrendChart({ trend }: { trend: AdminReviewAnalyticsExtended["trend"] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Reviews — last 12 weeks
        </p>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: string) => {
                const d = new Date(v)
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }}
            />
            <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              labelFormatter={(label) => {
                const v = typeof label === "string" ? label : ""
                return v ? new Date(v).toLocaleDateString() : ""
              }}
              contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
            />
            <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function TopList({
  title,
  rows,
  nameFor,
  emptyHint,
}: {
  title: string
  rows: { id: string; reviewCount: number; avgRating: number }[]
  nameFor: (id: string) => string
  emptyHint: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{nameFor(r.id)}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <Stars rating={Math.round(r.avgRating)} />
                  <span className="text-xs text-muted-foreground">{r.avgRating.toFixed(2)}</span>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {r.reviewCount}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const PAGE_SIZE = 50

export default function AdminReviewsPage() {
  const { status: sessionStatus } = useSession()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Review | null>(null)

  const reviewsQuery = useQuery<ProductReviewsResponse>({
    queryKey: ["admin", "reviews", "list", page],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      return getAdminReviews(token, page, PAGE_SIZE)
    },
    enabled: sessionStatus === "authenticated",
  })

  const analyticsQuery = useQuery<AdminReviewAnalyticsExtended>({
    queryKey: ["admin", "reviews", "analytics"],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      return getAdminReviewAnalyticsExtended(token)
    },
    enabled: sessionStatus === "authenticated",
    staleTime: 60 * 1000,
  })

  const reviews = reviewsQuery.data?.reviews ?? []
  const total = reviewsQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const analytics = analyticsQuery.data ?? null

  const productIdsOnPage = useMemo(() => reviews.map((r) => r.product_id), [reviews])
  const userIdsOnPage = useMemo(() => reviews.map((r) => r.user_id), [reviews])
  const topProductIds = useMemo(() => analytics?.topProducts.map((p) => p.productId) ?? [], [analytics])
  const allProductIds = useMemo(() => [...productIdsOnPage, ...topProductIds], [productIdsOnPage, topProductIds])

  const { titleFor: productTitleFor, storeIdFor: productStoreIdFor } = useProductLookup(allProductIds)
  const { nameFor: userNameFor } = useUserLookup(userIdsOnPage)
  const { nameFor: storeNameFor } = useStoreNameMap()

  function storeNameForReview(r: Review): string {
    const id = r.store_id ?? productStoreIdFor(r.product_id)
    return storeNameFor(id)
  }

  if (sessionStatus !== "authenticated" && !reviewsQuery.isLoading) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Sign in as admin to view reviews.
      </div>
    )
  }

  const loading = reviewsQuery.isLoading

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Reviews</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Read-only view of every review across the marketplace, with aggregate insights to spot trends and outliers.
        </p>
      </div>

      {analytics && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Reviews" value={analytics.totalReviews.toLocaleString()} icon={MessageCircle} />
            <StatCard label="Average Rating" value={analytics.avgRating.toFixed(2)} sub="out of 5.00" icon={Star} />
            <StatCard
              label="Verified Rate"
              value={`${analytics.verifiedRate.toFixed(1)}%`}
              sub={`${analytics.verifiedReviews.toLocaleString()} verified`}
              icon={BadgeCheck}
            />
            <StatCard
              label="Last 30 Days"
              value={analytics.reviewsLast30Days.toLocaleString()}
              sub={`Reply rate ${analytics.replyRate.toFixed(1)}%`}
              icon={Users}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TrendChart trend={analytics.trend} />
            <DistributionChart distribution={analytics.distribution} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopList
              title="Top products by review count"
              rows={analytics.topProducts.map((p) => ({ id: p.productId, reviewCount: p.reviewCount, avgRating: p.avgRating }))}
              nameFor={(id) => productTitleFor(id)}
              emptyHint="No reviews yet"
            />
            <TopList
              title="Top stores by review count"
              rows={analytics.topStores.map((s) => ({ id: s.storeId, reviewCount: s.reviewCount, avgRating: s.avgRating }))}
              nameFor={(id) => storeNameFor(id)}
              emptyHint="No store-tagged reviews yet"
            />
          </div>
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border p-16 bg-card">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading reviews…</span>
        </div>
      )}

      {!loading && (
        <div className="rounded-2xl border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Reviewer</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3 min-w-[200px]">Title</th>
                  <th className="px-4 py-3">Verified</th>
                  <th className="px-4 py-3">Reply</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {reviews.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="h-10 w-10 text-muted-foreground" />
                        <p className="text-muted-foreground">No reviews found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reviews.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className="border-b border-border last:border-b-0 cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 max-w-[220px] truncate text-foreground font-medium">
                        {productTitleFor(r.product_id)}
                      </td>
                      <td className="px-4 py-3 max-w-[180px] truncate text-foreground">
                        {storeNameForReview(r)}
                      </td>
                      <td className="px-4 py-3 max-w-[160px] truncate text-foreground">
                        {userNameFor(r.user_id)}
                      </td>
                      <td className="px-4 py-3">
                        <Stars rating={r.rating} />
                      </td>
                      <td className="px-4 py-3 text-foreground max-w-[200px] truncate">
                        {r.title || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.verified_purchase ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-medium text-secondary">
                            <BadgeCheck className="h-3 w-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.seller_reply ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-foreground">
                            <Reply className="h-3 w-3" />
                            Replied
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(r.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} &middot; {total.toLocaleString()} total reviews
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        <SheetHeader onClose={() => setSelected(null)}>Review details</SheetHeader>
        <SheetBody>
          {selected && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Product</p>
                    <p className="mt-1 text-sm font-semibold text-foreground break-words">
                      {productTitleFor(selected.product_id)}
                    </p>
                  </div>
                  <Stars rating={selected.rating} size="md" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Store</p>
                    <p className="text-foreground break-words">{storeNameForReview(selected)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reviewer</p>
                    <p className="text-foreground break-words">{userNameFor(selected.user_id)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Verified</p>
                    <p className="text-foreground">{selected.verified_purchase ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Posted</p>
                    <p className="text-foreground">{formatDateTime(selected.created_at)}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Title</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {selected.title || <span className="text-muted-foreground">—</span>}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Body</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {selected.body || <span className="text-muted-foreground">—</span>}
                </p>
              </div>

              {selected.seller_reply && (
                <div className="rounded-xl border border-border bg-primary/5 p-4">
                  <div className="flex items-center gap-2">
                    <Reply className="h-3.5 w-3.5 text-foreground" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Seller reply{selected.seller_reply_at ? ` · ${formatDate(selected.seller_reply_at)}` : ""}
                    </p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{selected.seller_reply}</p>
                </div>
              )}

              <div className="rounded-xl border border-border p-4 text-xs text-muted-foreground space-y-1">
                <p><span className="font-semibold text-foreground">Review ID:</span> <span className="font-mono break-all">{selected.id}</span></p>
                <p>This view is read-only — admins cannot edit or delete reviews. Sellers can reply from their dashboard.</p>
              </div>
            </div>
          )}
        </SheetBody>
      </Sheet>
    </div>
  )
}
