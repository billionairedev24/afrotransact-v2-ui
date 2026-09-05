"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Loader2, Star, X } from "lucide-react"
import { toast } from "sonner"

import { getAccessToken } from "@/lib/auth-helpers"
import { createReview, checkReviewEligibility, type OrderDto, type OrderItemDto } from "@/lib/api"

type ItemState = "checking" | "eligible" | "reviewed" | "ineligible"

/**
 * Write-a-review modal launched from the orders list / order detail. An order
 * can hold several products, so it lists every purchased item, checks each
 * one's review eligibility, and lets the buyer rate the eligible ones inline —
 * without ever navigating away (the old flow was a link to the order page that
 * frequently opened no form at all).
 */
export function WriteReviewModal({
  order, onClose, onReviewed,
}: {
  order: OrderDto
  onClose: () => void
  onReviewed?: (productId: string) => void
}) {
  // One row per distinct product in the order (dedupe repeated variants).
  const items = useMemo(() => {
    const seen = new Set<string>()
    const out: OrderItemDto[] = []
    for (const so of order.subOrders) {
      for (const it of so.items) {
        if (!it.productId || seen.has(it.productId)) continue
        seen.add(it.productId)
        out.push(it)
      }
    }
    return out
  }, [order])

  const [states, setStates] = useState<Record<string, ItemState>>({})
  const [openFor, setOpenFor] = useState<string | null>(null)

  // Resolve each product's eligibility on open so we can show "already
  // reviewed" / "not eligible" instead of failing on submit.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getAccessToken()
      if (!token) return
      const initial: Record<string, ItemState> = {}
      items.forEach((it) => { if (it.productId) initial[it.productId] = "checking" })
      if (!cancelled) setStates(initial)
      await Promise.all(items.map(async (it) => {
        if (!it.productId) return
        try {
          const e = await checkReviewEligibility(token, it.productId)
          if (cancelled) return
          setStates((prev) => ({
            ...prev,
            [it.productId!]: e.already_reviewed ? "reviewed" : e.eligible ? "eligible" : "ineligible",
          }))
        } catch {
          if (!cancelled) setStates((prev) => ({ ...prev, [it.productId!]: "ineligible" }))
        }
      }))
      // Auto-open the form when exactly one item is reviewable — the common case.
      if (!cancelled) {
        setStates((prev) => {
          const eligible = items.filter((it) => it.productId && prev[it.productId] === "eligible")
          if (eligible.length === 1) setOpenFor(eligible[0].productId!)
          return prev
        })
      }
    })()
    return () => { cancelled = true }
  }, [items])

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">Write a review</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Order <code className="font-mono">{order.orderNumber}</code> · rate what you bought
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-3 overflow-y-auto px-6 py-5">
          {items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              These items can&apos;t be reviewed.
            </p>
          )}
          {items.map((it) => {
            const st = it.productId ? states[it.productId] : "ineligible"
            return (
              <div key={it.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.imageUrl || "/placeholder.svg"}
                    alt={it.productTitle ?? "Item"}
                    className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{it.productTitle ?? "Item"}</p>
                    {it.variantName && <p className="truncate text-xs text-muted-foreground">{it.variantName}</p>}
                  </div>
                  <ItemAction
                    state={st}
                    open={openFor === it.productId}
                    onWrite={() => setOpenFor(it.productId!)}
                  />
                </div>
                {openFor === it.productId && st === "eligible" && it.productId && (
                  <ReviewForm
                    productId={it.productId}
                    productTitle={it.productTitle ?? "this item"}
                    onCancel={() => setOpenFor(null)}
                    onDone={() => {
                      setStates((prev) => ({ ...prev, [it.productId!]: "reviewed" }))
                      setOpenFor(null)
                      onReviewed?.(it.productId!)
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ItemAction({ state, open, onWrite }: { state?: ItemState; open: boolean; onWrite: () => void }) {
  if (state === "checking") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  if (state === "reviewed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" /> Reviewed
      </span>
    )
  }
  if (state === "eligible" && !open) {
    return (
      <button
        type="button"
        onClick={onWrite}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95"
      >
        <Star className="h-3.5 w-3.5" /> Write review
      </button>
    )
  }
  if (state === "ineligible") {
    return <span className="text-[11px] text-muted-foreground">Not eligible</span>
  }
  return null
}

function ReviewForm({
  productId, productTitle, onCancel, onDone,
}: {
  productId: string
  productTitle: string
  onCancel: () => void
  onDone: () => void
}) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (rating === 0) { toast.error("Please select a star rating"); return }
    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) { toast.error("Session expired — please sign in again"); return }
      await createReview(token, {
        product_id: productId,
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      })
      toast.success("Thanks for your review!")
      onDone()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes("409") || msg.includes("already")) {
        toast.error("You've already reviewed this product")
        onDone()
      } else if (msg.includes("403") || msg.includes("purchased")) {
        toast.error("You can only review products you've purchased")
      } else {
        toast.error("Could not submit review")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-3">
      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">
          Rate <span className="font-semibold text-foreground">{productTitle}</span>
        </p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              className="p-0.5"
            >
              <Star
                className={`h-6 w-6 transition-colors ${
                  n <= (hover || rating) ? "fill-brand-gold text-brand-gold" : "fill-muted text-muted-foreground/40"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder="Headline (optional)"
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="What did you like or dislike? (optional)"
        className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-4 py-1.5 text-xs font-bold text-brand-gold-foreground hover:bg-brand-gold-hover disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
          Submit review
        </button>
      </div>
    </div>
  )
}
