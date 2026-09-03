"use client"

/**
 * Order Detail — buyer view. Amazon-standard two-column layout, on-brand.
 *
 *   • Left: delivery tracker(s) + items, grouped by seller/sub-order. Pickup
 *     sub-orders show pickup state (reusing the PickupCard pattern from the
 *     checkout/complete page) instead of a shipping tracker.
 *   • Right: Order Summary (real cents fields from OrderDto — no fabricated
 *     numbers), shipping address, payment method, Download receipt button
 *     (disabled placeholder — the download endpoint ships in a later task).
 *   • Store names are resolved via getStoreById (same pattern as
 *     CheckoutClientV2) — never render a raw storeId UUID.
 *   • Status pills/grouping reuse components/orders/status.tsx so this page
 *     never drifts from the orders-list definition of "Shipped" etc.
 *
 * APIs (unchanged): getOrderByNumber, checkReviewEligibility, createReview,
 * getStoreById. useCartStore.addItem for Buy Again.
 */

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { getAccessToken, autoSignInKeycloak } from "@/lib/auth-helpers"
import { RequestReturnButton } from "@/components/returns/RequestReturnButton"
import {
  getOrderByNumber,
  checkReviewEligibility,
  createReview,
  getStoreById,
  downloadReceipt,
  type OrderDto,
  type SubOrderDto,
  type OrderItemDto,
} from "@/lib/api"
import { statusBadge } from "@/components/orders/status"
import {
  ArrowLeft, Package, Truck, CheckCircle, Clock, Loader2, XCircle,
  CreditCard, MapPin, Star, BadgeCheck, Home, ShoppingBag, Store, FileDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/stores/cart-store"
import { logError } from "@/lib/errors"
import { HOUSE_STORE_ID, storeDisplayName } from "@/lib/house-store"

/* ─────────────────────── Helpers ─────────────────────── */

/**
 * Backend stores the shipping address as a JSON snapshot taken at checkout
 * (OrderService.resolveShippingAddress):
 *   {fullName, line1, line2?, city, state, zip, phone?}
 * Older orders may store the raw string. We try JSON first, fall back to a
 * single-line render so legacy data still displays.
 */
type ShippingSnapshot = {
  fullName?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  country?: string
}
function parseShippingAddress(raw: string | null | undefined): ShippingSnapshot | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as ShippingSnapshot
      if (obj && (obj.line1 || obj.city)) return obj
    } catch { /* fall through to plain string */ }
  }
  return { line1: trimmed }
}

/**
 * Stripe sends `payment_method = "card"` plus a `last4`. Surface that as
 * "Card ending in 4242" rather than the raw token; fall back to the raw
 * value (e.g. "stripe", "mobile_money") for non-card providers.
 */
function paymentLabel(method: string | null | undefined, last4: string | null | undefined) {
  if (!method) return null
  const pretty = method === "card" ? "Card" : method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  return last4 ? `${pretty} ending in ${last4}` : pretty
}

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}
function formatDate(iso: string, withTime = false) {
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z")
  return d.toLocaleString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  })
}
function formatShort(iso: string) {
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z")
  return d.toLocaleString("en-US", { month: "short", day: "numeric" })
}

/* ─────────────────────── Fulfillment shape (ported from checkout/complete) ─────────────────────── */

function isPickupSub(sub: SubOrderDto): boolean {
  return sub.deliveryMethod === "pickup"
}

/* ─────────────────────── Shipping delivery stepper ─────────────────────── */

type StepKey = "placed" | "shipped" | "out_for_delivery" | "delivered"
const STEP_ORDER: StepKey[] = ["placed", "shipped", "out_for_delivery", "delivered"]
const STEP_LABEL: Record<StepKey, string> = {
  placed: "Order Placed",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
}
const STEP_ICON: Record<StepKey, typeof Package> = {
  placed: CheckCircle,
  shipped: Truck,
  out_for_delivery: Package,
  delivered: Home,
}

