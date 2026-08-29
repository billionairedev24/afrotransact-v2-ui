"use client"

/**
 * Printable receipt view — Amazon/Stripe-style "Save as PDF" flow with no
 * backend endpoint: the browser's native print dialog (window.print()) with
 * "Save as PDF" as the destination IS the download. Matches the approved
 * design preview (black header band + gold hairline, BILL TO/SHIP TO,
 * per-seller item table, gold-rule totals block, green grand total,
 * advertorial band, social footer).
 *
 * Real OrderDto fields only:
 *   - BILL TO = the signed-in buyer's name/email (session.user) — OrderDto
 *     has no separate billing-contact field.
 *   - SHIP TO = the shippingAddress JSON snapshot (same parse as the order
 *     detail page).
 *   - Items grouped by sub-order/seller, store names resolved via
 *     getStoreById/storeDisplayName — never a raw storeId UUID.
 *   - Totals: subtotal, shipping (FREE at 0), discount/coupon (only if > 0),
 *     tax, referral credit (only if a future >0 field exists — guarded,
 *     absent today), grand total.
 *   - Payment method + last4 via the same paymentLabel() shape as the order
 *     detail page.
 *
 * @media print rules (app/globals.css) hide everything outside
 * `.receipt-printable` — site header/footer/ticker/promo popups and this
 * page's own screen-only toolbar — so printing/saving produces a clean,
 * single-page receipt.
 */

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { signIn, useSession } from "next-auth/react"
import { ArrowLeft, Loader2, Printer, XCircle } from "lucide-react"
import { getAccessToken } from "@/lib/auth-helpers"
import { getOrderByNumber, getStoreById, type OrderDto, type SubOrderDto } from "@/lib/api"
import { logError } from "@/lib/errors"
import { HOUSE_STORE_ID, storeDisplayName } from "@/lib/house-store"

/* ─────────────────────── Helpers (mirrors order detail page) ─────────────────────── */

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

