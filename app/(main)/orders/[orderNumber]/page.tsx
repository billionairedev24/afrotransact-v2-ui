"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getOrderByNumber,
  checkReviewEligibility,
  createReview,
  type OrderDto,
  type SubOrderDto,
  type OrderItemDto,
} from "@/lib/api"
import {
  ArrowLeft, Package, Store, Truck, CheckCircle, Clock, Loader2, XCircle,
  CreditCard, MapPin, Star, MessageSquare, BadgeCheck,
} from "lucide-react"
import { toast } from "sonner"

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:    { label: "Pending",    color: "text-yellow-400", bg: "bg-yellow-500/15", icon: Clock },
  paid:       { label: "Paid",       color: "text-blue-400",   bg: "bg-blue-500/15",   icon: CreditCard },
  processing: { label: "Processing", color: "text-blue-400",   bg: "bg-blue-500/15",   icon: Package },
  shipped:    { label: "Shipped",    color: "text-purple-400", bg: "bg-purple-500/15", icon: Truck },
  delivered:  { label: "Delivered",  color: "text-green-400",  bg: "bg-green-500/15",  icon: CheckCircle },
  cancelled:  { label: "Cancelled",  color: "text-red-400",    bg: "bg-red-500/15",    icon: XCircle },
}

const FULFILLMENT_STEPS = ["pending", "processing", "shipped", "delivered"]

