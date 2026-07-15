"use client"

/**
 * Order Detail — buyer view.
 *
 * Design ported from public/ux-designs/order-details.html with adaptations:
 *   • Brand tokens (Inter font, brand-gold for primary, gray scales for chrome).
 *   • Tracking stepper drives off our real order/sub-order fulfillment_status
 *     (no fake "Arriving today by 8 PM" — we show an honest line based on
 *     actual status + trackingNumber if present).
 *   • "Contact Seller" CTA is hidden until messaging ships (backlog #41).
 *   • Per-item "Write Review" opens the inline review form (existing pattern)
 *     and submits via createReview. "Buy Again" adds the item to cart.
 *   • For multi-store orders we render one tracking card per sub-order so
 *     each shipment is independently visible.
 *
 * APIs (unchanged):
 *   • getOrderByNumber, checkReviewEligibility, createReview
 *   • useCartStore.addItem for Buy Again
 */

import { use, useEffect, useState } from "react"
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
  type OrderDto,
  type SubOrderDto,
  type OrderItemDto,
} from "@/lib/api"
import {
  ArrowLeft, Package, Truck, CheckCircle, Clock, Loader2, XCircle,
  CreditCard, MapPin, Star, BadgeCheck, Home, ShoppingBag, Store,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/stores/cart-store"
import { logError } from "@/lib/errors"
import { storeDisplayName } from "@/lib/house-store"

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

/* ─────────────────────── Fulfillment stepper ─────────────────────── */

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

function statusToStepIndex(status: string): number {
  const s = status.toLowerCase()
  if (s === "delivered" || s === "completed") return 3
  if (s === "out_for_delivery") return 2
  if (s === "shipped" || s === "dispatched") return 1
  if (s === "cancelled" || s === "refunded") return -1
  return 0
}

function statusHeadline(status: string, trackingNumber: string | null | undefined) {
  const s = status.toLowerCase()
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
}: {
  status: string
  placedAt: string
}) {
  const activeIdx = statusToStepIndex(status)
  const isCancelled = activeIdx === -1
  return (
    <div className="relative w-full">
      {/* connecting line */}
      <div className="absolute top-5 left-5 right-5 h-1 bg-muted z-0 -translate-y-1/2" />
      {!isCancelled && activeIdx > 0 && (
        <div
          className="absolute top-5 left-5 h-1 bg-brand-gold z-0 -translate-y-1/2"
          style={{ width: `calc(${(activeIdx / (STEP_ORDER.length - 1)) * 100}% - 1.25rem)` }}
        />
      )}
      <div className="relative z-10 flex justify-between w-full">
        {STEP_ORDER.map((step, i) => {
          const Icon = STEP_ICON[step]
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
                {STEP_LABEL[step]}
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
              filled ? "fill-brand-gold text-brand-gold" : "fill-muted text-gray-200",
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
          <p className="text-lg font-bold text-foreground mt-1.5">
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
  sub, placedAt, single, orderNumber,
}: {
  sub: SubOrderDto
  placedAt: string
  single: boolean
  orderNumber: string
}) {
  const isDelivered = sub.fulfillmentStatus === "delivered" || sub.fulfillmentStatus === "completed"
  const headline = statusHeadline(sub.fulfillmentStatus, sub.trackingNumber)

  return (
    <div className="space-y-6">
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {single ? "Delivery Status" : "Shipment"}
            </h2>
            {!single && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Store className="h-3 w-3" /> {storeDisplayName(sub.storeId)}
              </p>
            )}
          </div>
        </div>
        <p className="text-lg font-bold text-foreground mb-6">{headline}</p>
        <FulfillmentStepper status={sub.fulfillmentStatus} placedAt={placedAt} />
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
      </section>

      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-foreground">
            Items {single ? "in Order" : "in this Shipment"}
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
  const isShipped = ["shipped", "dispatched", "out_for_delivery"].includes(overallStatus.toLowerCase())
  const trackingHref = `/orders/${order.orderNumber}#tracking`

  return (
    <div className="min-h-screen bg-muted">
      {/* Compact top bar — mockup lines 108-118. Pure back/title; no share
          button since the order is private. */}
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
          {/* Left: tracking + items per shipment */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {order.subOrders.map((sub) => (
              <SubOrderBlock key={sub.id} sub={sub} placedAt={placedAt} single={single} orderNumber={orderNumber} />
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
                  <span>{formatCents(order.shippingCostCents, order.currency)}</span>
                </div>
                {orderDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{order.couponCode ? `Coupon (${order.couponCode})` : "Discount"}:</span>
                    <span>−{formatCents(orderDiscount, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-foreground">
                  <span>Estimated tax:</span>
                  <span>{formatCents(order.taxCents, order.currency)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-foreground">Grand total:</span>
                <span className="text-2xl font-bold text-foreground">
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
          </aside>
        </div>
      </main>
    </div>
  )
}
