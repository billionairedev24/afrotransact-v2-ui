"use client"

import { useEffect, useState, Suspense, Fragment } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CheckCircle,
  XCircle,
  Loader2,
  Package,
  Truck,
  PackageCheck,
  Copy,
  Check,
  Mail,
  MapPin,
  Store,
  Clock,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useCartStore, clearGuestCart } from "@/stores/cart-store"
import { PopularPicksStrip } from "@/app/(main)/categories/PopularPicksStrip"
import { getOrderByNumber, type OrderDto, type SubOrderDto } from "@/lib/api"

const fmtMoney = (cents: number | undefined, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents ?? 0) / 100)

// Session-mode polling: Stripe returns the buyer here with ?session=<uuid>
// in the URL (set by _stripe-payment.tsx return_url). The order row does NOT
// exist yet — it's materialized by the order-service when the payment.completed
// Kafka event lands. We poll /api/public/checkout-sessions/:id/result every
// POLL_INTERVAL_MS for up to POLL_TIMEOUT_MS.
const POLL_INTERVAL_MS = 1200
const POLL_TIMEOUT_MS = 30_000

type SessionResult =
  | { status: "initiated" }
  | { status: "converted"; orderId: string; orderNumber?: string }
  | { status: "failed"; reason?: string }
  | { status: "abandoned" }

/**
 * Friendly post-checkout acknowledgment. We stay on this page rather than
 * bouncing to the order detail (which can race the async materialization and
 * dump the buyer on an empty cart). `orderId` is optional — the legacy inline
 * flow doesn't have one yet; the session flow does once conversion confirms.
 */
function OrderStamp({ orderNumber }: { orderNumber: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title="Copy order number"
      onClick={() => {
        navigator.clipboard?.writeText(orderNumber)
          .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
          .catch(() => {})
      }}
      className="group inline-flex items-center gap-2 rounded-full border border-brand-gold/60 bg-brand-gold/10 px-4 py-1.5 transition-colors hover:bg-brand-gold/20"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-gold-ink">Order</span>
      <span className="font-mono text-sm font-semibold tracking-wide text-foreground">{orderNumber}</span>
      {copied
        ? <Check className="h-3.5 w-3.5 text-brand-green" />
        : <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />}
    </button>
  )
}

const SHIP_JOURNEY = [
  { key: "placed", label: "Order placed", Icon: CheckCircle },
  { key: "preparing", label: "Preparing", Icon: Package },
  { key: "way", label: "On the way", Icon: Truck },
  { key: "delivered", label: "Delivered", Icon: PackageCheck },
]

const PICKUP_JOURNEY = [
  { key: "placed", label: "Order placed", Icon: CheckCircle },
  { key: "preparing", label: "Preparing", Icon: Package },
  { key: "ready", label: "Ready for pickup", Icon: Store },
  { key: "collected", label: "Picked up", Icon: PackageCheck },
]

