"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Search, AlertTriangle, CheckCircle2, Clock, XCircle, RefreshCcw,
  ArrowLeft, Package, MapPin, User, Calendar,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/Skeleton"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  adminCreateRefund,
  adminGetOrderByNumber,
  adminGetRefundQueue,
  adminListRefundsByOrderNumber,
  type AdminOrderLookup,
  type RefundDto,
} from "@/lib/api"

const fmt = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100)

const REASON_OPTIONS = [
  { value: "buyer_cancel",      label: "Buyer-initiated cancel (within SLA)" },
  { value: "admin_refund",      label: "Admin discretionary refund" },
  { value: "fraud",             label: "Fraud / chargeback" },
  { value: "goodwill",          label: "Goodwill / service recovery" },
  { value: "dispute_lost",      label: "Stripe dispute lost" },
  { value: "seller_suspended_grace_expired", label: "Seller suspension auto-refund" },
  { value: "other",             label: "Other (see notes)" },
]

const STATUS_TONE: Record<string, { dot: string; text: string; label?: string }> = {
  cancelled:          { dot: "bg-red-500",       text: "text-red-700 dark:text-red-400" },
  refund_requested:   { dot: "bg-amber-500",     text: "text-amber-700 dark:text-amber-400" },
  payment_failed:     { dot: "bg-gray-400",      text: "text-gray-600 dark:text-gray-400" },
  pending:            { dot: "bg-blue-500",      text: "text-blue-700 dark:text-blue-400" },
  paid:               { dot: "bg-emerald-500",   text: "text-emerald-700 dark:text-emerald-400" },
  shipped:            { dot: "bg-emerald-500",   text: "text-emerald-700 dark:text-emerald-400" },
  delivered:          { dot: "bg-emerald-500",   text: "text-emerald-700 dark:text-emerald-400" },
  refunded:           { dot: "bg-violet-500",    text: "text-violet-700 dark:text-violet-400" },
  partially_refunded: { dot: "bg-violet-500",    text: "text-violet-700 dark:text-violet-400" },
}

export default function AdminRefundsPage() {
  const [view, setView] = useState<"queue" | "order">("queue")
  const [queue, setQueue] = useState<AdminOrderLookup[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueErr, setQueueErr] = useState<string | null>(null)

  const [orderNumber, setOrderNumber] = useState("")
  const [order, setOrder] = useState<AdminOrderLookup | null>(null)
  const [refunds, setRefunds] = useState<RefundDto[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    setQueueLoading(true); setQueueErr(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const res = await adminGetRefundQueue(token, 0, 25)
      setQueue(res.content)
    } catch (e) {
      setQueueErr(e instanceof Error ? e.message : "queue load failed")
    } finally {
      setQueueLoading(false)
    }
  }, [])

  useEffect(() => { void loadQueue() }, [loadQueue])

  async function loadOrder(num: string) {
    const n = num.trim()
    if (!n) return
    setLoading(true); setErr(null); setOrder(null); setRefunds([])
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const [o, rs] = await Promise.all([
        adminGetOrderByNumber(token, n),
        adminListRefundsByOrderNumber(token, n).catch(() => []),
      ])
      setOrder(o); setRefunds(rs); setView("order")
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      if (/Order not found|404|400/i.test(raw)) {
        setErr(`No order matches "${n}". Use the order number (e.g. ORD-…), not a buyer or seller UUID.`)
      } else {
        setErr(raw)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Refunds</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {view === "queue"
              ? "Orders waiting on a refund decision. Cancellations and failed payments surface here automatically."
              : "Order detail and refund actions. Refunds go through the canonical pipeline — durable record, Stripe idempotency, accounting event."}
          </p>
        </div>
        {view === "queue" && (
          <Button variant="ghost" size="sm" onClick={() => void loadQueue()}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
        )}
      </header>

      {/* Universal search */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
            Find any order
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ORD-1781018602915-3718E3"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="flex-1 border border-border rounded-md px-3 py-2 bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => e.key === "Enter" && loadOrder(orderNumber)}
            />
            <Button onClick={() => loadOrder(orderNumber)} disabled={loading || !orderNumber.trim()}>
              <Search className="h-4 w-4" /> {loading ? "Looking…" : "Open"}
            </Button>
          </div>
          {err && (
            <p className="text-xs text-red-600 mt-2 flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{err}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {view === "queue" ? (
        <RefundQueueView queue={queue} loading={queueLoading} err={queueErr} onOpen={(n) => loadOrder(n)} />
      ) : order ? (
        <OrderDetailView
          order={order}
          refunds={refunds}
          onBack={() => { setView("queue"); setOrder(null); setRefunds([]); setErr(null) }}
          onRefundIssued={async () => {
            const token = await getAccessToken()
            if (!token) return
            const rs = await adminListRefundsByOrderNumber(token, order.orderNumber).catch(() => [])
            setRefunds(rs)
            void loadQueue()
          }}
        />
      ) : null}
    </div>
  )
}

