"use client"

import { useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Star,
  MessageCircle,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BarChart3,
  Reply,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getSellerProducts,
  getReviewsByProducts,
  replyToReview,
  type ProductReviewsResponse,
  type Review,
  type Product,
} from "@/lib/api"

const PAGE_SIZE = 10

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={
            i < Math.round(rating)
              ? "fill-primary text-primary"
              : "fill-transparent text-muted-foreground/40"
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

export default function SellerReviewsPage() {
  const { status } = useSession()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState("")

  const productsQuery = useQuery<{ content: Product[] }>({
    queryKey: ["seller", "products", "for-reviews"],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      return getSellerProducts(token)
    },
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
  })

  const products = productsQuery.data?.content ?? []
  const productIds = useMemo(() => products.map((p) => p.id), [products])
  const productMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of products) m.set(p.id, p.title)
    return m
  }, [products])

  const reviewsQuery = useQuery<ProductReviewsResponse>({
    queryKey: ["seller", "reviews", productIds, page],
    queryFn: () => getReviewsByProducts(productIds, page, PAGE_SIZE),
    enabled: productIds.length > 0,
  })

  const replyMutation = useMutation({
    mutationFn: async ({ reviewId, reply }: { reviewId: string; reply: string }) => {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      return replyToReview(token, reviewId, reply)
    },
    onSuccess: (updated) => {
      toast.success("Reply posted")
      queryClient.setQueryData<ProductReviewsResponse | undefined>(
        ["seller", "reviews", productIds, page],
        (old) =>
          old
            ? { ...old, reviews: old.reviews.map((r) => (r.id === updated.id ? updated : r)) }
            : old,
      )
      setReplyingTo(null)
      setReplyDraft("")
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to post reply"
      toast.error(msg)
    },
  })

  const reviews: Review[] = reviewsQuery.data?.reviews ?? []
  const totalReviews = reviewsQuery.data?.total ?? 0
  const avgRating = reviewsQuery.data?.avg_rating ?? 0
  const distribution = reviewsQuery.data?.distribution ?? {}
  const totalPages = Math.max(1, Math.ceil(totalReviews / PAGE_SIZE))

  const distributionEntries = useMemo(() => {
    const entries: { star: number; count: number; pct: number }[] = []
    for (let s = 5; s >= 1; s--) {
      const count = distribution[String(s)] ?? 0
      entries.push({ star: s, count, pct: totalReviews > 0 ? (count / totalReviews) * 100 : 0 })
    }
    return entries
  }, [distribution, totalReviews])

  const loading = productsQuery.isLoading || reviewsQuery.isLoading

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  function startReply(review: Review) {
    setReplyingTo(review.id)
    setReplyDraft(review.seller_reply ?? "")
  }

  function cancelReply() {
    setReplyingTo(null)
    setReplyDraft("")
  }

  function submitReply(reviewId: string) {
    const trimmed = replyDraft.trim()
    if (!trimmed) {
      toast.error("Reply cannot be empty")
      return
    }
    replyMutation.mutate({ reviewId, reply: trimmed })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reviews from customers on your products. Reply to engage with shoppers — your reply is shown publicly under the review.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Star size={16} />
            Average Rating
          </div>
          <div className="mt-3 flex items-end gap-3">
            <span className="text-4xl font-bold text-foreground">
              {avgRating > 0 ? avgRating.toFixed(1) : "—"}
            </span>
            {avgRating > 0 && <Stars rating={avgRating} size={18} />}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <MessageCircle size={16} />
            Total Reviews
          </div>
          <p className="mt-3 text-4xl font-bold text-foreground">
            {totalReviews.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BarChart3 size={16} />
            Distribution
          </div>
          <div className="mt-3 space-y-1.5">
            {distributionEntries.map((d) => (
              <div key={d.star} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right text-muted-foreground">{d.star}</span>
                <Star size={10} className="fill-primary text-primary shrink-0" />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
                <span className="w-8 text-right tabular-nums text-muted-foreground">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No reviews yet. Reviews from your customers will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {reviews.map((r) => {
              const product = productMap.get(r.product_id) ?? "Unknown Product"
              const isReplying = replyingTo === r.id
              return (
                <li key={r.id} className="px-5 py-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{product}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Stars rating={r.rating} size={14} />
                        <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                        {r.verified_purchase && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-medium text-secondary">
                            <BadgeCheck size={12} />
                            Verified
                          </span>
                        )}
                      </div>
                    </div>
                    {!isReplying && (
                      <button
                        type="button"
                        onClick={() => startReply(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <Reply size={14} />
                        {r.seller_reply ? "Edit reply" : "Reply"}
                      </button>
                    )}
                  </div>

                  {r.title && <p className="text-sm font-medium text-foreground">{r.title}</p>}
                  {r.body && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>
                  )}

                  {r.seller_reply && !isReplying && (
                    <div className="rounded-xl border border-border bg-primary/5 p-3">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <Reply size={12} />
                        Your reply{r.seller_reply_at ? ` · ${formatDate(r.seller_reply_at)}` : ""}
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{r.seller_reply}</p>
                    </div>
                  )}

                  {isReplying && (
                    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                      <textarea
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Write a public response that helps future shoppers…"
                        className="block h-24 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        maxLength={2000}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {replyDraft.length}/2000 · public reply
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={cancelReply}
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            disabled={replyMutation.isPending}
                          >
                            <X size={14} />
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => submitReply(r.id)}
                            disabled={replyMutation.isPending || !replyDraft.trim()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            {replyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Reply size={14} />}
                            Post reply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} &middot; {totalReviews} review{totalReviews !== 1 && "s"}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors disabled:pointer-events-none disabled:opacity-40"
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