function Journey({ steps }: { steps: typeof SHIP_JOURNEY }) {
  const active = 0 // just placed
  return (
    <div>
      <div className="flex items-center">
        {steps.map((s, i) => {
          const done = i <= active
          return (
            <Fragment key={s.key}>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                  done
                    ? "border-brand-green bg-brand-green text-brand-green-foreground"
                    : "border-border bg-card text-muted-foreground/50"
                }`}
              >
                <s.Icon className="h-4 w-4" />
              </span>
              {i < steps.length - 1 && (
                <span className={`h-0.5 flex-1 ${i < active ? "bg-brand-green" : "bg-border"}`} />
              )}
            </Fragment>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between">
        {steps.map((s, i) => (
          <span
            key={s.key}
            className={`w-16 text-[11px] font-medium ${i <= active ? "text-foreground" : "text-muted-foreground"} ${i === 0 ? "text-left" : i === steps.length - 1 ? "text-right" : "text-center"}`}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: "green" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent === "green" ? "font-medium text-brand-green" : "text-foreground"}>{value}</span>
    </div>
  )
}

/** Collect address / hours / instructions / prep time for a pickup sub-order. */
function PickupAddressBlock({ subOrder }: { subOrder: SubOrderDto }) {
  const loc = subOrder.pickupLocation
  if (!loc) return null
  const addressLine = [loc.city, loc.region].filter(Boolean).join(", ") + (loc.postalCode ? ` ${loc.postalCode}` : "")
  const meta = [loc.hours, loc.prepTime].filter(Boolean)
  return (
    <div className="rounded-xl border border-dashed border-brand-green/40 bg-brand-green-soft/60 px-4 py-3">
      <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-green">
        <MapPin className="h-4 w-4" /> Collect at {loc.name || "the store"}
      </p>
      {(loc.line1 || addressLine.trim()) && (
        <p className="mt-1 text-[13px] text-foreground">
          {loc.line1}
          {loc.line1 && addressLine.trim() ? ", " : ""}
          {addressLine.trim()}
        </p>
      )}
      {meta.length > 0 && (
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> {meta.join(" · ")}
        </p>
      )}
      {loc.instructions && <p className="mt-1 text-xs text-muted-foreground">{loc.instructions}</p>}
      <p className="mt-2 text-[11px] font-medium text-muted-foreground">
        Bring your order number and a photo ID when you collect.
      </p>
    </div>
  )
}

type FulfillmentShape = "allPickup" | "allShip" | "mixed"

function getFulfillmentShape(order: OrderDto | null): FulfillmentShape {
  const subs = order?.subOrders ?? []
  if (subs.length === 0) return "allShip"
  const pickups = subs.filter((s) => s.deliveryMethod === "pickup")
  if (pickups.length === subs.length) return "allPickup"
  if (pickups.length === 0) return "allShip"
  return "mixed"
}

const HERO_COPY: Record<FulfillmentShape, { title: string; body: string }> = {
  allShip: {
    title: "Your treasures are on the way!",
    body: "Thanks for your order — we’ve got it and we’re getting it ready. A confirmation email is on its way.",
  },
  allPickup: {
    title: "Your order is being prepared for pickup",
    body: "Thanks for your order — we’ll let you know the moment it’s ready to collect. A confirmation email is on its way.",
  },
  mixed: {
    title: "Thanks — your order is confirmed",
    body: "Part of your order ships to you, and part is ready to collect in-store. A confirmation email is on its way.",
  },
}

function OrderPlaced({ orderNumber }: { orderNumber?: string | null }) {
  const { data: session } = useSession()
  const [order, setOrder] = useState<OrderDto | null>(null)

  useEffect(() => {
    const token = (session as { accessToken?: string } | null)?.accessToken
    if (!orderNumber || !token) return
    let cancelled = false
    getOrderByNumber(token, orderNumber)
      .then((o) => { if (!cancelled) setOrder(o) })
      .catch(() => { /* summary is best-effort; the confirmation stands without it */ })
    return () => { cancelled = true }
  }, [orderNumber, session])

  const items = order?.subOrders?.flatMap((s) => s.items) ?? []
  const currency = order?.currency ?? "USD"
  const shape = getFulfillmentShape(order)
  const pickupSubOrders = (order?.subOrders ?? []).filter((s) => s.deliveryMethod === "pickup")
  const hero = HERO_COPY[shape]

  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      {/* Hero */}
      <div className="text-center">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-brand-green/10" />
          <span className="absolute inset-2 rounded-full bg-brand-green/15" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-green text-brand-green-foreground shadow-lg shadow-brand-green/30">
            <CheckCircle className="h-7 w-7" />
          </span>
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-foreground">
          {hero.title}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{hero.body}</p>
        {orderNumber && (
          <div className="mt-5 flex justify-center">
            <OrderStamp orderNumber={orderNumber} />
          </div>
        )}
      </div>

      {/* Progress tracker(s) */}
      {shape === "mixed" ? (
        <div className="mx-auto mt-10 max-w-lg space-y-8">
          <div>
            <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Store className="h-3.5 w-3.5" /> Pickup
            </p>
            <Journey steps={PICKUP_JOURNEY} />
            <div className="mt-4 space-y-3">
              {pickupSubOrders.map((s) => <PickupAddressBlock key={s.id} subOrder={s} />)}
            </div>
          </div>
          <div>
            <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Truck className="h-3.5 w-3.5" /> Shipping
            </p>
            <Journey steps={SHIP_JOURNEY} />
          </div>
        </div>
      ) : (
        <div className="mx-auto mt-10 max-w-md">
          <Journey steps={shape === "allPickup" ? PICKUP_JOURNEY : SHIP_JOURNEY} />
          {shape === "allPickup" && (
            <div className="mt-6 space-y-3">
              {pickupSubOrders.map((s) => <PickupAddressBlock key={s.id} subOrder={s} />)}
            </div>
          )}
        </div>
      )}

      {/* Order summary (best-effort) */}
      {items.length > 0 && (
        <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold text-foreground">Order summary</h2>
          </div>
          <ul className="divide-y divide-border">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-5 py-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                  {it.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={it.imageUrl} alt={it.productTitle ?? "Item"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-5 w-5" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{it.productTitle ?? "Item"}</p>
                  {it.variantName && <p className="truncate text-xs text-muted-foreground">{it.variantName}</p>}
                  <p className="text-xs text-muted-foreground">Qty {it.quantity}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{fmtMoney(it.totalPriceCents, currency)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5 border-t border-border bg-muted/40 px-5 py-4 text-sm">
            <SummaryRow label="Subtotal" value={fmtMoney(order?.subtotalCents, currency)} />
            {!!order?.discountCents && order.discountCents > 0 && (
              <SummaryRow label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`−${fmtMoney(order.discountCents, currency)}`} accent="green" />
            )}
            <SummaryRow
              label={shape === "allPickup" ? "Pickup" : "Shipping"}
              value={order?.shippingCostCents ? fmtMoney(order.shippingCostCents, currency) : "Free"}
            />
            <SummaryRow label="Tax" value={fmtMoney(order?.taxCents, currency)} />
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
              <span className="font-bold text-foreground">Total</span>
              <span className="font-extrabold text-foreground">{fmtMoney(order?.totalCents, currency)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Next steps */}
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
        <p>
          We&rsquo;ll email your receipt now and another note the moment{" "}
          {shape === "allPickup" ? "your order is ready for pickup" : "your order ships"}. You can track everything
          from your orders anytime.
        </p>
      </div>

      {/* CTAs */}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={orderNumber ? `/orders/${orderNumber}` : "/orders"}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
        >
          <Package className="h-4 w-4" /> {orderNumber ? "View your order" : "View orders"}
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-border px-6 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
        >
          Continue shopping
        </Link>
      </div>

      {/* Suggestions */}
      <div className="mt-16">
        <h2 className="mb-1 text-lg font-bold text-foreground">Stock up on more African treasures</h2>
        <p className="mb-4 text-sm text-muted-foreground">Popular picks other shoppers are loving right now.</p>
        <PopularPicksStrip />
      </div>
    </main>
  )
}

function CheckoutCompleteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clearCart = useCartStore((s) => s.clearCart)
  const redirectStatus = searchParams.get("redirect_status")
  const sessionId = searchParams.get("session")
  const [pollState, setPollState] = useState<"idle" | "polling" | "timeout" | "failed">(
    sessionId ? "polling" : "idle",
  )
  const [confirmed, setConfirmed] = useState<{ orderNumber?: string } | null>(null)

  const legacyStatus = redirectStatus === "failed" ? "failed" : "success"

  // Local-cart clear (legacy + session-mode success share this side-effect)
  useEffect(() => {
    if (sessionId) return // session-mode: defer until we confirm conversion
    if (redirectStatus !== "succeeded") return
    // Server cart clearing is owned by PaymentEventConsumer (session.converted).
    // We only clear local UI state here so the badge zeros instantly.
    clearCart()
    try { clearGuestCart() } catch { /* non-fatal */ }
  }, [redirectStatus, clearCart, sessionId])

  // Session-mode poll
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    const startedAt = Date.now()

    const tick = async () => {
      if (cancelled) return
      try {
        const res = await fetch(`/api/public/checkout-sessions/${encodeURIComponent(sessionId)}/result`, {
          cache: "no-store",
        })
        if (cancelled) return
        if (res.ok) {
          const data = (await res.json()) as SessionResult
          if (data.status === "converted" && "orderId" in data && data.orderId) {
            // Order materialized — server cart was cleared by PaymentEventConsumer.
            // Stay on this page with a friendly acknowledgment instead of bouncing
            // to the order detail (which can race materialization → empty cart).
            clearCart()
            try { clearGuestCart() } catch { /* non-fatal */ }
            setConfirmed({ orderNumber: data.orderNumber })
            return
          }
          if (data.status === "failed" || data.status === "abandoned") {
            setPollState("failed")
            return
          }
        }
      } catch {
        // network blip — keep polling until timeout
      }
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setPollState("timeout")
        return
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    let timer = setTimeout(tick, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sessionId, clearCart])

  // ── Session-mode rendering ────────────────────────────────────────────
  if (sessionId) {
    if (confirmed) {
      return <OrderPlaced orderNumber={confirmed.orderNumber} />
    }
    if (pollState === "polling") {
      return (
        <main className="mx-auto max-w-[600px] px-4 py-20 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-foreground" />
          <h1 className="text-xl font-bold text-gray-900 mt-6">Finalizing your order…</h1>
          <p className="text-gray-500 text-sm mt-2">
            Hang tight while we confirm your payment. This usually takes a few seconds.
          </p>
        </main>
      )
    }
    // timeout: payment likely succeeded but the order is still materializing —
    // reassure rather than alarm, and let them check their orders.
    if (pollState === "timeout") {
      return (
        <main className="mx-auto max-w-[600px] px-4 py-20 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-foreground" />
          <h1 className="text-xl font-bold text-gray-900 mt-6">Almost there…</h1>
          <p className="text-gray-500 text-sm mt-2">
            Your payment went through and we&apos;re finishing your order. It&apos;ll appear in your orders shortly.
          </p>
          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={() => router.push("/orders")}
              className="rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-[#0f0f10] hover:bg-brand-gold/90 transition-colors"
            >
              View orders
            </button>
            <button
              onClick={() => router.push("/")}
              className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Continue shopping
            </button>
          </div>
        </main>
      )
    }
    return (
      <main className="mx-auto max-w-[600px] px-4 py-20 text-center">
        <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-red-500/15 border border-red-500/30">
          <XCircle className="h-10 w-10 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mt-6">Something went wrong</h1>
        <p className="text-gray-500 text-sm mt-2">
          We couldn&apos;t confirm your order. If your card was charged, please contact support — we&apos;ll
          sort it out.
        </p>
        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={() => router.push("/cart")}
            className="rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-[#0f0f10] hover:bg-brand-gold/90 transition-colors"
          >
            Back to cart
          </button>
          <button
            onClick={() => router.push("/help")}
            className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Contact support
          </button>
        </div>
      </main>
    )
  }

  // ── Legacy rendering (no session= param) ──────────────────────────────
  if (legacyStatus === "failed") {
    return (
      <main className="mx-auto max-w-[600px] px-4 py-20 text-center">
        <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-red-500/15 border border-red-500/30">
          <XCircle className="h-10 w-10 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mt-6">Payment Failed</h1>
        <p className="text-gray-500 text-sm mt-2">Your payment could not be processed. Please try again.</p>
        <button
          onClick={() => router.push("/checkout")}
          className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-[#0f0f10]"
        >
          Try Again
        </button>
      </main>
    )
  }

  return <OrderPlaced />
}

export default function CheckoutCompletePage() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-[600px] px-4 py-20 text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-foreground" />
        <p className="mt-4 text-gray-500">Loading…</p>
      </main>
    }>
      <CheckoutCompleteContent />
    </Suspense>
  )
}
