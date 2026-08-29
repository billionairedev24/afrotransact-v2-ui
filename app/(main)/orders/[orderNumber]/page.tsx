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
import Image from "next/image"
import { useRouter } from "next/navigation"
import { signIn, useSession } from "next-auth/react"
import { toast } from "sonner"
import { getAccessToken } from "@/lib/auth-helpers"
import { RequestReturnButton } from "@/components/returns/RequestReturnButton"
import {
  getOrderByNumber,
  checkReviewEligibility,
  createReview,
  getStoreById,
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
        Bring your order number and a photo ID when you collect.
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
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.productTitle || "Product"}
            width={112}
            height={112}
            className="h-full w-full object-cover"
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

function SubOrderBlock({
  sub, placedAt, single, orderNumber, storeName,
}: {
  sub: SubOrderDto
  placedAt: string
  single: boolean
  orderNumber: string
  storeName: string
}) {
  const isDelivered = sub.fulfillmentStatus === "delivered" || sub.fulfillmentStatus === "completed"
  const pickup = isPickupSub(sub)
  const headline = statusHeadline(sub.fulfillmentStatus, sub.trackingNumber, pickup)
  const badge = statusBadge(sub.fulfillmentStatus)

  return (
    <div className="space-y-6">
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {single ? (pickup ? "Pickup Status" : "Delivery Status") : (pickup ? "Pickup" : "Shipment")}
            </h2>
            {!single && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Store className="h-3 w-3" /> {storeName}
              </p>
            )}
          </div>
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shrink-0",
            badge.tone,
          )}>
            <badge.Icon className="h-3 w-3" /> {badge.label}
          </span>
        </div>
        <p className="text-lg font-bold text-foreground mb-6">{headline}</p>
        {pickup ? (
          <>
            <FulfillmentStepper status={sub.fulfillmentStatus} placedAt={placedAt} pickup />
            <PickupCard sub={sub} />
          </>
        ) : (
          <>
            <FulfillmentStepper status={sub.fulfillmentStatus} placedAt={placedAt} pickup={false} />
            {sub.trackingNumber && (
              <div className="mt-6 flex items-center justify-between rounded-lg bg-muted border border-border px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tracking number</p>
                  <p className="text-sm font-mono font-semibold text-foreground mt-0.5">
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
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Delivery photo{sub.deliveryProofUploadedAt ? ` · ${new Date(sub.deliveryProofUploadedAt).toLocaleString()}` : ""}
            </p>
            {/* Native <img> — proof photos come from external CDN (uploadthing/etc.);
                skip next/image so we don't need every possible host in remotePatterns. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sub.deliveryProofImageUrl}
              alt="Delivery photo"
              className="max-h-80 rounded-lg border border-border object-contain bg-muted"
            />
          </div>
        )}
      </section>

      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-6">
          <h2 className="text-lg font-bold text-foreground">
            Items {single ? "in Order" : "in this " + (pickup ? "Pickup" : "Shipment")}
          </h2>
          {isDelivered && (
            <RequestReturnButton sub={sub} orderNumber={orderNumber} />
          )}
        </div>
        <div className="flex flex-col gap-6">
          {sub.items.map((item) => (
            <OrderItem key={item.id} item={item} sub={sub} isDelivered={isDelivered} />
          ))}
        </div>
      </section>
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

  useEffect(() => {
    if (sessionStatus === "loading") return
    if (sessionStatus !== "authenticated") {
      signIn("keycloak", { callbackUrl: `/orders/${orderNumber}` })
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
  // Only offer "Track Package" when the order actually has a shipping (non-pickup)
  // sub-order — a pickup-only order whose aggregate status reads "shipped"/"out
  // for delivery" must not show a shipping-track affordance.
  const anyShipping = order.subOrders.some((so) => so.deliveryMethod !== "pickup")
  const isShipped = anyShipping && ["shipped", "dispatched", "out_for_delivery"].includes(overallStatus.toLowerCase())
  const trackingHref = `/orders/${order.orderNumber}#tracking`

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Compact top bar — pure back/title; no share button since the order is private. */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Orders
          </Link>
          <h1 className="text-base font-bold text-foreground">Order Details</h1>
          <span className="w-20" />
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-8">
        {/* Order header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              Order <span className="font-mono text-foreground font-semibold">#{order.orderNumber}</span>
            </p>
            <p className="text-xs text-muted-foreground">Placed on {formatDate(placedAt)}</p>
          </div>
          <div className="flex gap-2">
            {isShipped && (
              <a
                href={trackingHref}
                className="px-4 py-2 bg-brand-gold text-brand-gold-foreground text-xs font-bold rounded-lg hover:bg-brand-gold-hover transition-colors"
              >
                Track Package
              </a>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div id="tracking" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: tracking + items per shipment, grouped by seller/sub-order */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {order.subOrders.map((sub) => (
              <SubOrderBlock
                key={sub.id}
                sub={sub}
                placedAt={placedAt}
                single={single}
                orderNumber={orderNumber}
                storeName={storeDisplayName(sub.storeId, storeNames.get(sub.storeId))}
              />
            ))}
          </div>

          {/* Right: order summary + shipping + payment */}
          <aside className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-20">
            <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <h2 className="text-lg font-bold text-foreground mb-4">Order Summary</h2>
              <div className="space-y-3 mb-4 pb-4 border-b border-border text-sm">
                <div className="flex justify-between text-foreground">
                  <span>Item{totalItems === 1 ? "" : "s"} subtotal ({totalItems}):</span>
                  <span>{formatCents(order.subtotalCents, order.currency)}</span>
                </div>
                <div className="flex justify-between text-foreground">
                  <span>Shipping &amp; handling:</span>
                  <span>{order.shippingCostCents === 0 ? "FREE" : formatCents(order.shippingCostCents, order.currency)}</span>
                </div>
                {orderDiscount > 0 && (
                  <div className="flex justify-between text-brand-green">
                    <span>{order.couponCode ? `Coupon (${order.couponCode})` : "Discount"}:</span>
                    <span>−{formatCents(orderDiscount, order.currency)}</span>
                  </div>
                )}
                {referralCreditCents > 0 && (
                  <div className="flex justify-between text-brand-green">
                    <span>Referral credit:</span>
                    <span>−{formatCents(referralCreditCents, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-foreground">
                  <span>Estimated tax:</span>
                  <span>{formatCents(order.taxCents, order.currency)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-foreground">Grand total:</span>
                <span className="text-2xl font-bold text-brand-green">
                  {formatCents(order.totalCents, order.currency)}
                </span>
              </div>
            </section>

            {(() => {
              const ship = parseShippingAddress(order.shippingAddress)
              const pay = paymentLabel(order.paymentMethod, order.last4)
              if (!ship && !pay) return null
              return (
                <section className="bg-card rounded-xl border border-border p-6">
                  <>
                    {ship && (
                      <div className={pay ? "mb-5" : ""}>
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          Shipping address
                        </h3>
                        <div className="pl-6 text-sm text-muted-foreground leading-relaxed">
                          {ship.fullName && (
                            <p className="text-foreground font-semibold">{ship.fullName}</p>
                          )}
                          {ship.line1 && (
                            <p>{ship.line1}{ship.line2 ? `, ${ship.line2}` : ""}</p>
                          )}
                          {(ship.city || ship.state || ship.zip) && (
                            <p>
                              {[ship.city, ship.state].filter(Boolean).join(", ")}{ship.zip ? ` ${ship.zip}` : ""}
                            </p>
                          )}
                          {ship.country && <p>{ship.country}</p>}
                          {ship.phone && (
                            <p className="text-xs text-muted-foreground mt-2">{ship.phone}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {pay && (
                      <div className={ship ? "pt-5 border-t border-border" : ""}>
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          Payment method
                        </h3>
                        <div className="pl-6 text-sm text-muted-foreground flex items-center gap-3">
                          <div className="h-6 w-10 bg-muted border border-border rounded flex items-center justify-center">
                            <CreditCard className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <p>{pay}</p>
                        </div>
                      </div>
                    )}
                  </>
                </section>
              )
            })()}

            {/* Download receipt — endpoint ships in a later task; render disabled so
                we never wire a fabricated URL. */}
            <button
              type="button"
              disabled
              title="Coming soon"
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-muted-foreground opacity-60 cursor-not-allowed"
            >
              <FileDown className="h-4 w-4" />
              Download receipt (PDF)
            </button>
          </aside>
        </div>
      </main>
    </div>
  )
}