/* Pickup stepper — mirrors the ship stepper shape but with pickup-specific labels. */
type PickupStepKey = "placed" | "preparing" | "ready" | "collected"
const PICKUP_STEP_ORDER: PickupStepKey[] = ["placed", "preparing", "ready", "collected"]
const PICKUP_STEP_LABEL: Record<PickupStepKey, string> = {
  placed: "Order Placed",
  preparing: "Preparing",
  ready: "Ready for Pickup",
  collected: "Picked Up",
}
const PICKUP_STEP_ICON: Record<PickupStepKey, typeof Package> = {
  placed: CheckCircle,
  preparing: Package,
  ready: Store,
  collected: Home,
}

function statusToStepIndex(status: string): number {
  const s = status.toLowerCase()
  if (s === "delivered" || s === "completed") return 3
  if (s === "out_for_delivery") return 2
  if (s === "shipped" || s === "dispatched") return 1
  if (s === "cancelled" || s === "refunded") return -1
  return 0
}

function statusToPickupStepIndex(status: string): number {
  const s = status.toLowerCase()
  if (s === "delivered" || s === "completed") return 3
  if (s === "ready_for_pickup" || s === "out_for_delivery") return 2
  if (s === "shipped" || s === "dispatched" || s === "packaged") return 1
  if (s === "cancelled" || s === "refunded") return -1
  return 0
}

/** Short "Placed {date} · {…}" sub-line under the order header — mirrors
 * the preview's "Placed Aug 24, 2026 · Arriving today by 9 PM" line, minus
 * any fabricated ETA (we don't have a real delivery-window field). */
function arrivingLine(status: string, pickup: boolean): string | null {
  const s = status.toLowerCase()
  if (pickup) {
    if (s === "delivered" || s === "completed") return "Picked up"
    if (s === "ready_for_pickup" || s === "out_for_delivery") return "Ready for pickup"
    if (s === "shipped" || s === "dispatched" || s === "packaged") return "Preparing your pickup"
    return null
  }
  if (s === "delivered" || s === "completed") return "Delivered"
  if (s === "out_for_delivery") return "Arriving today"
  if (s === "shipped" || s === "dispatched") return "On the way"
  if (s === "cancelled" || s === "refunded" || s === "payment_failed") return null
  return "Preparing your order"
}

function statusHeadline(status: string, trackingNumber: string | null | undefined, pickup: boolean) {
  const s = status.toLowerCase()
  if (pickup) {
    if (s === "delivered" || s === "completed") return "Picked up"
    if (s === "ready_for_pickup" || s === "out_for_delivery") return "Ready for pickup"
    if (s === "shipped" || s === "dispatched" || s === "packaged") return "Preparing your pickup"
    if (s === "cancelled") return "Cancelled"
    if (s === "refunded") return "Refunded"
    if (s === "payment_failed") return "Payment failed — please retry"
    return "Order placed"
  }
  if (s === "delivered" || s === "completed") return "Delivered"
  if (s === "out_for_delivery") return "Out for delivery today"
  if (s === "shipped" || s === "dispatched") return trackingNumber ? "On the way" : "Shipped"
  if (s === "cancelled") return "Cancelled"
  if (s === "refunded") return "Refunded"
  if (s === "payment_failed") return "Payment failed — please retry"
  // Pending / awaiting_payment statuses commonly occur in local dev where
  // the Stripe webhook isn't wired up — surfacing "Awaiting payment
  // confirmation" then is misleading because checkout did succeed; only the
  // status flip via the webhook is missing. Fall through to the same label
  // the order-placed step uses on the stepper.
  if (s === "awaiting_payment" || s === "pending") return "Order placed"
  return "Preparing your order"
}

