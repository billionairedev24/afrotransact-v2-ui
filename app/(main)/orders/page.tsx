"use client"

/**
 * Customer Orders — list view (Amazon-style).
 *
 * Layout:
 *   • Single-column stacked feed (full-width cards, not a bento grid)
 *   • Each card: gray header strip (Order placed | Total | Ship to · #order)
 *     with the body rendering each item as its own row (thumb + title +
 *     variant + qty + per-item actions). Matches the Your Orders UX buyers
 *     expect from Amazon.
 *   • Infinite scroll via IntersectionObserver — PAGE_SIZE rows per fetch,
 *     auto-loaded as the sentinel scrolls into view. No "Page X of Y"
 *     pagination, no "shows 4 even when there are more" labeling.
 *
 * Server filtering: backend currently owns text search (`q`) only. Tab
 * filtering still runs client-side over loaded rows; when the backend
 * adds status-group filtering we can pass the group key down.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  ShoppingBag,
  ChevronRight,
  ChevronLeft,
  ReceiptText,
  CalendarCheck2,
  Info,
  Search,
  AlertTriangle,
  Loader2,
  Star,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getBuyerOrders,
  createReview,
  reorderOrder,
  type OrderDto,
  type OrderItemDto,
} from "@/lib/api"
import { logError } from "@/lib/errors"
import { OrderCardSkeleton } from "@/components/ui/Skeleton"
import { useCartStore } from "@/stores/cart-store"

/* ──────────────────────── Status groupings ──────────────────────────── */

/* Tab groups align with the Order Details fulfillment stepper:
 *   Order Placed → Shipped → Out for Delivery → Delivered
 * Cancelled/Refunded statuses fall outside these groups — they still appear
 * under "All Orders" but don't get a dedicated tab. */
type StatusGroup = "all" | "placed" | "shipped" | "out_for_delivery" | "delivered"

const STATUS_GROUPS: Record<Exclude<StatusGroup, "all">, ReadonlySet<string>> = {
  placed:           new Set(["pending", "awaiting_payment", "paid", "confirmed", "processing", "packaged"]),
  shipped:          new Set(["dispatched", "shipped"]),
  out_for_delivery: new Set(["out_for_delivery"]),
  delivered:        new Set(["delivered", "completed"]),
}

function classifyStatus(status: string): Exclude<StatusGroup, "all"> | null {
  const s = status.toLowerCase()
  for (const [group, members] of Object.entries(STATUS_GROUPS)) {
    if (members.has(s)) return group as Exclude<StatusGroup, "all">
  }
  return null
}

/**
 * Status pill — surfaces the actual order status name, not a marketing
 * synonym. Tone is grouped (Pending = gray/amber, Confirmed = blue,
 * Shipped = gold, Delivered = green, Cancelled = red).
 */
function statusBadge(status: string) {
  const s = status.toLowerCase()
  // Cancelled / refunded show the raw label so buyers see exactly why the
  // order is in that state.
  if (s === "cancelled") {
    return { label: "Cancelled", Icon: XCircle, tone: "bg-red-50 text-red-700 border-red-200" }
  }
  if (s === "refunded") {
    return { label: "Refunded", Icon: XCircle, tone: "bg-red-50 text-red-700 border-red-200" }
  }
  if (s === "payment_failed") {
    return { label: "Payment failed", Icon: XCircle, tone: "bg-red-50 text-red-700 border-red-200" }
  }
  if (STATUS_GROUPS.placed.has(s)) {
    return { label: "Order Placed", Icon: Package, tone: "bg-amber-50 text-amber-800 border-amber-200" }
  }
  if (STATUS_GROUPS.shipped.has(s)) {
    return { label: "Shipped", Icon: Truck, tone: "bg-blue-50 text-blue-700 border-blue-200" }
  }
  if (STATUS_GROUPS.out_for_delivery.has(s)) {
    return { label: "Out for Delivery", Icon: Truck, tone: "bg-brand-gold/15 text-brand-gold-foreground border-brand-gold/30" }
  }
  if (STATUS_GROUPS.delivered.has(s)) {
    return { label: "Delivered", Icon: CheckCircle, tone: "bg-green-50 text-green-700 border-green-200" }
  }
  return { label: status, Icon: Clock, tone: "bg-gray-100 text-foreground border-gray-200" }
}