function FulfillmentTracker({ status }: { status: string }) {
  const idx = FULFILLMENT_STEPS.indexOf(status)
  return (
    <div className="flex items-center gap-0">
      {FULFILLMENT_STEPS.map((step, i) => {
        const done = i <= idx
        const active = i === idx
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  done ? "bg-primary" : "bg-gray-200"
                } ${active ? "ring-2 ring-primary/40" : ""}`}
              />
              <span className={`text-[10px] capitalize ${done ? "text-primary" : "text-gray-500"}`}>
                {step}
              </span>
            </div>
            {i < FULFILLMENT_STEPS.length - 1 && (
              <div className={`flex-1 h-px mb-3 mx-1 transition-colors ${i < idx ? "bg-primary" : "bg-gray-100"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function InteractiveStars({
  rating,
  size = 20,
  onSelect,
}: {
  rating: number
  size?: number
  onSelect: (r: number) => void
}) {
  const [hover, setHover] = useState(0)
  return (
    <span className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= (hover || rating)
        return (
          <Star
            key={i}
            size={size}
            className={`cursor-pointer transition-all duration-150 ${
              filled ? "text-yellow-400 fill-yellow-400 scale-110" : "text-gray-600 hover:text-yellow-400/50"
            }`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onSelect(i)}
          />
        )
      })}
    </span>
  )
}

function InlineReviewForm({
  productId,
  productTitle,
  onReviewed,
}: {
  productId: string
  productTitle: string
  onReviewed: () => void
}) {
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function handleSubmit() {
    if (rating === 0) {
      toast.error("Please select a star rating")
      return
    }
    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) return
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
      } else {
        toast.error("Could not submit review")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!expanded) {
    return (
      <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
        <p className="text-xs text-yellow-700/80 mb-2">How was this product?</p>
        <InteractiveStars
          rating={rating}
          size={24}
          onSelect={(r) => {
            setRating(r)
            setExpanded(true)
          }}
        />
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div>
        <p className="text-xs text-primary/80 mb-1.5">
          Rating <span className="font-medium text-gray-900">{productTitle}</span>
        </p>
        <InteractiveStars rating={rating} size={24} onSelect={setRating} />
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder="Add a headline (optional)"
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary/40"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Tell others what you think… (optional)"
        className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary/40"
      />
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => { setExpanded(false); setRating(0) }}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
          Submit Review
        </button>
      </div>
    </div>
  )
}

function OrderItemRow({
  item,
  showReview,
  onReviewed,
}: {
  item: OrderItemDto
  showReview: boolean
  onReviewed?: (productId: string) => void
}) {
  const [eligibility, setEligibility] = useState<{
    eligible: boolean; purchased: boolean; already_reviewed: boolean
  } | null>(null)
  const [reviewed, setReviewed] = useState(false)

  useEffect(() => {
    if (!showReview || !item.productId) return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const res = await checkReviewEligibility(token, item.productId!)
        if (!cancelled) setEligibility(res)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [showReview, item.productId])

  const canReview = showReview && eligibility?.eligible === true && !reviewed
  const alreadyReviewed = eligibility?.already_reviewed === true || reviewed

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-gray-50 border border-gray-200 flex items-center justify-center">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt={item.productTitle || "Product"} width={64} height={64} className="h-full w-full object-cover" />
          ) : (
            <Package className="h-6 w-6 text-gray-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/product/${item.slug || item.productId}`} className="text-sm font-medium text-gray-900 hover:text-primary transition-colors line-clamp-1">
            {item.productTitle || "Product"}
          </Link>
          {item.variantName && <p className="text-xs text-gray-500 mt-0.5">{item.variantName}</p>}
          <p className="text-xs text-gray-500 mt-1">
            Qty: {item.quantity} &middot; {formatCents(item.unitPriceCents)} each
          </p>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-sm font-semibold text-gray-900">
            {formatCents(item.totalPriceCents)}
          </p>
          {alreadyReviewed && (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-emerald-400">
              <BadgeCheck className="h-3 w-3" /> Reviewed
            </span>
          )}
        </div>
      </div>

      {canReview && item.productId && (
        <InlineReviewForm
          productId={item.productId}
          productTitle={item.productTitle || "this product"}
          onReviewed={() => {
            setReviewed(true)
            onReviewed?.(item.productId!)
          }}
        />
      )}
    </div>
  )
}

function SubOrderCard({ sub, isDelivered }: { sub: SubOrderDto; isDelivered: boolean }) {
  const [_reviewedProducts, setReviewedProducts] = useState<Set<string>>(new Set())

  return (
    <section className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Store className="h-4 w-4 text-primary" />
          Store
        </div>
        <span className={`text-xs font-semibold capitalize ${
          sub.fulfillmentStatus === "delivered" ? "text-green-400"
          : sub.fulfillmentStatus === "shipped" ? "text-purple-400"
          : "text-yellow-400"
        }`}>
          {sub.fulfillmentStatus}
        </span>
      </div>

      <div className="px-5 py-3">
        <FulfillmentTracker status={sub.fulfillmentStatus} />
      </div>

      {sub.trackingNumber && (
          <div className="flex items-center justify-between px-5 py-2.5 mx-4 mb-3 rounded-xl bg-gray-50 border border-gray-200">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Tracking</p>
            <p className="text-sm text-gray-900 font-mono font-medium">{sub.trackingNumber}</p>
          </div>
        </div>
      )}

      {isDelivered && (
        <div className="mx-4 mb-3 rounded-xl bg-gradient-to-r from-yellow-500/10 via-orange-500/5 to-transparent border border-yellow-500/15 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/15">
              <MessageSquare className="h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">How was everything?</p>
              <p className="text-xs text-gray-500">Share your experience — it helps other shoppers</p>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {sub.items.map((item) => (
          <OrderItemRow
            key={item.id}
            item={item}
            showReview={isDelivered}
            onReviewed={(pid) => setReviewedProducts((prev) => new Set(prev).add(pid))}
          />
        ))}
      </div>

      <div className="border-t border-gray-200 px-5 py-3 flex justify-between text-sm bg-gray-50">
        <span className="text-gray-500">Subtotal</span>
        <span className="text-gray-900 font-medium">{formatCents(sub.subtotalCents)}</span>
      </div>
    </section>
  )
}

export default function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params)
  const { status: sessionStatus } = useSession()
  const [order, setOrder] = useState<OrderDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionStatus !== "authenticated") {
      if (sessionStatus !== "loading") setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const data = await getOrderByNumber(token, orderNumber)
        if (!cancelled) setOrder(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load order")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [sessionStatus, orderNumber])

  if (loading) {
    return (
      <main className="mx-auto max-w-[800px] px-4 sm:px-6 py-20 flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <span className="text-sm text-gray-500">Loading order...</span>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="mx-auto max-w-[800px] px-4 sm:px-6 py-12">
        <div className="rounded-2xl border border-red-500/20 bg-white p-8 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-600" />
          <p className="mt-3 text-sm text-red-500">{error || "Order not found"}</p>
          <Link href="/orders" className="inline-block mt-4 rounded-lg bg-gray-100 px-4 py-2 text-xs font-medium text-gray-900 hover:bg-gray-200 transition-colors">
            Back to orders
          </Link>
        </div>
      </main>
    )
  }

  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const StatusIcon = cfg.icon
  const allItems = order.subOrders.flatMap((so) => so.items)
  const totalItems = allItems.reduce((sum, i) => sum + i.quantity, 0)
  const _hasDeliveredSubOrder = order.subOrders.some(
    (so) => so.fulfillmentStatus === "delivered" || so.fulfillmentStatus === "completed"
  )

  return (
    <main className="mx-auto max-w-[800px] px-4 sm:px-6 py-8">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Order #{order.orderNumber}</p>
            <p className="text-gray-900 font-bold text-2xl mt-1">{formatCents(order.totalCents, order.currency)}</p>
            <p className="text-xs text-gray-500 mt-1">
              Placed on {formatDate(order.placedAt || order.createdAt)}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {cfg.label}
          </span>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-200">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal ({totalItems} item{totalItems !== 1 ? "s" : ""})</span>
              <span className="text-gray-900">{formatCents(order.subtotalCents, order.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Shipping</span>
              <span className="text-gray-900">{formatCents(order.shippingCostCents, order.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tax</span>
              <span className="text-gray-900">{formatCents(order.taxCents, order.currency)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-900 font-semibold">Total</span>
              <span className="text-gray-900 font-bold">{formatCents(order.totalCents, order.currency)}</span>
            </div>
          </div>
        </div>

        {order.shippingAddress && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <MapPin className="h-3.5 w-3.5" />
              <span className="uppercase tracking-wider">Shipping Address</span>
            </div>
            <p className="text-sm text-gray-600">{order.shippingAddress}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {order.subOrders.map((sub) => (
          <SubOrderCard
            key={sub.id}
            sub={sub}
            isDelivered={sub.fulfillmentStatus === "delivered" || sub.fulfillmentStatus === "completed"}
          />
        ))}
      </div>
    </main>
  )
}
