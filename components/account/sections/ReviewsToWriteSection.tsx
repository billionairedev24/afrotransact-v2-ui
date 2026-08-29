"use client"

/**
 * ReviewsToWriteSection — surfaces delivered-but-unreviewed items from the
 * buyer's recent orders and lets them rate + submit a review inline, without
 * leaving the account hub.
 *
 * Frontend-only: reuses `getBuyerOrders` + `checkReviewEligibility` +
 * `createReview` from lib/api.ts. No new backend endpoint.
 *
 * Flow: fetch the first page of orders → collect items whose sub-order is in
 * the "delivered" status group → dedupe by productId → check eligibility for
 * each in parallel → render a card per eligible (purchased, not yet
 * reviewed) product with a 1-5 star picker and optional short text.
 */

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { getBuyerOrders, checkReviewEligibility, createReview } from "@/lib/api"
import { classifyStatus } from "@/components/orders/status"
import { logError } from "@/lib/errors"
import { Star, Loader2, CheckCircle2, ImageOff } from "lucide-react"
import { toast } from "sonner"

interface EligibleItem {
  productId: string
  productTitle: string
  imageUrl: string | null
  deliveredAt: string
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (hover || value) >= n
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded"
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                filled ? "fill-brand-gold text-brand-gold" : "text-muted-foreground"
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}

function ReviewCard({ item, onDone }: { item: EligibleItem; onDone: () => void }) {
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (rating < 1) {
      toast.error("Pick a star rating first")
      return
    }
    const token = await getAccessToken()
    if (!token) return
    setSubmitting(true)
    try {
      await createReview(token, {
        product_id: item.productId,
        rating,
        body: body.trim() || undefined,
      })
      toast.success("Thanks for your review!")
      onDone()
    } catch (e) {
      logError(e, "submitting review")
      toast.error("Couldn't submit your review — try again")
    } finally {
      setSubmitting(false)
    }
  }

  const deliveredLabel = item.deliveredAt
    ? new Date(item.deliveredAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null

  return (
    <li className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{item.productTitle}</p>
          {deliveredLabel && (
            <p className="mt-0.5 text-xs text-muted-foreground">Delivered {deliveredLabel}</p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share a few words about this product (optional)"
        rows={2}
        maxLength={1000}
        className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 transition"
      />

      <div className="mt-3 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting || rating < 1}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit review
        </button>
      </div>
    </li>
  )
}

export function ReviewsToWriteSection() {
  const { status } = useSession()
  const [items, setItems] = useState<EligibleItem[] | null>(null)

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setItems([])
      return
    }
    let cancelled = false
    ;(async () => {
      const token = await getAccessToken()
      if (!token) {
        if (!cancelled) setItems([])
        return
      }
      try {
        const page = await getBuyerOrders(token, 0, 20)
        const candidates = new Map<string, EligibleItem>()
        for (const order of page.content) {
          for (const subOrder of order.subOrders) {
            if (classifyStatus(subOrder.fulfillmentStatus) !== "delivered") continue
            // Only the real delivery signal — never the order/placed date. When
            // there's no delivery-proof timestamp the "Delivered …" line is
            // simply omitted rather than showing a fabricated date.
            const deliveredAt = subOrder.deliveryProofUploadedAt || ""
            for (const item of subOrder.items) {
              if (!item.productId || candidates.has(item.productId)) continue
              candidates.set(item.productId, {
                productId: item.productId,
                productTitle: item.productTitle || "Product",
                imageUrl: item.imageUrl,
                deliveredAt,
              })
            }
          }
        }

        const candidateList = Array.from(candidates.values())
        const eligibilityResults = await Promise.all(
          candidateList.map(async (c) => {
            try {
              const result = await checkReviewEligibility(token, c.productId)
              return result.eligible ? c : null
            } catch (e) {
              logError(e, "checking review eligibility")
              return null
            }
          }),
        )
        if (!cancelled) {
          setItems(eligibilityResults.filter((c): c is EligibleItem => c !== null))
        }
      } catch (e) {
        logError(e, "loading orders for reviews-to-write")
        if (!cancelled) setItems([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status])

  function handleDone(productId: string) {
    setItems((prev) => (prev ? prev.filter((i) => i.productId !== productId) : prev))
  }

  if (items === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16 gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground" />
        <h4 className="mt-4 text-sm font-semibold text-foreground">You&apos;re all caught up</h4>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
          Nothing to review right now — delivered items you haven&apos;t reviewed yet will show up here.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <ReviewCard key={item.productId} item={item} onDone={() => handleDone(item.productId)} />
      ))}
    </ul>
  )
}
