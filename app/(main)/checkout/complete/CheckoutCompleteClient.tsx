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
  ArrowRight,
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
      className="group inline-flex items-center gap-2.5 rounded-full border border-brand-gold/60 bg-brand-gold/10 px-4 py-2 transition-colors hover:bg-brand-gold/20"
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

// Map a sub-order fulfillment status onto a journey step so a REVISITED
// confirmation reflects real progress (e.g. an already-collected pickup) rather
// than always showing "just placed".
const PICKUP_RANK: Record<string, number> = {
  placed: 0, confirmed: 0, pending: 0, paid: 0, awaiting_payment: 0,
  preparing: 1, processing: 1, packaged: 1,
  ready_for_pickup: 2,
  picked_up: 3, collected: 3, delivered: 3, completed: 3,
}
const SHIP_RANK: Record<string, number> = {
  placed: 0, confirmed: 0, pending: 0, paid: 0, awaiting_payment: 0,
  preparing: 1, processing: 1, packaged: 1,
  shipped: 2, dispatched: 2, out_for_delivery: 2,
  delivered: 3, completed: 3,
}
function furthestStep(shape: FulfillmentShape, subs: SubOrderDto[]): number {
  if (subs.length === 0) return 0
  const rank = shape === "allPickup" ? PICKUP_RANK : SHIP_RANK
  return subs.reduce((max, s) => {
    const r = rank[(s.fulfillmentStatus ?? "").toLowerCase()] ?? 0
    return r > max ? r : max
  }, 0)
}