function FulfillmentStepper({
  status,
  placedAt,
  pickup,
}: {
  status: string
  placedAt: string
  pickup: boolean
}) {
  const order: readonly string[] = pickup ? PICKUP_STEP_ORDER : STEP_ORDER
  const label: Record<string, string> = pickup ? PICKUP_STEP_LABEL : STEP_LABEL
  const icon: Record<string, typeof Package> = pickup ? PICKUP_STEP_ICON : STEP_ICON
  const activeIdx = pickup ? statusToPickupStepIndex(status) : statusToStepIndex(status)
  const isCancelled = activeIdx === -1
  return (
    <div className="relative w-full">
      {/* connecting line */}
      <div className="absolute top-5 left-5 right-5 h-1 bg-border z-0 -translate-y-1/2" />
      {!isCancelled && activeIdx > 0 && (
        <div
          className="absolute top-5 left-5 h-1 bg-brand-gold z-0 -translate-y-1/2"
          style={{ width: `calc(${(activeIdx / (order.length - 1)) * 100}% - 1.25rem)` }}
        />
      )}
      <div className="relative z-10 flex justify-between w-full">
        {order.map((step, i) => {
          const Icon = icon[step]
          const done = !isCancelled && i <= activeIdx
          const active = !isCancelled && i === activeIdx
          const dateText = i === 0
            ? formatShort(placedAt)
            : done ? "Completed" : "Pending"
          return (
            <div key={step} className="flex flex-col items-center flex-1 min-w-0">
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                done
                  ? "bg-brand-gold text-brand-gold-foreground"
                  : "bg-muted text-muted-foreground border border-border",
                active && "ring-4 ring-brand-gold/25",
              )}>
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <span className={cn(
                "mt-3 text-xs text-center px-1 leading-tight",
                done ? "text-foreground font-semibold" : "text-muted-foreground",
              )}>
                {label[step]}
              </span>
              <span className="mt-1 text-[10px] text-muted-foreground text-center">{dateText}</span>
            </div>
          )
        })}
      </div>
      {isCancelled && (
        <p className="mt-4 text-sm text-red-600 text-center">
          This order was {status.toLowerCase()}.
        </p>
      )}
    </div>
  )
}

/* ─────────────────────── Pickup card ─────────────────────── */

function PickupCard({ sub }: { sub: SubOrderDto }) {
  const loc = sub.pickupLocation
  if (!loc) return null
  const addressLine = [loc.city, loc.region].filter(Boolean).join(", ") + (loc.postalCode ? ` ${loc.postalCode}` : "")
  return (
    <div className="mt-6 relative overflow-hidden rounded-2xl border border-brand-green/30 bg-brand-green-soft/50 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-green text-brand-green-foreground">
          <Store className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-green">Collect in store</p>
          <p className="mt-0.5 text-base font-bold text-foreground">{loc.name || "Store pickup"}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2.5 border-t border-dashed border-brand-green/30 pt-4">
        {(loc.line1 || addressLine.trim()) && (
          <p className="flex items-start gap-2 text-sm text-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
            <span>
              {loc.line1}
              {loc.line1 && addressLine.trim() ? ", " : ""}
              {addressLine.trim()}
            </span>
          </p>
        )}
        {(loc.hours || loc.prepTime) && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
            <span>{[loc.hours, loc.prepTime && `Ready in ${loc.prepTime}`].filter(Boolean).join(" · ")}</span>
          </p>
        )}
        {loc.instructions && <p className="text-sm text-muted-foreground">{loc.instructions}</p>}
      </div>
      <p className="mt-4 rounded-lg bg-card/70 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
        Show your confirmation email or a photo ID when you collect.
      </p>
    </div>
  )
}

/* ─────────────────────── Inline review form ─────────────────────── */

function InteractiveStars({
  rating, size = 22, onSelect,
}: { rating: number; size?: number; onSelect: (r: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <span className="inline-flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= (hover || rating)
        return (
          <Star
            key={i}
            size={size}
            className={cn(
              "cursor-pointer transition-colors",
              filled ? "fill-brand-gold text-brand-gold" : "fill-muted text-muted",
            )}
            onMouseEnter={() => setHover(i)}
            onClick={() => onSelect(i)}
          />
        )
      })}
    </span>
  )
}