/* ──────────────────────── Formatters ────────────────────────────────── */

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/* ──────────────────────── Order Card ───────────────────────────────── */

function OrderCard({ order }: { order: OrderDto }) {
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const [buyingAgain, setBuyingAgain] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewItemId, setReviewItemId] = useState<string | null>(null)

  const badge = statusBadge(order.status)
  const allItems = order.subOrders.flatMap((so) => so.items)
  const firstItem = allItems[0]
  const firstSubOrder = order.subOrders[0]
  const placedDate = order.placedAt || order.createdAt
  const group = classifyStatus(order.status)

  // Helper text aligns with the new tab vocabulary (Order Placed / Shipped /
  // Out for Delivery / Delivered). Cancelled and refunded fall through here
  // since they don't have a dedicated tab but still need a label.
  const helper = (() => {
    if (group === "out_for_delivery") return { Icon: Truck, text: "Out for delivery today" }
    if (group === "shipped") return { Icon: CalendarCheck2, text: "On its way — track for the latest ETA" }
    if (group === "placed") return { Icon: Info, text: order.status === "pending" || order.status === "awaiting_payment" ? "Awaiting payment confirmation" : "Preparing for shipment" }
    if (group === "delivered") return { Icon: CheckCircle, text: "Delivered" }
    const s = order.status.toLowerCase()
    if (s === "cancelled") return { Icon: XCircle, text: "This order was cancelled" }
    if (s === "refunded") return { Icon: XCircle, text: "This order was refunded" }
    if (s === "payment_failed") return { Icon: XCircle, text: "Payment failed — please retry" }
    return null
  })()

  const detailsHref = `/orders/${order.orderNumber}`
  const trackingHref = `/orders/${order.orderNumber}#tracking`
  const reviewableItems = allItems.filter((i) => i.productId)
  void firstSubOrder

  // Client-side cart restore — used as the slow-path fallback for reorder
  // when the buyer has no default address (or the server returns fastPath=false).
  // Items missing productId are skipped (e.g. legacy soft-deleted entries).
  const restoreCartFromOrder = (): number => {
    useCartStore.getState().clearCart()
    let added = 0
    for (const so of order.subOrders) {
      for (const it of so.items) {
        if (!it.productId) continue
        addItem({
          productId: it.productId,
          variantId: it.variantId,
          storeId: so.storeId,
          storeName: so.storeId,
          title: it.productTitle || "Product",
          variantName: it.variantName || "Default",
          price: it.unitPriceCents,
          quantity: it.quantity,
          imageUrl: it.imageUrl ?? undefined,
          slug: it.slug ?? it.productId,
          weightKg: null,
          lengthIn: null,
          widthIn: null,
          heightIn: null,
        })
        added++
      }
    }
    return added
  }

  // 1-click reorder. Calls the backend reorder endpoint which:
  //   - replays the prior order's items into the server cart,
  //   - resolves the buyer's default shipping address,
  //   - runs checkout (session-mode or legacy fork).
  // On fastPath success the buyer is routed straight to the existing
  // payment-confirmation page; on fallback we restore the cart client-side
  // and drop the buyer onto /checkout so they can finish manually.
  const handleBuyAgain = async () => {
    if (buyingAgain) return
    setBuyingAgain(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error("Session expired — please sign in again")
        return
      }
      const idempotencyKey = `reorder-${order.orderNumber}-${Date.now()}`
      let res
      try {
        res = await reorderOrder(token, order.orderNumber, idempotencyKey)
      } catch (e) {
        logError(e, "1-click reorder")
        // Backend bounced (404, empty, region-disabled). Fall back to the
        // client-side cart restore + manual /checkout.
        const added = restoreCartFromOrder()
        if (added === 0) {
          toast.error("Couldn't reorder this — try Details instead")
          return
        }
        toast.message(`Added ${added} item${added === 1 ? "" : "s"} — finish on checkout`)
        router.push("/cart")
        return
      }

      if (res.skippedItemCount > 0) {
        toast.message(
          `Reorder ready (${res.skippedItemCount} item${res.skippedItemCount === 1 ? "" : "s"} no longer available)`,
        )
      }

      if (!res.fastPath) {
        // Cart is populated server-side, but the buyer needs to pick an
        // address / shipping option / coupon. Restore the client cart so
        // the /checkout page (which reads from Zustand) shows the items.
        restoreCartFromOrder()
        if (res.fallbackReason === "no_default_address") {
          toast.message("Pick a shipping address to continue.")
        }
        router.push("/checkout")
        return
      }

      // Fast path: backend ran checkout. Hand off to the existing payment
      // confirmation flow. Session-mode → Stripe Checkout return URL is
      // the only path the buyer needs to finish on. Legacy → drop on the
      // /checkout page; the cart is populated and CheckoutClient will
      // pick up the live PaymentIntent for the new pending order.
      restoreCartFromOrder()
      if (res.checkoutSessionId) {
        router.push(`/checkout/complete?session=${encodeURIComponent(res.checkoutSessionId)}`)
      } else {
        // Defensive fallback: if no session came back (e.g. defaults couldn't
        // be resolved), send the buyer to checkout with the cart repopulated.
        router.push("/checkout")
      }
    } finally {
      setBuyingAgain(false)
    }
  }

  const actions = (() => {
    // Contact Seller is hidden until messaging is built — POST-LAUNCH-BACKLOG #41.
    if (group === "shipped" || group === "out_for_delivery") {
      return (
        <>
          <Link href={detailsHref} className="border-action">Details</Link>
          <Link href={trackingHref} className="primary-action">Track Order</Link>
        </>
      )
    }
    if (group === "placed") {
      return <Link href={detailsHref} className="border-action">Details</Link>
    }
    if (group === "delivered") {
      const openReview = () => {
        setReviewItemId(reviewableItems[0]?.id ?? null)
        setReviewOpen(true)
      }
      return (
        <>
          <Link href={detailsHref} className="border-action">Details</Link>
          {reviewableItems.length > 0 && (
            <button type="button" onClick={openReview} className="border-action">
              Write Review
            </button>
          )}
          <button
            type="button"
            onClick={handleBuyAgain}
            disabled={buyingAgain}
            className="primary-action disabled:opacity-60"
          >
            {buyingAgain ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Adding…</> : "Buy Again"}
          </button>
        </>
      )
    }
    // Cancelled / refunded / payment_failed fall through to the default —
    // Details + Buy Again so the buyer can re-attempt the purchase.
    const s = order.status.toLowerCase()
    if (s === "cancelled" || s === "refunded" || s === "payment_failed") {
      return (
        <>
          <Link href={detailsHref} className="border-action">Details</Link>
          <button
            type="button"
            onClick={handleBuyAgain}
            disabled={buyingAgain}
            className="border-action disabled:opacity-60"
          >
            {buyingAgain ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Adding…</> : "Buy Again"}
          </button>
        </>
      )
    }
    return <Link href={detailsHref} className="border-action">Details</Link>
  })()

  const reviewItem = reviewableItems.find((i) => i.id === reviewItemId) ?? reviewableItems[0]

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* Compact gray header strip — Amazon-style.
          Order placed | Total | Ship to (left) · Order # + status (right). */}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <div>
            <p className="font-semibold uppercase tracking-wide text-[10px] text-gray-500">Order placed</p>
            <p className="text-gray-900">{formatDate(placedDate)}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide text-[10px] text-gray-500">Total</p>
            <p className="text-gray-900 font-semibold tabular-nums">{formatCents(order.totalCents, order.currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", badge.tone)}>
            <badge.Icon className="h-3 w-3" />
            {badge.label}
          </span>
          <span className="text-[11px] text-gray-600 font-mono">#{order.orderNumber}</span>
        </div>
      </header>

      {/* Body — one row per item (Amazon-style), with the order-level
          actions stacked on the right. For very long orders we collapse
          past the 4th item with a "Show all N items" toggle. */}
      <OrderBody
        items={allItems}
        helper={helper}
        actions={actions}
        detailsHref={detailsHref}
      />
      {order.subOrders.length > 1 && (
        <p className="border-t border-gray-100 bg-gray-50/60 px-4 py-2 text-[11px] text-gray-500">
          Shipped from {order.subOrders.length} stores
        </p>
      )}

      {reviewOpen && reviewItem?.productId && (
        <WriteReviewModal
          productId={reviewItem.productId}
          productTitle={reviewItem.productTitle ?? "Product"}
          imageUrl={reviewItem.imageUrl}
          allItems={reviewableItems}
          activeItemId={reviewItem.id}
          onPickItem={setReviewItemId}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </article>
  )
}

/* ──────────────────────── Order body (item rows) ─────────────────────
 * Renders each line item as a row inside the card — thumb + title +
 * variant + qty. The order-level action stack lives on the right of the
 * first row so the primary CTA stays above the fold. Orders with >4
 * items collapse to the first 4 with an expand toggle, mirroring
 * Amazon's threshold for long carts.
 */
const ITEMS_VISIBLE_BY_DEFAULT = 4

function OrderBody({
  items,
  helper,
  actions,
  detailsHref,
}: {
  items: OrderItemDto[]
  helper: { Icon: typeof Truck; text: string } | null
  actions: React.ReactNode
  detailsHref: string
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, ITEMS_VISIBLE_BY_DEFAULT)
  const hiddenCount = items.length - visible.length

  return (
    <div className="p-4 sm:p-5">
      {helper && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-gray-600">
          <helper.Icon className="h-3.5 w-3.5 text-brand-gold" />
          {helper.text}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 sm:gap-6">
        <ul className="flex flex-col divide-y divide-gray-100">
          {visible.map((it, idx) => (
            <li key={it.id ?? idx} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <Link
                href={it.slug ? `/product/${it.slug}` : detailsHref}
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100 sm:h-20 sm:w-20"
              >
                {it.imageUrl ? (
                  <Image
                    src={it.imageUrl}
                    alt={it.productTitle ?? "Item"}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-5 w-5 text-gray-300" />
                  </div>
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={it.slug ? `/product/${it.slug}` : detailsHref}
                  className="line-clamp-2 text-sm font-medium text-foreground hover:text-brand-gold leading-snug"
                >
                  {it.productTitle ?? "Item"}
                </Link>
                {it.variantName && (
                  <p className="mt-0.5 text-xs text-gray-500">{it.variantName}</p>
                )}
                <p className="mt-0.5 text-xs text-gray-500">
                  Qty {it.quantity}
                  {it.totalPriceCents != null && (
                    <span className="ml-2 tabular-nums">
                      {formatCents(it.totalPriceCents)}
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex shrink-0 flex-col gap-1.5 sm:w-40">
          {actions}
        </div>
      </div>
      {hiddenCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 text-xs font-semibold text-brand-gold hover:underline"
        >
          Show {hiddenCount} more {hiddenCount === 1 ? "item" : "items"}
        </button>
      )}
      {expanded && items.length > ITEMS_VISIBLE_BY_DEFAULT && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 text-xs font-semibold text-brand-gold hover:underline"
        >
          Show less
        </button>
      )}
    </div>
  )
}

/* ──────────────────────── Write Review modal ────────────────────────
 * Posts directly to POST /api/v1/reviews via `createReview`. No detour
 * through the product page. Multi-item orders get a small item picker
 * so the buyer can choose which product they're reviewing.
 */
function WriteReviewModal({
  productId,
  productTitle,
  imageUrl,
  allItems,
  activeItemId,
  onPickItem,
  onClose,
}: {
  productId: string
  productTitle: string
  imageUrl: string | null
  allItems: OrderItemDto[]
  activeItemId: string
  onPickItem: (id: string) => void
  onClose: () => void
}) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Reset form when the user switches to a different item in the picker.
  useEffect(() => {
    setRating(0); setHover(0); setTitle(""); setBody("")
  }, [productId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
      toast.success("Review submitted — thanks!")
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes("403") || msg.includes("purchased")) {
        toast.error("You can only review products you've purchased")
      } else if (msg.includes("409") || msg.includes("already")) {
        toast.error("You've already reviewed this product")
      } else {
        toast.error("Could not submit review — please try again")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-foreground">Write a review</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Item picker for multi-item orders */}
          {allItems.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Which item are you reviewing?
              </label>
              <select
                value={activeItemId}
                onChange={(e) => onPickItem(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
              >
                {allItems.map((it) => (
                  <option key={it.id} value={it.id}>{it.productTitle || "Product"}</option>
                ))}
              </select>
            </div>
          )}

          {/* Item summary */}
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="h-12 w-12 shrink-0 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Package className="h-5 w-5 text-gray-400" />
                </div>
              )}
            </div>
            <p className="text-sm font-medium text-foreground line-clamp-2">{productTitle}</p>
          </div>

          {/* Star rating */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Your rating</label>
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  className="p-0.5"
                >
                  <Star
                    className={cn(
                      "h-7 w-7 transition-colors",
                      (hover || rating) >= n ? "fill-brand-gold text-brand-gold" : "fill-gray-200 text-gray-200",
                    )}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-sm text-gray-500">{rating} / 5</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Title <span className="text-gray-400">(optional)</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Sums up your experience"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground placeholder:text-gray-400 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Details <span className="text-gray-400">(optional)</span></label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="What did you like or dislike? How would you describe the quality?"
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground placeholder:text-gray-400 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="px-5 py-2 rounded-lg bg-brand-gold text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : "Submit review"}
          </button>
        </div>
      </div>
    </div>
  )
}

function OrderThumb({ items }: { items: OrderDto["subOrders"][number]["items"] }) {
  if (items.length === 0) {
    return (
      <div className="h-24 w-24 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center">
        <Package className="h-6 w-6 text-gray-400" />
      </div>
    )
  }
  if (items.length === 1) {
    const item = items[0]
    return (
      <div className="h-24 w-24 shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.productTitle || "Product"}
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Package className="h-6 w-6 text-gray-400" />
          </div>
        )}
      </div>
    )
  }
  // 2x2 grid — first 3 items as thumbs, fourth cell shows "+N" overflow.
  const visible = items.slice(0, 3)
  const remaining = items.length - 3
  return (
    <div className="h-24 w-24 shrink-0 rounded-lg overflow-hidden grid grid-cols-2 grid-rows-2 gap-0.5 bg-gray-200">
      {visible.map((it) => (
        <div key={it.id} className="bg-white">
          {it.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gray-100 flex items-center justify-center">
              <Package className="h-3.5 w-3.5 text-gray-400" />
            </div>
          )}
        </div>
      ))}
      {remaining > 0 ? (
        <div className="bg-gray-50 flex items-center justify-center text-xs font-semibold text-foreground">
          +{remaining}
        </div>
      ) : (
        <div className="bg-white">
          {items[3]?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={items[3].imageUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
      )}
    </div>
  )
}

/* ──────────────────────── Page ───────────────────────────────────── */

// Amazon-style: ~10 orders per fetch, more loaded automatically as the
// sentinel scrolls into view.
const PAGE_SIZE = 10
const SEARCH_MIN_CHARS = 2
const SEARCH_DEBOUNCE_MS = 300

export default function OrdersPage() {
  const session = useSession()
  const status = session?.status
  const [orders, setOrders] = useState<OrderDto[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [appending, setAppending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [totalElements, setTotalElements] = useState(0)
  const [tab, setTab] = useState<StatusGroup>("all")
  const [search, setSearch] = useState("")
  // Debounced copy of `search` — the value we actually send to the server.
  // Keeping the input snappy (`search`) separate from the fetch trigger
  // (`debouncedSearch`) avoids a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Debounce keystrokes before firing the search request.
  useEffect(() => {
    const trimmed = search.trim()
    const next = trimmed.length >= SEARCH_MIN_CHARS ? trimmed : ""
    const t = setTimeout(() => setDebouncedSearch(next), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  const searchActive = debouncedSearch.length > 0

  // Reset the feed on a new search query.
  useEffect(() => {
    setPage(0)
    setOrders([])
    setHasMore(true)
  }, [debouncedSearch])

  // Fetch loop: appends to `orders` instead of replacing. First page also
  // sets the initial loading flag for the skeleton; subsequent pages use
  // the appending flag for the bottom spinner.
  useEffect(() => {
    if (status !== "authenticated") {
      setInitialLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        if (page === 0) setInitialLoading(true)
        else setAppending(true)
        setError(null)
        const token = await getAccessToken()
        if (!token || cancelled) return
        const res = await getBuyerOrders(token, page, PAGE_SIZE, debouncedSearch || undefined)
        if (cancelled) return
        const incoming = res.content ?? []
        setOrders((prev) => (page === 0 ? incoming : [...prev, ...incoming]))
        setTotalElements(res.totalElements ?? 0)
        // No more pages if either: server says we got fewer than asked for,
        // OR we've now loaded everything the server promised.
        const loadedAfter = (page === 0 ? 0 : orders.length) + incoming.length
        setHasMore(
          incoming.length === PAGE_SIZE && loadedAfter < (res.totalElements ?? Infinity),
        )
      } catch (e) {
        logError(e, "loading orders")
        if (!cancelled) setError("Failed to load orders")
      } finally {
        if (!cancelled) {
          setInitialLoading(false)
          setAppending(false)
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, debouncedSearch])

  // Infinite-scroll trigger: load next page when the sentinel enters
  // the viewport. Guards: not on the initial load, not already fetching,
  // and we actually expect more rows.
  useEffect(() => {
    if (!hasMore || initialLoading || appending) return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPage((p) => p + 1)
        }
      },
      { rootMargin: "400px 0px" }, // start fetching well before the user reaches it
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, initialLoading, appending, orders.length])

  // Tab is still applied client-side over the current page — the server only
  // owns the text filter. Buyers rarely use both at once.
  const visibleOrders = useMemo(() => {
    return orders.filter((o) => {
      if (tab !== "all") {
        const group = classifyStatus(o.status)
        if (group !== tab) return false
      }
      return true
    })
  }, [orders, tab])

  // Per-tab counts (over current page; cheap and informative).
  const tabCounts = useMemo(() => {
    const map: Record<StatusGroup, number> = { all: orders.length, placed: 0, shipped: 0, out_for_delivery: 0, delivered: 0 }
    for (const o of orders) {
      const g = classifyStatus(o.status)
      if (g) map[g]++
    }
    return map
  }, [orders])

  // Auth is gated by app/(main)/orders/layout.tsx server-side.

  // Total label is sourced from the server's totalElements (the true count
  // of orders the user has placed), independent of how many pages have
  // been loaded into the feed so far. This fixes the long-standing
  // "shows 4 even when more exist" bug.
  const totalLabel =
    totalElements > 0
      ? `${totalElements} order${totalElements === 1 ? "" : "s"}`
      : null

  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 sm:px-6 lg:px-8 py-8 md:py-10 flex flex-col gap-6">
      {/* Header — title + search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Your Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalLabel ? `${totalLabel} placed` : "Manage and track your recent purchases."}
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order ID or product…"
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-gray-400 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 shadow-sm"
          />
        </div>
      </div>

      {/* Tabs — order-1 lines 147-153 */}
      <nav className="flex overflow-x-auto -mb-px border-b border-gray-200 gap-2 sm:gap-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([
          { key: "all",              label: "All Orders" },
          { key: "placed",           label: "Order Placed" },
          { key: "shipped",          label: "Shipped" },
          { key: "out_for_delivery", label: "Out for Delivery" },
          { key: "delivered",        label: "Delivered" },
        ] as { key: StatusGroup; label: string }[]).map(({ key, label }) => {
          const active = tab === key
          const n = tabCounts[key]
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "shrink-0 px-1 pb-3 pt-1 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
                active
                  ? "text-foreground border-brand-gold"
                  : "text-gray-500 border-transparent hover:text-foreground",
              )}
            >
              {label}
              {n > 0 && (
                <span className={cn("ml-1.5 text-xs font-normal", active ? "text-gray-500" : "text-gray-400")}>
                  ({n})
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {initialLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((k) => <OrderCardSkeleton key={k} />)}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-3 text-sm text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-white hover:bg-foreground/85 transition-colors"
          >
            Try again
          </button>
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
          <ReceiptText className="mx-auto h-14 w-14 text-gray-300" />
          <h2 className="text-lg font-semibold text-foreground mt-5">
            {searchActive
              ? `No orders match "${debouncedSearch}"`
              : orders.length === 0 ? "No orders yet" : "No matching orders"}
          </h2>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
            {searchActive
              ? "Try a different order number or product name."
              : orders.length === 0
                ? "When you place an order, it will appear here. Start exploring our marketplace to find products you love."
                : "Try a different tab or clear your search."}
          </p>
          {!searchActive && orders.length === 0 && (
            <Link
              href="/"
              className="inline-flex items-center gap-2 mt-6 rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
            >
              <ShoppingBag className="h-4 w-4" /> Start Shopping
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Single-column stacked feed — Amazon-style. */}
          <div className="flex flex-col gap-4">
            {visibleOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>

          {/* Infinite-scroll trigger + bottom states. The sentinel is what
              the IntersectionObserver watches; the spinner / "end of list"
              text just sits above it for affordance. */}
          {hasMore ? (
            <div className="flex items-center justify-center py-6">
              {appending ? (
                <span className="inline-flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading more orders…
                </span>
              ) : (
                <span className="text-xs text-gray-400">Scroll for more</span>
              )}
            </div>
          ) : orders.length > 0 ? (
            <p className="text-center text-xs text-gray-400 py-6">
              That&rsquo;s all your orders.
            </p>
          ) : null}
          <div ref={sentinelRef} aria-hidden className="h-px" />
        </>
      )}

      {/* Tailwind plugin-free utility helpers for the action buttons used in
          OrderCard. Defined here to keep all card markup local. */}
      <style jsx global>{`
        .border-action {
          flex: 1 1 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          border: 1px solid hsl(0 0% 90%);
          color: hsl(0 0% 10%);
          background: white;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.8125rem;
          font-weight: 600;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }
        .border-action:hover { background: hsl(0 0% 96%); border-color: hsl(0 0% 80%); }
        .primary-action {
          flex: 1 1 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          background: hsl(var(--brand-gold));
          color: hsl(var(--brand-gold-foreground));
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.8125rem;
          font-weight: 700;
          transition: background-color 0.15s ease;
        }
        .primary-action:hover { background: hsl(var(--brand-gold-hover)); }
        @media (min-width: 640px) {
          .border-action, .primary-action { flex: 0 0 auto; }
        }
      `}</style>
    </main>
  )
}
