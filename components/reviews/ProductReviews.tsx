"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  Star,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BadgeCheck,
} from "lucide-react"
import {
  getProductReviews,
  createReview,
  checkReviewEligibility,
  type ProductReviewsResponse,
  type Review,
} from "@/lib/api"
import { getAccessToken } from "@/lib/auth-helpers"

interface Props {
  productId: string
}

/* ── tiny helpers ── */

function Stars({
  rating,
  size = 16,
  interactive,
  onSelect,
}: {
  rating: number
  size?: number
  interactive?: boolean
  onSelect?: (r: number) => void
}) {
  const [hover, setHover] = useState(0)

  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = interactive ? i <= (hover || rating) : i <= Math.round(rating)
        return (
          <Star
            key={i}
            size={size}
            className={`transition-colors ${
              filled ? "text-yellow-400 fill-yellow-400" : "text-gray-600"
            } ${interactive ? "cursor-pointer" : ""}`}
            onMouseEnter={interactive ? () => setHover(i) : undefined}
            onMouseLeave={interactive ? () => setHover(0) : undefined}
            onClick={interactive && onSelect ? () => onSelect(i) : undefined}
          />
        )
      })}
    </span>
  )
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/* ── main component ── */

export default function ProductReviews({ productId }: Props) {
  const { data: _session, status: authStatus } = useSession()
  const [data, setData] = useState<ProductReviewsResponse | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [eligibility, setEligibility] = useState<{ eligible: boolean; purchased: boolean; already_reviewed: boolean } | null>(null)
  const [eligibilityChecked, setEligibilityChecked] = useState(false)

  const pageSize = 10

  const fetchReviews = useCallback(
    async (p: number) => {
      setLoading(true)
      try {
        const res = await getProductReviews(productId, p, pageSize)
        setData(res)
      } catch {
        toast.error("Failed to load reviews")
      } finally {
        setLoading(false)
      }
    },
    [productId],
  )

  useEffect(() => {
    fetchReviews(page)
  }, [fetchReviews, page])

  useEffect(() => {
    if (authStatus !== "authenticated") return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const res = await checkReviewEligibility(token, productId)
        if (!cancelled) {
          setEligibility(res)
          setEligibilityChecked(true)
        }
      } catch {
        if (!cancelled) setEligibilityChecked(true)
      }
    })()
    return () => { cancelled = true }
  }, [authStatus, productId])

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0
  const canReview = eligibility?.eligible === true

  return (
    <section className="w-full space-y-8">
      {/* ── heading ── */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <MessageCircle size={22} />
          Customer Reviews
        </h2>

        {authStatus === "authenticated" && eligibilityChecked && eligibility?.already_reviewed && (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400">
            <BadgeCheck size={16} /> You reviewed this product
          </span>
        )}
      </div>

      {authStatus === "authenticated" && eligibilityChecked && canReview && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-xl border border-primary/20 bg-primary/5 px-5 py-3.5 flex items-center gap-3 hover:bg-primary/10 transition-colors text-left"
        >
          <Star size={18} className="text-primary shrink-0" />
          <span className="text-sm font-medium text-gray-900">Write a review for this product</span>
        </button>
      )}

      {showForm && (
        <ReviewForm
          productId={productId}
          onSuccess={() => {
            setShowForm(false)
            fetchReviews(1)
            setPage(1)
          }}
        />
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : data ? (
        <>
          {/* ── summary ── */}
          <ReviewSummary data={data} />

          {/* ── review list ── */}
          {data.reviews.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              No reviews yet. Be the first to share your thoughts!
            </p>
          ) : (
            <div className="space-y-4">
              {data.reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}

          {/* ── pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-30"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}

/* ── summary ── */

function ReviewSummary({ data }: { data: ProductReviewsResponse }) {
  const dist = data.distribution
  const total = data.review_count || 1

  return (
    <div
      className="grid gap-8 rounded-2xl border border-gray-200 bg-white p-6 sm:grid-cols-[auto_1fr]"
    >
      {/* left: big rating */}
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <span className="text-5xl font-bold text-gray-900">
          {data.avg_rating.toFixed(1)}
        </span>
        <Stars rating={data.avg_rating} size={22} />
        <span className="text-sm text-gray-500">
          {data.review_count} {data.review_count === 1 ? "review" : "reviews"}
        </span>
      </div>

      {/* right: distribution */}
      <div className="flex flex-col justify-center gap-2">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = dist[String(star)] ?? 0
          const pct = total > 0 ? (count / total) * 100 : 0
          return (
            <div key={star} className="flex items-center gap-3">
              <span className="w-12 text-right text-sm text-gray-600">
                {star} star
              </span>
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-yellow-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs text-gray-500">
                {Math.round(pct)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── single review card ── */

function ReviewCard({ review }: { review: Review }) {
  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white p-5"
    >
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <Stars rating={review.rating} size={16} />
        {review.verified_purchase && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            <BadgeCheck size={13} /> Verified Purchase
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {timeAgo(review.created_at)}
        </span>
      </div>

      {review.title && (
        <h4 className="mb-1 text-sm font-semibold text-gray-900">{review.title}</h4>
      )}

      {review.body && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
          {review.body}
        </p>
      )}
    </div>
  )
}

/* ── write review form ── */

function ReviewForm({
  productId,
  onSuccess,
}: {
  productId: string
  onSuccess: () => void
}) {
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) {
      toast.error("Please select a star rating")
      return
    }

    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error("Session expired — please sign in again")
        return
      }
      await createReview(token, {
        product_id: productId,
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      })
      toast.success("Review submitted!")
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes("403") || msg.includes("purchased")) {
        toast.error("You can only review products you have purchased")
      } else if (msg.includes("409") || msg.includes("already")) {
        toast.error("You have already reviewed this product")
      } else {
        toast.error("Could not submit review — please try again")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-600">
          Your Rating
        </label>
        <Stars rating={rating} size={28} interactive onSelect={setRating} />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-600">
          Title <span className="text-gray-400">(optional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Summarize your experience"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-primary"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-600">
          Review <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Share more details about your experience…"
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-primary"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Submit Review
        </button>
      </div>
    </form>
  )
}