function InlineReviewForm({
  productId, productTitle, onReviewed, onCancel,
}: {
  productId: string
  productTitle: string
  onReviewed: () => void
  onCancel: () => void
}) {
  const [rating, setRating] = useState(0)
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
      onReviewed()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes("409") || msg.includes("already")) {
        toast.error("You've already reviewed this product")
        onReviewed()
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
    <div className="mt-3 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4 space-y-3">
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">
          Rate <span className="font-semibold text-foreground">{productTitle}</span>
        </p>
        <InteractiveStars rating={rating} onSelect={setRating} />
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
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-4 py-1.5 text-xs font-bold text-brand-gold-foreground hover:bg-brand-gold-hover disabled:opacity-50 transition-colors"
        >
          {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
          Submit review
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────── Items section ─────────────────────── */

function OrderItem({
  item, sub, isDelivered,
}: {
  item: OrderItemDto
  sub: SubOrderDto
  isDelivered: boolean
}) {
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [eligibility, setEligibility] = useState<{
    eligible: boolean; purchased: boolean; already_reviewed: boolean
  } | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (!isDelivered || !item.productId) return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const res = await checkReviewEligibility(token, item.productId!)
        if (!cancelled) setEligibility(res)
      } catch { /* swallow */ }
    })()
    return () => { cancelled = true }
  }, [isDelivered, item.productId])

  const canReview = isDelivered && eligibility?.eligible === true && !reviewed
  const alreadyReviewed = eligibility?.already_reviewed === true || reviewed

  // Deep-link from the Orders list "Write a review" button (→ …/orders/[n]#review):
  // auto-open the inline review form for the reviewable item once eligibility
  // resolves, instead of dropping the buyer on the plain order-details page.
  useEffect(() => {
    if (canReview && typeof window !== "undefined" && window.location.hash === "#review") {
      setShowForm(true)
    }
  }, [canReview])

  function handleBuyAgain() {
    if (!item.productId || adding) return
    setAdding(true)
    try {
      addItem({
        productId: item.productId,
        variantId: item.variantId,
        storeId: sub.storeId,
        storeName: storeDisplayName(sub.storeId),
        title: item.productTitle || "Product",
        variantName: item.variantName || "Default",
        price: item.unitPriceCents,
        quantity: item.quantity,
        imageUrl: item.imageUrl ?? undefined,
        slug: item.slug ?? item.productId,
        weightKg: null, lengthIn: null, widthIn: null, heightIn: null,
      })
      toast.success(`Added "${item.productTitle ?? "item"}" to your cart`)
      router.push("/cart")
    } finally {
      setAdding(false)
    }
  }

  const eachLabel = item.quantity > 1
    ? <span className="text-sm font-normal text-muted-foreground"> ({formatCents(item.unitPriceCents)} ea)</span>
    : null

  return (
    <div className="flex flex-col sm:flex-row gap-4 border-b border-border pb-6 last:border-0 last:pb-0">
      <div className="w-full sm:w-28 h-28 bg-muted flex-shrink-0 rounded-lg overflow-hidden border border-border">
        {item.imageUrl && !imgError ? (
          // Native <img>, not next/image: product image hosts are unpredictable
          // (sellers upload to various CDNs), so requiring each in next.config
          // remotePatterns silently breaks thumbnails. Same rationale as the
          // delivery-proof photo below. onError falls back to the Package icon.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.productTitle || "Product"}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div className="min-w-0">
          <Link
            href={`/product/${item.slug || item.productId}`}
            className="text-sm font-bold text-foreground hover:text-brand-gold-hover transition-colors line-clamp-2"
          >
            {item.productTitle || "Product"}
          </Link>
          {item.variantName && item.variantName.toLowerCase() !== "default" && (
            <p className="text-xs text-muted-foreground mt-1">{item.variantName}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Qty: {item.quantity}</p>
          <p className="text-lg font-bold text-brand-green mt-1.5">
            {formatCents(item.totalPriceCents)}
            {eachLabel}
          </p>
          {alreadyReviewed && (
            <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-600 font-medium">
              <BadgeCheck className="h-3.5 w-3.5" /> Reviewed
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {item.productId && (
            <button
              type="button"
              onClick={handleBuyAgain}
              disabled={adding}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border text-foreground bg-card hover:bg-muted rounded-lg transition-colors disabled:opacity-60"
            >
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingBag className="h-3 w-3" />}
              Buy Again
            </button>
          )}
          {canReview && !showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-gold-foreground hover:bg-brand-gold/10 rounded-lg transition-colors"
            >
              <Star className="h-3 w-3" />
              Write Review
            </button>
          )}
        </div>

        {canReview && showForm && item.productId && (
          <InlineReviewForm
            productId={item.productId}
            productTitle={item.productTitle || "this product"}
            onReviewed={() => { setReviewed(true); setShowForm(false) }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    </div>
  )
}

/* ─────────────────────── Sub-order section ─────────────────────── */

function SubOrderTracker({
  sub, placedAt, single, storeName, index, total,
}: {
  sub: SubOrderDto
  placedAt: string
  single: boolean
  storeName: string
  index: number
  total: number
}) {
  const pickup = isPickupSub(sub)
  const headline = statusHeadline(sub.fulfillmentStatus, sub.trackingNumber, pickup)
  const badge = statusBadge(sub.fulfillmentStatus)
  const isDelivered = sub.fulfillmentStatus === "delivered" || sub.fulfillmentStatus === "completed"

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          {/* Multi-seller orders ship in separate packages — number each so two
              trackers read as "2 shipments", not a duplicate. */}
          {!single && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Shipment {index} of {total}
            </p>
          )}
          <h3 className="text-sm font-bold text-foreground">
            {pickup ? "Pickup status" : "Delivery status"}
          </h3>
          {!single && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Store className="h-3 w-3" /> {storeName}
            </p>
          )}
        </div>
        <span className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
          badge.tone,
        )}>
          <badge.Icon className="h-3 w-3" /> {badge.label}
        </span>
      </div>
      <p className="mb-5 text-base font-bold text-foreground">{headline}</p>
      {pickup ? (
        <>
          <FulfillmentStepper status={sub.fulfillmentStatus} placedAt={placedAt} pickup />
          <PickupCard sub={sub} />
        </>
      ) : (
        <>
          <FulfillmentStepper status={sub.fulfillmentStatus} placedAt={placedAt} pickup={false} />
          {sub.trackingNumber && (
            <div className="mt-5 flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tracking number</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">
                  {sub.trackingNumber}
                </p>
              </div>
              {sub.shippingCarrier && (
                <span className="text-xs text-muted-foreground">{sub.shippingCarrier}</span>
              )}
            </div>
          )}
        </>
      )}
      {isDelivered && sub.deliveryProofImageUrl && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Delivery photo{sub.deliveryProofUploadedAt ? ` · ${new Date(sub.deliveryProofUploadedAt).toLocaleString()}` : ""}
          </p>
          {/* Native <img> — proof photos come from external CDN (uploadthing/etc.);
              skip next/image so we don't need every possible host in remotePatterns. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sub.deliveryProofImageUrl}
            alt="Delivery photo"
            className="max-h-80 rounded-lg border border-border bg-muted object-contain"
          />
        </div>
      )}
    </section>
  )
}

function SubOrderItems({
  sub, orderNumber, storeName,
}: {
  sub: SubOrderDto
  orderNumber: string
  storeName: string
}) {
  const isDelivered = sub.fulfillmentStatus === "delivered" || sub.fulfillmentStatus === "completed"
  return (
    <div className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          🏪 Sold by {storeName}
        </p>
        {isDelivered && (
          <RequestReturnButton sub={sub} orderNumber={orderNumber} />
        )}
      </div>
      <div className="flex flex-col gap-5">
        {sub.items.map((item) => (
          <OrderItem key={item.id} item={item} sub={sub} isDelivered={isDelivered} />
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────── Page ─────────────────────── */

export default function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params)
  const { status: sessionStatus } = useSession()
  const [order, setOrder] = useState<OrderDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storeNames, setStoreNames] = useState<Map<string, string>>(new Map())
  const [downloadingReceipt, setDownloadingReceipt] = useState(false)

  async function handleDownloadReceipt() {
    if (downloadingReceipt) return
    setDownloadingReceipt(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error("Session expired — please sign in again")
        return
      }
      await downloadReceipt(token, orderNumber)
    } catch (e) {
      logError(e, "downloading receipt")
      toast.error("Couldn't download the receipt — try again")
    } finally {
      setDownloadingReceipt(false)
    }
  }

  useEffect(() => {
    if (sessionStatus === "loading") return
    if (sessionStatus !== "authenticated") {
      // Guarded: stands down right after a sign-out so a warm Keycloak SSO
      // can't silently re-authenticate the user here.
      autoSignInKeycloak({ callbackUrl: `/orders/${orderNumber}` })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const data = await getOrderByNumber(token, orderNumber)
        if (!cancelled) setOrder(data)
      } catch (e) {
        logError(e, "loading order")
        if (!cancelled) setError("Failed to load order")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [sessionStatus, orderNumber])

  // Store-name resolution — never render a raw storeId UUID (same pattern as
  // CheckoutClientV2: fetch getStoreById for every non-house storeId seen).
  const nonHouseStoreIds = useMemo(() => {
    const ids = new Set<string>()
    for (const sub of order?.subOrders ?? []) {
      if (sub.storeId && sub.storeId !== HOUSE_STORE_ID) ids.add(sub.storeId)
    }
    return Array.from(ids).sort()
  }, [order])

  useEffect(() => {
    const missing = nonHouseStoreIds.filter((id) => !storeNames.has(id))
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      const results = await Promise.allSettled(missing.map((id) => getStoreById(id)))
      if (cancelled) return
      setStoreNames((prev) => {
        const next = new Map(prev)
        results.forEach((r, i) => {
          if (r.status === "fulfilled" && r.value?.name) next.set(missing[i], r.value.name)
        })
        return next
      })
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonHouseStoreIds])

  if (loading) {
    return (
      <main className="mx-auto max-w-[1280px] px-4 sm:px-6 py-20 flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-foreground" />
        <span className="text-sm text-muted-foreground">Loading order…</span>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-3 text-sm text-red-700">{error || "Order not found"}</p>
          <Link href="/orders" className="inline-block mt-4 rounded-lg bg-card border border-red-200 px-4 py-2 text-xs font-medium text-foreground hover:bg-red-50 transition-colors">
            Back to orders
          </Link>
        </div>
      </main>
    )
  }

  const placedAt = order.placedAt || order.createdAt
  const single = order.subOrders.length === 1
  const overallStatus = order.status
  const allItems = order.subOrders.flatMap((so) => so.items)
  const totalItems = allItems.reduce((sum, i) => sum + i.quantity, 0)
  const orderDiscount = order.discountCents ?? 0
  // Referral-credit field lands in a later phase; guard on > 0 so this line
  // simply stays absent until the backend populates it.
  const referralCreditCents = (order as unknown as { referralCreditCents?: number }).referralCreditCents ?? 0
  const badge = statusBadge(overallStatus)
  // The overall order is "pickup" for this header line only when every
  // sub-order is a pickup — a mixed cart still reads as a shipping order up top.
  const allPickup = order.subOrders.length > 0 && order.subOrders.every((so) => isPickupSub(so))
  const sub = arrivingLine(overallStatus, allPickup)

  return (
    <main className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Link
        href="/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">
          Order <span className="font-mono">#{order.orderNumber}</span>
        </h1>
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
          badge.tone,
        )}>
          <badge.Icon className="h-3 w-3" /> {badge.label}
        </span>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Placed {formatDate(placedAt)}{sub ? ` · ${sub}` : ""}
      </p>

      <div id="tracking" className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left: tracking + items per shipment, grouped by seller/sub-order */}
        <div className="flex flex-col gap-4">
          {!single && (
            <p className="text-sm text-muted-foreground">
              This order ships in {order.subOrders.length} packages from different sellers — each has its own tracking below.
            </p>
          )}
          {order.subOrders.map((so, i) => (
            <SubOrderTracker
              key={so.id}
              sub={so}
              placedAt={placedAt}
              single={single}
              storeName={storeDisplayName(so.storeId, storeNames.get(so.storeId))}
              index={i + 1}
              total={order.subOrders.length}
            />
          ))}

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h3 className="mb-4 text-sm font-bold text-foreground">
              Items in this order
            </h3>
            <div className="flex flex-col gap-4">
              {order.subOrders.map((so) => (
                <SubOrderItems
                  key={so.id}
                  sub={so}
                  orderNumber={orderNumber}
                  storeName={storeDisplayName(so.storeId, storeNames.get(so.storeId))}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Right: order summary + shipping + payment */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 text-sm font-bold text-foreground">Order summary</h3>
            <div className="text-sm">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Item subtotal ({totalItems})</span>
                <span className="tabular-nums text-foreground">{formatCents(order.subtotalCents, order.currency)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Shipping &amp; handling</span>
                <span className="tabular-nums text-foreground">
                  {order.shippingCostCents === 0 ? "FREE" : formatCents(order.shippingCostCents, order.currency)}
                </span>
              </div>
              {orderDiscount > 0 && (
                <div className="flex items-center justify-between py-1.5 text-brand-green">
                  <span>{order.couponCode ? `Coupon (${order.couponCode})` : "Discount"}</span>
                  <span className="tabular-nums font-semibold">−{formatCents(orderDiscount, order.currency)}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums text-foreground">{formatCents(order.taxCents, order.currency)}</span>
              </div>
              {referralCreditCents > 0 && (
                <div className="flex items-center justify-between py-1.5 text-brand-green">
                  <span>Referral credit</span>
                  <span className="tabular-nums font-semibold">−{formatCents(referralCreditCents, order.currency)}</span>
                </div>
              )}
              <div className="mt-1.5 flex items-center justify-between border-t border-brand-gold/40 pt-3 text-base font-extrabold">
                <span className="text-foreground">Grand total</span>
                <span className="tabular-nums text-brand-green">{formatCents(order.totalCents, order.currency)}</span>
              </div>
              {(order.storeCreditAppliedCents ?? 0) > 0 && (
                <>
                  <div className="flex items-center justify-between py-1.5 text-brand-green">
                    <span>Store credit applied</span>
                    <span className="tabular-nums font-semibold">−{formatCents(order.storeCreditAppliedCents ?? 0, order.currency)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm font-bold">
                    <span className="text-foreground">You paid</span>
                    <span className="tabular-nums text-foreground">{formatCents(order.totalCents - (order.storeCreditAppliedCents ?? 0), order.currency)}</span>
                  </div>
                </>
              )}
            </div>
          </section>

          {(() => {
            const ship = parseShippingAddress(order.shippingAddress)
            const pay = paymentLabel(order.paymentMethod, order.last4)
            if (!ship && !pay) return null
            return (
              <>
                {ship && (
                  <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      Shipping address
                    </h3>
                    <div className="text-sm leading-relaxed text-foreground">
                      {ship.fullName && <p className="font-semibold">{ship.fullName}</p>}
                      {ship.line1 && <p>{ship.line1}{ship.line2 ? `, ${ship.line2}` : ""}</p>}
                      {(ship.city || ship.state || ship.zip) && (
                        <p>
                          {[ship.city, ship.state].filter(Boolean).join(", ")}{ship.zip ? ` ${ship.zip}` : ""}
                        </p>
                      )}
                      {ship.country && <p>{ship.country}</p>}
                      {ship.phone && <p className="mt-2 text-muted-foreground">{ship.phone}</p>}
                    </div>
                  </section>
                )}
                {pay && (
                  <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      Payment
                    </h3>
                    <p className="flex items-center gap-2 text-sm text-foreground">
                      <CreditCard className="h-4 w-4 text-muted-foreground" /> {pay}
                    </p>
                  </section>
                )}
              </>
            )
          })()}

          <button
            type="button"
            onClick={handleDownloadReceipt}
            disabled={downloadingReceipt}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-brand-gold-foreground hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloadingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Download receipt (PDF)
          </button>
        </aside>
      </div>
    </main>
  )
}
