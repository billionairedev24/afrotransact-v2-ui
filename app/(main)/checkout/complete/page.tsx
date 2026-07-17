"use client"

import { useEffect, useState, Suspense, Fragment } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle, XCircle, Loader2, Package, Truck, PackageCheck, Copy, Check, Mail } from "lucide-react"
import { useSession } from "next-auth/react"
import { useCartStore, clearGuestCart } from "@/stores/cart-store"
import { PopularPicksStrip } from "@/app/(main)/categories/PopularPicksStrip"
import { getOrderByNumber, type OrderDto } from "@/lib/api"

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
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8a7512]">Order</span>
      <span className="font-mono text-sm font-semibold tracking-wide text-gray-900">{orderNumber}</span>
      {copied
        ? <Check className="h-3.5 w-3.5 text-[#067457]" />
        : <Copy className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600" />}
    </button>
  )
}

const JOURNEY = [
  { key: "placed", label: "Order placed", Icon: CheckCircle },
  { key: "preparing", label: "Preparing", Icon: Package },
  { key: "way", label: "On the way", Icon: Truck },
  { key: "delivered", label: "Delivered", Icon: PackageCheck },
]

function Journey() {
  const active = 0 // just placed
  return (
    <div>
      <div className="flex items-center">
        {JOURNEY.map((s, i) => {
          const done = i <= active
          return (
            <Fragment key={s.key}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-[#067457] bg-[#067457] text-white" : "border-gray-200 bg-white text-gray-300"}`}>
                <s.Icon className="h-4 w-4" />
              </span>
              {i < JOURNEY.length - 1 && (
                <span className={`h-0.5 flex-1 ${i < active ? "bg-[#067457]" : "bg-gray-200"}`} />
              )}
            </Fragment>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between">
        {JOURNEY.map((s, i) => (
          <span
            key={s.key}
            className={`w-16 text-[11px] font-medium ${i <= active ? "text-gray-900" : "text-gray-400"} ${i === 0 ? "text-left" : i === JOURNEY.length - 1 ? "text-right" : "text-center"}`}
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
      <span className="text-gray-500">{label}</span>
      <span className={accent === "green" ? "font-medium text-[#067457]" : "text-gray-700"}>{value}</span>
    </div>
  )
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      {/* Hero */}
      <div className="text-center">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-[#067457]/10" />
          <span className="absolute inset-2 rounded-full bg-[#067457]/15" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#067457] text-white shadow-lg shadow-[#067457]/30">
            <CheckCircle className="h-7 w-7" />
          </span>
        </div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-gray-900">
          Your treasures are on the way!
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
          Thanks for your order — we&rsquo;ve got it and we&rsquo;re getting it ready. A confirmation
          email is on its way.
        </p>
        {orderNumber && (
          <div className="mt-5 flex justify-center">
            <OrderStamp orderNumber={orderNumber} />
          </div>
        )}
      </div>

      {/* Journey */}
      <div className="mx-auto mt-10 max-w-md">
        <Journey />
      </div>

      {/* Order summary (best-effort) */}
      {items.length > 0 && (
        <div className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-bold text-gray-900">Order summary</h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-5 py-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                  {it.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={it.imageUrl} alt={it.productTitle ?? "Item"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300"><Package className="h-5 w-5" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{it.productTitle ?? "Item"}</p>
                  {it.variantName && <p className="truncate text-xs text-gray-500">{it.variantName}</p>}
                  <p className="text-xs text-gray-400">Qty {it.quantity}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">{fmtMoney(it.totalPriceCents, currency)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5 border-t border-gray-100 bg-gray-50/60 px-5 py-4 text-sm">
            <SummaryRow label="Subtotal" value={fmtMoney(order?.subtotalCents, currency)} />
            {!!order?.discountCents && order.discountCents > 0 && (
              <SummaryRow label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`−${fmtMoney(order.discountCents, currency)}`} accent="green" />
            )}
            <SummaryRow label="Shipping" value={order?.shippingCostCents ? fmtMoney(order.shippingCostCents, currency) : "Free"} />
            <SummaryRow label="Tax" value={fmtMoney(order?.taxCents, currency)} />
            <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-2">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-extrabold text-gray-900">{fmtMoney(order?.totalCents, currency)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Next steps */}
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
        <p>We&rsquo;ll email your receipt now and another note the moment your order ships. You can track everything from your orders anytime.</p>
      </div>

      {/* CTAs */}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={orderNumber ? `/orders/${orderNumber}` : "/orders"}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-6 py-3 text-sm font-bold text-[#0f0f10] hover:bg-brand-gold/90 transition-colors"
        >
          <Package className="h-4 w-4" /> {orderNumber ? "View your order" : "View orders"}
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Continue shopping
        </Link>
      </div>

      {/* Suggestions */}
      <div className="mt-16">
        <h2 className="mb-1 text-lg font-bold text-gray-900">Stock up on more African treasures</h2>
        <p className="mb-4 text-sm text-gray-500">Popular picks other shoppers are loving right now.</p>
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