function RefundQueueView({
  queue, loading, err, onOpen,
}: {
  queue: AdminOrderLookup[]
  loading: boolean
  err: string | null
  onOpen: (orderNumber: string) => void
}) {
  if (err) {
    return <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{err}</div>
  }

  return (
    <Card className="p-0 overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Queue
            <Badge variant="outline" className="font-normal">
              {loading ? "…" : queue.length}
            </Badge>
          </CardTitle>
          {!loading && queue.length === 0 && (
            <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> All clear
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="divide-y divide-border">
            {[1,2,3].map((i) => (
              <div key={i} className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-medium">Refund queue is empty</p>
            <p className="text-xs text-muted-foreground mt-1">
              No orders are currently waiting on refund action.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {queue.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => onOpen(o.orderNumber)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-medium">{o.orderNumber}</code>
                      <StatusPill status={o.status} />
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                      {o.recipientName && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" /> {o.recipientName}
                        </span>
                      )}
                      {o.shipCity && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {o.shipCity}{o.shipStateRegion ? `, ${o.shipStateRegion}` : ""}
                        </span>
                      )}
                      {(o.placedAt || o.createdAt) && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {new Date(o.placedAt ?? o.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{fmt(o.totalCents, o.currency)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">total</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function StatusPill({ status }: { status: string }) {
  const t = STATUS_TONE[status] ?? { dot: "bg-gray-400", text: "text-gray-600" }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${t.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {status.replace(/_/g, " ")}
    </span>
  )
}

function OrderDetailView({
  order, refunds, onBack, onRefundIssued,
}: {
  order: AdminOrderLookup
  refunds: RefundDto[]
  onBack: () => void
  onRefundIssued: () => void
}) {
  const refundedTotal = refunds
    .filter((r) => r.status === "succeeded")
    .reduce((sum, r) => sum + r.amountCents, 0)
  const remaining = Math.max(0, order.totalCents - refundedTotal)
  const refundedPct = order.totalCents > 0 ? (refundedTotal / order.totalCents) * 100 : 0

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to queue
      </button>

      {/* Order overview */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <code className="text-lg font-medium">{order.orderNumber}</code>
                <StatusPill status={order.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                Placed {new Date(order.placedAt ?? order.createdAt).toLocaleString()}
                {order.buyerId && <> · buyer <code>{order.buyerId.slice(0, 8)}</code></>}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold tabular-nums">{fmt(order.totalCents, order.currency)}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">order total</div>
            </div>
          </div>

          {/* Refund progress bar */}
          {order.totalCents > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Refunded {fmt(refundedTotal, order.currency)} of {fmt(order.totalCents, order.currency)}
                </span>
                <span className="font-medium tabular-nums">
                  {refundedPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{ width: `${Math.min(100, refundedPct)}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
            <Stat label="Subtotal"  cents={order.subtotalCents} currency={order.currency} />
            <Stat label="Refunded"  cents={refundedTotal}      currency={order.currency} dim={refundedTotal === 0} />
            <Stat label="Refundable" cents={remaining}          currency={order.currency} highlight={remaining > 0} />
          </div>

          {/* Ship-to */}
          {order.shipLine1 && (
            <div className="pt-4 border-t border-border">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Ship to</p>
              <div className="text-sm space-y-0.5">
                <div className="font-medium">{order.recipientName}</div>
                <div className="text-muted-foreground">{order.shipLine1}</div>
                {order.shipLine2 && <div className="text-muted-foreground">{order.shipLine2}</div>}
                <div className="text-muted-foreground">
                  {order.shipCity}{order.shipStateRegion ? `, ${order.shipStateRegion}` : ""} {order.shipPostalCode} {order.shipCountryCode}
                </div>
                {order.shipPhone && <div className="text-muted-foreground font-mono text-xs">{order.shipPhone}</div>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Refund form (3 cols) */}
        <div className="lg:col-span-3">
          {remaining > 0 ? (
            <RefundForm order={order} maxCents={remaining} onIssued={onRefundIssued} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                <p className="font-medium">Fully refunded</p>
                <p className="text-sm text-muted-foreground">
                  This order has been refunded in full. No further refund action available.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Refund history (2 cols) */}
        <div className="lg:col-span-2">
          <Card className="p-0">
            <CardHeader className="bg-muted/30 border-b border-border py-3">
              <CardTitle className="text-base flex items-center gap-2">
                History
                <Badge variant="outline" className="font-normal">{refunds.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {refunds.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No refunds yet for this order.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {refunds.map((r) => <RefundEntry key={r.id} r={r} />)}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, cents, currency, dim, highlight }: {
  label: string; cents: number; currency: string; dim?: boolean; highlight?: boolean
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${
        dim ? "text-muted-foreground"
        : highlight ? "text-emerald-700 dark:text-emerald-400"
        : ""
      }`}>
        {fmt(cents, currency)}
      </div>
    </div>
  )
}

function RefundForm({ order, maxCents, onIssued }: {
  order: AdminOrderLookup
  maxCents: number
  onIssued: () => void
}) {
  const [amount, setAmount] = useState<string>((maxCents / 100).toFixed(2))
  const [reason, setReason] = useState("buyer_cancel")
  const [subOrderId, setSubOrderId] = useState("")
  const [reverseTransfer, setReverseTransfer] = useState(
    !["pending", "payment_failed", "cancelled"].includes(order.status),
  )
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormErr(null); setOk(null)
    const cents = Math.round(parseFloat(amount) * 100)
    if (!cents || cents <= 0) { setFormErr("Enter a positive amount."); return }
    if (cents > maxCents) { setFormErr(`Cannot exceed remaining refundable (${fmt(maxCents, order.currency)}).`); return }
    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const created = await adminCreateRefund(token, {
        orderNumber: order.orderNumber,
        subOrderId: subOrderId.trim() || undefined,
        amountCents: cents,
        reason,
        idempotencyKey: `admin:${order.orderNumber}:${cents}:${reason}:${Date.now()}`,
        reverseTransfer,
        notes: notes.trim() || undefined,
      })
      setOk(`Refund ${created.id.slice(0, 8)} → ${created.status}`)
      setNotes("")
      onIssued()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "refund failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" /> Issue a refund
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <input
                  type="number" step="0.01" min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-border rounded-md pl-7 pr-20 py-2 bg-background tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
                <button
                  type="button"
                  onClick={() => setAmount((maxCents / 100).toFixed(2))}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-muted hover:bg-muted/70 text-muted-foreground"
                >
                  Max
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Up to {fmt(maxCents, order.currency)}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          {order.subOrders && order.subOrders.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sub-order <span className="lowercase font-normal normal-case">(optional)</span>
              </label>
              <select
                value={subOrderId}
                onChange={(e) => setSubOrderId(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              >
                <option value="">Whole order ({order.subOrders.length} sellers)</option>
                {order.subOrders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id.slice(0, 8)} · store {s.storeId.slice(0, 8)} · {fmt(s.subtotalCents, order.currency)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-start gap-2.5 p-3 rounded-md border border-border bg-muted/30 cursor-pointer hover:bg-muted/50">
            <input
              type="checkbox"
              checked={reverseTransfer}
              onChange={(e) => setReverseTransfer(e.target.checked)}
              className="mt-0.5"
            />
            <div className="text-sm">
              <div className="font-medium">Reverse Transfer</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Claw back funds from the seller's Connect balance. Required when payouts have already settled.
              </div>
            </div>
          </label>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder="Internal notes (not shown to buyer)…"
              className="w-full border border-border rounded-md px-3 py-2 bg-background min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          {formErr && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2 dark:bg-red-950/40 dark:border-red-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /><span>{formErr}</span>
            </div>
          )}
          {ok && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3 flex items-start gap-2 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /><span>{ok}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-[11px] text-muted-foreground max-w-md">
              Stripe is called with an idempotency key — re-submitting the same form won't double-refund.
            </p>
            <Button variant="destructive" type="submit" disabled={submitting}>
              {submitting ? "Refunding…" : "Issue refund"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function RefundEntry({ r }: { r: RefundDto }) {
  const Icon = r.status === "succeeded" ? CheckCircle2
    : r.status === "failed" ? XCircle : Clock
  const tone =
    r.status === "succeeded" ? "text-emerald-600"
    : r.status === "failed" ? "text-red-600"
    : "text-blue-600"
  return (
    <li className="p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-3.5 w-3.5 ${tone}`} />
          <span className="font-semibold tabular-nums">{fmt(r.amountCents, r.currency)}</span>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground ml-5">
        {r.reason.replace(/_/g, " ")} · by {r.initiatedBy}
      </div>
      {r.failureMessage && (
        <div className="text-[11px] text-red-700 mt-1 ml-5">{r.failureMessage}</div>
      )}
      {r.stripeRefundId && (
        <code className="text-[10px] text-muted-foreground mt-1 ml-5 block truncate">{r.stripeRefundId}</code>
      )}
    </li>
  )
}