/** Horizontal stepper — completed/active/upcoming states with a connecting progress line. */
function StatusTracker({ steps, title, active = 0 }: { steps: typeof SHIP_JOURNEY; title?: string; active?: number }) {
  return (
    <div>
      {title && (
        <p className="mb-4 text-sm font-bold text-foreground">{title}</p>
      )}
      <div className="flex items-center">
        {steps.map((s, i) => {
          const done = i <= active
          return (
            <Fragment key={s.key}>
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    done
                      ? "border-brand-green bg-brand-green text-brand-green-foreground shadow-sm shadow-brand-green/30"
                      : "border-border bg-card text-muted-foreground/50"
                  }`}
                >
                  <s.Icon className="h-4.5 w-4.5" />
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  className={`-mx-0.5 h-0.5 flex-1 rounded-full ${i < active ? "bg-brand-green" : "bg-border"}`}
                />
              )}
            </Fragment>
          )
        })}
      </div>
      <div className="mt-2 flex">
        {steps.map((s, i) => (
          <span
            key={s.key}
            className={`flex-1 text-[11px] font-medium leading-tight ${i <= active ? "text-foreground" : "text-muted-foreground"} ${
              i === 0 ? "text-left" : i === steps.length - 1 ? "text-right" : "text-center"
            }`}
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
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${accent === "green" ? "font-medium text-brand-green" : "text-foreground"}`}>{value}</span>
    </div>
  )
}

/** Collect address / hours / instructions / prep time for a pickup sub-order — styled like a ticket/pass. */
function PickupCard({ subOrder }: { subOrder: SubOrderDto }) {
  const loc = subOrder.pickupLocation
  if (!loc) return null
  const addressLine = [loc.city, loc.region].filter(Boolean).join(", ") + (loc.postalCode ? ` ${loc.postalCode}` : "")
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-green/30 bg-brand-green-soft/50 p-5">
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

/**
 * A pickup is a physical place, not a seller. Two sub-orders collected at the
 * same counter must show ONE card, not one per seller — otherwise a mixed cart
 * renders the identical "Collect in store" card twice. Dedupe by location
 * identity (no id on the DTO, so name + address), keeping the first sub-order
 * as the representative for each unique location.
 */
function dedupePickupsByLocation(subs: SubOrderDto[]): SubOrderDto[] {
  const seen = new Set<string>()
  const out: SubOrderDto[] = []
  for (const s of subs) {
    const loc = s.pickupLocation
    if (!loc) continue
    const key = [loc.name, loc.line1, loc.city, loc.postalCode]
      .map((v) => (v ?? "").trim().toLowerCase())
      .join("|")
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
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
    title: "Your order is on the way",
    body: "Thanks for shopping with us — we've got it and we're getting it packed. A confirmation email is on its way.",
  },
  allPickup: {
    title: "Your order will be ready to collect",
    body: "Thanks for your order — we're getting your pickup ready and will let you know the moment it's waiting for you. A confirmation email is on its way.",
  },
  mixed: {
    title: "Thanks — your order is confirmed",
    body: "Part of your order ships to you, and part is ready to collect in-store. A confirmation email is on its way.",
  },
}

// Past-tense hero for an order that's already been fulfilled — shown when the
// confirmation page is revisited after pickup/delivery so it doesn't falsely
// read as a brand-new order.
const HERO_COPY_DONE: Record<FulfillmentShape, { title: string; body: string }> = {
  allShip: {
    title: "Your order was delivered",
    body: "This order is complete. Your receipt is in your email, and full details live in your orders.",
  },
  allPickup: {
    title: "You've picked up this order",
    body: "This order is complete — thanks for collecting it. Your receipt is in your email, and full details live in your orders.",
  },
  mixed: {
    title: "This order is complete",
    body: "Every part of this order has been fulfilled. Your receipt is in your email, and full details live in your orders.",
  },
}

/** Hero: success mark, per-shape headline, reassurance line, order number stamp. */
function Hero({ shape, orderNumber, fulfilled }: { shape: FulfillmentShape; orderNumber?: string | null; fulfilled?: boolean }) {
  const hero = (fulfilled ? HERO_COPY_DONE : HERO_COPY)[shape]
  return (
    <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-left">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-brand-green/10" />
        <span className="absolute inset-1.5 rounded-full bg-brand-green/15" />
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-brand-green text-brand-green-foreground shadow-lg shadow-brand-green/30">
          <CheckCircle className="h-6 w-6" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {hero.title}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{hero.body}</p>
        {orderNumber && (
          <div className="mt-4 flex justify-center sm:justify-start">
            <OrderStamp orderNumber={orderNumber} />
          </div>
        )}
      </div>
    </div>
  )
}

/** Mixed-cart: clearly labeled Shipping + Pickup sections, each with their own tracker. */
function MixedSections({ pickupSubOrders }: { pickupSubOrders: SubOrderDto[] }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Truck className="h-3.5 w-3.5" /> Shipping to you
        </p>
        <StatusTracker steps={SHIP_JOURNEY} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Store className="h-3.5 w-3.5" /> Ready for pickup
        </p>
        <StatusTracker steps={PICKUP_JOURNEY} />
        <div className="mt-5 space-y-3">
          {dedupePickupsByLocation(pickupSubOrders).map((s) => <PickupCard key={s.id} subOrder={s} />)}
        </div>
      </div>
    </div>
  )
}

/** Sticky order-summary card: item rows with thumbnail, then subtotal/shipping/tax/total. */
function OrderSummaryCard({
  items,
  order,
  currency,
  shape,
}: {
  items: NonNullable<OrderDto["subOrders"]>[number]["items"]
  order: OrderDto | null
  currency: string
  shape: FulfillmentShape
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:sticky lg:top-6">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-bold text-foreground">Order summary</h2>
      </div>
      <ul className="max-h-[360px] divide-y divide-border overflow-y-auto">
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
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {fmtMoney(it.totalPriceCents, currency)}
            </span>
          </li>
        ))}
      </ul>
      <div className="space-y-2 border-t border-border bg-muted/40 px-5 py-4">
        <SummaryRow label="Subtotal" value={fmtMoney(order?.subtotalCents, currency)} />
        {!!order?.discountCents && order.discountCents > 0 && (
          <SummaryRow
            label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
            value={`−${fmtMoney(order.discountCents, currency)}`}
            accent="green"
          />
        )}
        <SummaryRow
          label={shape === "allPickup" ? "Pickup" : shape === "mixed" ? "Shipping & pickup" : "Shipping"}
          value={order?.shippingCostCents ? fmtMoney(order.shippingCostCents, currency) : shape === "allPickup" ? "Pickup · Free" : "Free"}
        />
        <SummaryRow label="Tax" value={fmtMoney(order?.taxCents, currency)} />
        <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
          <span className="text-base font-bold text-foreground">Total</span>
          <span className="text-base font-extrabold tabular-nums text-foreground">{fmtMoney(order?.totalCents, currency)}</span>
        </div>
        {!!order?.storeCreditAppliedCents && order.storeCreditAppliedCents > 0 && (
          <>
            <SummaryRow
              label="Store credit applied"
              value={`−${fmtMoney(order.storeCreditAppliedCents, currency)}`}
              accent="green"
            />
            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="text-sm font-bold text-foreground">You paid</span>
              <span className="text-sm font-extrabold tabular-nums text-foreground">
                {fmtMoney((order?.totalCents ?? 0) - order.storeCreditAppliedCents, currency)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function OrderPlaced({ orderNumber }: { orderNumber?: string | null }) {
  const { data: session } = useSession()
  const [order, setOrder] = useState<OrderDto | null>(null)

  useEffect(() => {
    // Auth presence (not a secret): the /api/gw proxy attaches the real token.
    const uid = (session as { user?: { id?: string } } | null)?.user?.id
    if (!orderNumber || !uid) return
    let cancelled = false
    getOrderByNumber(uid, orderNumber)
      .then((o) => { if (!cancelled) setOrder(o) })
      .catch(() => { /* summary is best-effort; the confirmation stands without it */ })
    return () => { cancelled = true }
  }, [orderNumber, session])

  const items = order?.subOrders?.flatMap((s) => s.items) ?? []
  const currency = order?.currency ?? "USD"
  const shape = getFulfillmentShape(order)
  const pickupSubOrders = (order?.subOrders ?? []).filter((s) => s.deliveryMethod === "pickup")
  // Reflect real progress on a revisit (e.g. an already-collected pickup),
  // instead of always rendering the just-placed confirmation.
  const activeStep = furthestStep(shape, order?.subOrders ?? [])
  const fulfilled = activeStep >= 3

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <Hero shape={shape} orderNumber={orderNumber} fulfilled={fulfilled} />
      </div>

      {/* Two-column: tracker/fulfillment (left) + sticky order summary (right) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="space-y-6">
          {shape === "mixed" ? (
            <MixedSections pickupSubOrders={pickupSubOrders} />
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <StatusTracker
                steps={shape === "allPickup" ? PICKUP_JOURNEY : SHIP_JOURNEY}
                title={shape === "allPickup" ? "Pickup status" : "Delivery status"}
                active={activeStep}
              />
              {shape === "allPickup" && (
                <div className="mt-6 space-y-3">
                  {dedupePickupsByLocation(pickupSubOrders).map((s) => <PickupCard key={s.id} subOrder={s} />)}
                </div>
              )}
            </div>
          )}

          {/* What's next — only relevant before the order is fulfilled. */}
          {!fulfilled && (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
              <p>
                We&rsquo;ll email your receipt now and another note the moment{" "}
                {shape === "allPickup"
                  ? "your order is ready for pickup"
                  : shape === "mixed"
                    ? "each part of your order ships or is ready to collect"
                    : "your order ships"}
                . You can track everything from your orders anytime.
              </p>
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-wrap gap-3">
            <Link
              href={orderNumber ? `/orders/${orderNumber}` : "/orders"}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-brand-gold-foreground transition-colors hover:bg-brand-gold-hover"
            >
              {orderNumber ? (fulfilled ? "View this order" : "Track your order") : "View orders"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-border px-6 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
            >
              Continue shopping
            </Link>
          </div>
        </div>

        {/* Order summary (best-effort, sticky on desktop) */}
        {items.length > 0 && (
          <OrderSummaryCard items={items} order={order} currency={currency} shape={shape} />
        )}
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
        <main className="mx-auto max-w-[560px] px-4 py-16 sm:py-24">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-gold/15">
              <Loader2 className="h-8 w-8 animate-spin text-brand-gold-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Confirming your payment</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Payment received — we&apos;re placing your order now. This usually takes just a few seconds.
            </p>
            <ul className="mx-auto mt-7 max-w-[260px] space-y-3.5 text-left">
              <li className="flex items-center gap-3 text-sm font-medium text-foreground">
                <CheckCircle className="h-5 w-5 shrink-0 text-brand-green" />
                Payment received
              </li>
              <li className="flex items-center gap-3 text-sm font-semibold text-foreground">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-gold-foreground" />
                Placing your order
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Clock className="h-5 w-5 shrink-0" />
                Emailing your receipt
              </li>
            </ul>
            <p className="mt-7 text-xs text-muted-foreground">
              Keep this page open — there&apos;s nothing more to pay.
            </p>
          </div>
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