function paymentLabel(method: string | null | undefined, last4: string | null | undefined) {
  if (!method) return null
  const pretty = method === "card" ? "Card" : method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  return last4 ? `${pretty} ending ${last4}` : pretty
}

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}
function formatDate(iso: string) {
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z")
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

/* ─────────────────────── Page ─────────────────────── */

export default function ReceiptPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params)
  const { data: session, status: sessionStatus } = useSession()
  const [order, setOrder] = useState<OrderDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storeNames, setStoreNames] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (sessionStatus === "loading") return
    if (sessionStatus !== "authenticated") {
      signIn("keycloak", { callbackUrl: `/orders/${orderNumber}/receipt` })
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
        logError(e, "loading order for receipt")
        if (!cancelled) setError("Failed to load order")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [sessionStatus, orderNumber])

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

  if (loading || sessionStatus === "loading") {
    return (
      <main className="mx-auto flex max-w-[1000px] flex-col items-center gap-3 px-4 py-20 sm:px-6">
        <Loader2 className="h-7 w-7 animate-spin text-foreground" />
        <span className="text-sm text-muted-foreground">Loading receipt…</span>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="mx-auto max-w-[1000px] px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-3 text-sm text-red-700">{error || "Order not found"}</p>
          <Link href="/orders" className="mt-4 inline-block rounded-lg border border-red-200 bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-red-50">
            Back to orders
          </Link>
        </div>
      </main>
    )
  }

  const placedAt = order.placedAt || order.createdAt
  const ship = parseShippingAddress(order.shippingAddress)
  const pay = paymentLabel(order.paymentMethod, order.last4)
  const discount = order.discountCents ?? 0
  // Referral-credit field lands in a later phase; guard on > 0 so this line
  // simply stays absent until the backend populates it (same guard as the
  // order detail page).
  const referralCreditCents = (order as unknown as { referralCreditCents?: number }).referralCreditCents ?? 0
  const isPaid = !["cancelled", "refunded", "payment_failed", "awaiting_payment", "pending"].includes(order.status.toLowerCase())
  const buyerName = session?.user?.name || ship?.fullName || "Customer"
  const buyerEmail = session?.user?.email || undefined

  function storeNameFor(sub: SubOrderDto) {
    return storeDisplayName(sub.storeId, storeNames.get(sub.storeId))
  }

  return (
    <div className="min-h-screen bg-muted/40 pb-16">
      {/* Screen-only toolbar */}
      <div className="receipt-no-print sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href={`/orders/${orderNumber}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2 text-sm font-bold text-brand-gold-foreground hover:brightness-95"
          >
            <Printer className="h-4 w-4" />
            Save as PDF / Print
          </button>
        </div>
      </div>

      {/* Receipt paper */}
      <div className="receipt-printable mx-auto mt-6 max-w-[860px] overflow-hidden rounded-sm bg-white text-[#0a0a0a] shadow-lg sm:mt-8">
        {/* Header band */}
        <div className="relative bg-black px-6 py-6 sm:px-11">
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-brand-gold" />
          <div className="flex items-start justify-between gap-4">
            <Image
              src="/brand/email-logo-white.png"
              alt="AfroTransact"
              width={160}
              height={34}
              className="h-8 w-auto"
              priority
            />
            <div className="text-right">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#bebebe]">RECEIPT</p>
              <p className="mt-1 text-sm font-extrabold text-brand-gold">#{order.orderNumber}</p>
              <p className="mt-0.5 text-[11px] text-[#bebebe]">{formatDate(placedAt)}</p>
              {isPaid && (
                <span className="mt-2 inline-block rounded-full bg-brand-green px-2.5 py-1 text-[10.5px] font-extrabold tracking-wide text-white">
                  ✓ PAID
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-1 gap-6 px-6 pb-1 pt-7 sm:grid-cols-2 sm:px-11">
          <div>
            <p className="mb-1.5 text-[9px] font-extrabold tracking-[0.14em] text-muted-foreground">BILL TO</p>
            <p className="text-[13.5px] font-bold">{buyerName}</p>
            {buyerEmail && <p className="mt-0.5 text-xs text-muted-foreground">{buyerEmail}</p>}
          </div>
          <div>
            <p className="mb-1.5 text-[9px] font-extrabold tracking-[0.14em] text-muted-foreground">SHIP TO</p>
            {ship ? (
              <div className="text-xs leading-relaxed text-[#444]">
                {ship.fullName && <p className="text-[13.5px] font-bold text-[#0a0a0a]">{ship.fullName}</p>}
                {ship.line1 && <p>{ship.line1}{ship.line2 ? `, ${ship.line2}` : ""}</p>}
                {(ship.city || ship.state || ship.zip) && (
                  <p>{[ship.city, ship.state].filter(Boolean).join(", ")}{ship.zip ? ` ${ship.zip}` : ""}</p>
                )}
                {ship.country && <p>{ship.country}</p>}
                {ship.phone && <p className="mt-1 text-muted-foreground">{ship.phone}</p>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Pickup / no shipping address</p>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 gap-4 px-6 pb-1 pt-5 sm:grid-cols-3 sm:px-11">
          <div>
            <p className="text-[9px] font-extrabold tracking-[0.12em] text-muted-foreground">ORDER NUMBER</p>
            <p className="mt-1 font-mono text-[12.5px] font-semibold">#{order.orderNumber}</p>
          </div>
          <div>
            <p className="text-[9px] font-extrabold tracking-[0.12em] text-muted-foreground">ORDER DATE</p>
            <p className="mt-1 text-[12.5px] font-semibold">{formatDate(placedAt)}</p>
          </div>
          {pay && (
            <div>
              <p className="text-[9px] font-extrabold tracking-[0.12em] text-muted-foreground">PAYMENT METHOD</p>
              <p className="mt-1 text-[12.5px] font-semibold">{pay}</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="px-6 pt-5 sm:px-11">
          <div className="grid grid-cols-[1fr_54px_84px_84px] gap-2 rounded-lg bg-[#f4f4f5] px-3 py-2.5 text-[9px] font-extrabold tracking-[0.08em] text-muted-foreground">
            <div>ITEM</div>
            <div className="text-center">QTY</div>
            <div className="text-right">UNIT</div>
            <div className="text-right">TOTAL</div>
          </div>

          {order.subOrders.map((sub) => (
            <div key={sub.id}>
              <p className="mb-1.5 mt-4 text-[11px] font-extrabold text-muted-foreground">
                🏪 Sold {sub.storeId === HOUSE_STORE_ID ? "& shipped " : ""}by {storeNameFor(sub)}
              </p>
              {sub.items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_54px_84px_84px] items-center gap-2 border-b border-[#e4e4e7] px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#f4f4f5]">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg">📦</span>
                      )}
                    </div>
                    <p className="truncate text-[12.5px] font-semibold">
                      {item.productTitle || "Product"}
                      {item.variantName && item.variantName.toLowerCase() !== "default" ? ` · ${item.variantName}` : ""}
                    </p>
                  </div>
                  <div className="text-center text-xs tabular-nums">{item.quantity}</div>
                  <div className="text-right text-xs tabular-nums">{formatCents(item.unitPriceCents, order.currency)}</div>
                  <div className="text-right text-xs font-bold tabular-nums">{formatCents(item.totalPriceCents, order.currency)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="flex justify-end px-6 pt-4 sm:px-11">
          <div className="w-full max-w-[300px]">
            <div className="flex justify-between py-1.5 text-[12.5px] text-[#333]">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCents(order.subtotalCents, order.currency)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between py-1.5 text-[12.5px] font-bold text-brand-green">
                <span>{order.couponCode ? `Coupon (${order.couponCode})` : "Discount"}</span>
                <span className="tabular-nums">−{formatCents(discount, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 text-[12.5px] text-[#333]">
              <span>Shipping &amp; handling</span>
              <span className="tabular-nums">
                {order.shippingCostCents === 0 ? "FREE" : formatCents(order.shippingCostCents, order.currency)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-[12.5px] text-[#333]">
              <span>Estimated tax</span>
              <span className="tabular-nums">{formatCents(order.taxCents, order.currency)}</span>
            </div>
            {referralCreditCents > 0 && (
              <div className="flex justify-between py-1.5 text-[12.5px] font-bold text-brand-green">
                <span>Referral credit</span>
                <span className="tabular-nums">−{formatCents(referralCreditCents, order.currency)}</span>
              </div>
            )}
            <div className="my-2 h-[2px] rounded bg-brand-gold" />
            <div className="flex justify-between py-1.5 text-base font-extrabold">
              <span>Total</span>
              <span className="tabular-nums text-brand-green">{formatCents(order.totalCents, order.currency)}</span>
            </div>
          </div>
        </div>

        {/* Advertorial */}
        <div className="mx-6 mt-6 rounded-[10px] bg-brand-green-soft px-5 py-4 sm:mx-11">
          <p className="text-[9px] font-extrabold tracking-[0.14em] text-brand-green">KEEP THE FLAVOR COMING</p>
          <p className="mt-1 text-sm font-extrabold">More from African &amp; diaspora kitchens</p>
          <p className="mt-1 text-[11.5px] text-[#4b5563]">
            Fresh drops from local stores every week — shop new arrivals at afrotransact.com
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-[#e4e4e7] px-6 py-6 text-center sm:px-11">
          <p className="mb-2.5 space-x-2.5 text-[11px] font-bold text-brand-green">
            <a href="https://instagram.com/afrotransact" target="_blank" rel="noreferrer">Instagram</a>
            <span className="text-[#e4e4e7]">·</span>
            <a href="https://linkedin.com/company/afrotransact" target="_blank" rel="noreferrer">LinkedIn</a>
            <span className="text-[#e4e4e7]">·</span>
            <a href="https://wa.me/15125088885" target="_blank" rel="noreferrer">WhatsApp</a>
          </p>
          <p className="text-[11.5px] font-semibold text-[#555]">Thank you for shopping with AfroTransact!</p>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#96969a]">
            Questions? hello@afrotransact.com · (512) 508-8885<br />
            © {new Date(placedAt).getFullYear()} AfroTransact, Inc. · Austin, TX · afrotransact.com
          </p>
        </div>
      </div>
    </div>
  )
}
