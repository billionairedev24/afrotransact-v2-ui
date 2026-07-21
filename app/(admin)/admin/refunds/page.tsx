"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Banknote, Search, AlertTriangle, CheckCircle2, Clock, XCircle, RefreshCcw, Camera,
  ChevronRight, Package, ArrowLeft, MessageSquare, Send, Undo2,
} from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import { storeDisplayName } from "@/lib/house-store"
import { ApiError } from "@/lib/api"
import { friendlyMessage, logError } from "@/lib/errors"
import {
  adminCreateRefund,
  adminGetOrderByNumber,
  adminGetRefundQueue,
  adminListRefundsByOrderNumber,
  adminListReturns,
  adminListOrderMessages,
  adminSendOrderMessage,
  type AdminOrderLookup,
  type RefundDto,
  type ReturnDto,
  type OrderMessageDto,
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

const STATUS_BADGE: Record<string, string> = {
  cancelled:        "bg-red-50 text-red-700 border-red-200",
  refund_requested: "bg-amber-50 text-amber-700 border-amber-200",
  payment_failed:   "bg-gray-100 text-gray-600 border-gray-200",
  pending:          "bg-blue-50 text-blue-700 border-blue-200",
  paid:             "bg-emerald-50 text-emerald-700 border-emerald-200",
  shipped:          "bg-emerald-50 text-emerald-700 border-emerald-200",
  delivered:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  refunded:         "bg-violet-50 text-violet-700 border-violet-200",
  partially_refunded: "bg-violet-50 text-violet-700 border-violet-200",
}

export default function AdminRefundsPage() {
  const [view, setView] = useState<"queue" | "order">("queue")
  const [tab, setTab] = useState<"refunds" | "returns">("refunds")

  // Queue state
  const [queue, setQueue] = useState<AdminOrderLookup[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueErr, setQueueErr] = useState<string | null>(null)

  // Returns state
  const [returns, setReturns] = useState<ReturnDto[]>([])
  const [returnsLoading, setReturnsLoading] = useState(true)
  const [returnsErr, setReturnsErr] = useState<string | null>(null)

  // Search / detail state
  const [orderNumber, setOrderNumber] = useState("")
  const [order, setOrder] = useState<AdminOrderLookup | null>(null)
  const [refunds, setRefunds] = useState<RefundDto[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    setQueueLoading(true)
    setQueueErr(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const res = await adminGetRefundQueue(token, 0, 25)
      setQueue(res.content)
    } catch (e) {
      logError(e, "refunds.loadQueue")
      if (e instanceof ApiError && e.status === 401) {
        setQueueErr("Your admin session has expired. Please sign in again.")
      } else {
        setQueueErr(friendlyMessage(e, "Couldn't load the refund queue. Please try again."))
      }
    } finally {
      setQueueLoading(false)
    }
  }, [])

  const loadReturns = useCallback(async () => {
    setReturnsLoading(true)
    setReturnsErr(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const res = await adminListReturns(token, { page: 0 })
      setReturns(res.content)
    } catch (e) {
      logError(e, "refunds.loadReturns")
      if (e instanceof ApiError && e.status === 401) {
        setReturnsErr("Your admin session has expired. Please sign in again.")
      } else {
        setReturnsErr(friendlyMessage(e, "Couldn't load the returns queue. Please try again."))
      }
    } finally {
      setReturnsLoading(false)
    }
  }, [])

  useEffect(() => { void loadQueue() }, [loadQueue])
  useEffect(() => { void loadReturns() }, [loadReturns])

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
      setOrder(o)
      setRefunds(rs)
      setView("order")
    } catch (e) {
      logError(e, "refunds.loadOrder")
      if (e instanceof ApiError && (e.status === 404 || e.status === 400)) {
        setErr(`No order matches "${n}". Make sure you're using the order number (e.g. ORD-…), not a buyer or seller UUID.`)
      } else if (e instanceof ApiError && e.status === 401) {
        setErr("Your admin session has expired. Please sign in again.")
      } else {
        setErr(friendlyMessage(e, "Couldn't load that order. Please try again."))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-w-0">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6" /> Refunds &amp; Returns
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {view === "order"
              ? "Order detail, refund actions & customer messaging. Every refund routes through the canonical pipeline (durable record + Stripe idempotency + accounting event)."
              : tab === "refunds"
                ? "Orders waiting on refund action. Cancelled orders, customer refund requests, and failed payments appear here automatically."
                : "Return requests across all stores. Review buyer reasons and message customers directly."}
          </p>
        </div>
        {view === "queue" && (
          <button
            onClick={() => (tab === "refunds" ? void loadQueue() : void loadReturns())}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        )}
      </div>

      {/* Segmented Refunds | Returns toggle */}
      {view === "queue" && (
        <div className="inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5 mb-6">
          <button
            onClick={() => setTab("refunds")}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === "refunds" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Banknote className="h-4 w-4" /> Refunds
          </button>
          <button
            onClick={() => setTab("returns")}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === "returns" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Undo2 className="h-4 w-4" /> Returns
          </button>
        </div>
      )}

      {/* Quick search bar — always visible */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Search by order number (e.g. ORD-1781018602915-3718E3)"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          className="flex-1 border border-border rounded px-3 py-2 bg-background text-sm font-mono"
          onKeyDown={(e) => e.key === "Enter" && loadOrder(orderNumber)}
        />
        <button
          onClick={() => loadOrder(orderNumber)}
          disabled={loading || !orderNumber.trim()}
          className="inline-flex items-center gap-1 bg-foreground text-background px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
        >
          <Search className="h-4 w-4" /> {loading ? "Looking…" : "Find order"}
        </button>
      </div>

      {err && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-4">{err}</div>
      )}

      {view === "queue" ? (
        tab === "refunds" ? (
          <RefundQueueView queue={queue} loading={queueLoading} err={queueErr} onOpen={(n) => loadOrder(n)} />
        ) : (
          <ReturnsQueueView returns={returns} loading={returnsLoading} err={returnsErr} onOpen={(n) => loadOrder(n)} />
        )
      ) : order ? (
        <OrderDetailView
          order={order}
          refunds={refunds}
          onBack={() => { setView("queue"); setOrder(null); setRefunds([]); setErr(null) }}
          onRefundIssued={async () => {
            const rs = await adminListRefundsByOrderNumber(
              (await getAccessToken()) ?? "",
              order.orderNumber,
            ).catch(() => [])
            setRefunds(rs)
            // Reload the queue too in case it changed
            void loadQueue()
          }}
        />
      ) : null}
    </main>
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
  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading queue…</div>
  }
  if (err) {
    return <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{err}</div>
  }
  if (queue.length === 0) {
    return (
      <div className="border border-dashed border-border rounded p-12 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
        <div className="text-sm font-medium">Refund queue clear.</div>
        <div className="text-xs text-muted-foreground mt-1">
          No orders are currently waiting on refund action.
        </div>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border border border-border rounded-md bg-card">
      {queue.map((o) => (
        <li key={o.id}>
          <button
            onClick={() => onOpen(o.orderNumber)}
            className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <code className="text-sm font-medium">{o.orderNumber}</code>
                <StatusPill status={o.status} />
                <ProofPill subOrders={o.subOrders} />
              </div>
              <div className="text-xs text-muted-foreground">
                {o.recipientName ?? "Unknown recipient"} ·{" "}
                {o.shipCity ? `${o.shipCity}, ${o.shipStateRegion ?? ""}` : "no shipping address"} ·{" "}
                {o.placedAt || o.createdAt ? new Date(o.placedAt ?? o.createdAt).toLocaleString() : "—"}
              </div>
            </div>
            <div className="text-right flex items-center gap-3 shrink-0">
              <div>
                <div className="text-sm font-semibold">{fmt(o.totalCents, o.currency)}</div>
                <div className="text-[10px] text-muted-foreground">order total</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

const RETURN_STATUS_BADGE: Record<string, string> = {
  requested:              "bg-amber-50 text-amber-700 border-amber-200",
  approved:               "bg-blue-50 text-blue-700 border-blue-200",
  approved_partial:       "bg-blue-50 text-blue-700 border-blue-200",
  denied:                 "bg-red-50 text-red-700 border-red-200",
  label_issued:           "bg-indigo-50 text-indigo-700 border-indigo-200",
  in_transit:             "bg-indigo-50 text-indigo-700 border-indigo-200",
  received:               "bg-violet-50 text-violet-700 border-violet-200",
  inspected:              "bg-violet-50 text-violet-700 border-violet-200",
  completed:              "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected_on_inspection: "bg-red-50 text-red-700 border-red-200",
  cancelled:              "bg-gray-100 text-gray-600 border-gray-200",
  expired:                "bg-gray-100 text-gray-600 border-gray-200",
}

function ReturnStatusPill({ status }: { status: string }) {
  const cls = RETURN_STATUS_BADGE[status] ?? "bg-gray-100 text-gray-600 border-gray-200"
  return (
    <span className={`inline-flex items-center text-[10px] font-medium border rounded px-1.5 py-0.5 ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  )
}

function ReturnsQueueView({
  returns, loading, err, onOpen,
}: {
  returns: ReturnDto[]
  loading: boolean
  err: string | null
  onOpen: (orderNumber: string) => void
}) {
  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading returns…</div>
  }
  if (err) {
    return <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{err}</div>
  }
  if (returns.length === 0) {
    return (
      <div className="border border-dashed border-border rounded p-12 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
        <div className="text-sm font-medium">No return requests.</div>
        <div className="text-xs text-muted-foreground mt-1">
          Return requests from buyers across all stores appear here.
        </div>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border border border-border rounded-md bg-card">
      {returns.map((r) => {
        const itemCount = (r.items ?? []).reduce((n, it) => n + (it.quantity ?? 0), 0)
        return (
          <li key={r.id}>
            <button
              onClick={() => onOpen(r.orderNumber)}
              className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <code className="text-sm font-medium">{r.orderNumber}</code>
                  <ReturnStatusPill status={r.status} />
                  <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    {r.reason.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                  {r.storeId ? ` · ${storeDisplayName(r.storeId)}` : ""}
                  {r.buyerNotes ? ` · “${r.buyerNotes.slice(0, 80)}${r.buyerNotes.length > 80 ? "…" : ""}”` : ""}
                </div>
              </div>
              <div className="text-right flex items-center gap-3 shrink-0">
                <div>
                  {typeof r.refundAmountCents === "number" && r.refundAmountCents > 0 && (
                    <div className="text-sm font-semibold">{fmt(r.refundAmountCents)}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function CustomerMessagePanel({ orderNumber }: { orderNumber: string }) {
  const [messages, setMessages] = useState<OrderMessageDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [sendErr, setSendErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setLoadErr(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const res = await adminListOrderMessages(token, orderNumber)
      setMessages(res)
    } catch (e) {
      logError(e, "refunds.loadMessages")
      setLoadErr(friendlyMessage(e, "Couldn't load the message thread."))
    } finally {
      setLoading(false)
    }
  }, [orderNumber])

  useEffect(() => { void load() }, [load])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setSending(true); setSendErr(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const created = await adminSendOrderMessage(token, orderNumber, body)
      setMessages((prev) => [...prev, created])
      setDraft("")
    } catch (e) {
      logError(e, "refunds.sendMessage")
      setSendErr(friendlyMessage(e, "Couldn't send the message. Please try again."))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="border border-border rounded-md bg-card p-5">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" /> Message the customer
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Messages are delivered to the customer by email. Keep it professional — the buyer sees exactly what you send.
      </p>

      {/* Thread */}
      <div className="mb-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading messages…</div>
        ) : loadErr ? (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{loadErr}</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded p-4 text-center">
            No messages yet. Start the conversation below.
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <span className="inline-flex items-center rounded bg-foreground text-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Admin</span>
                    {m.adminEmail && <span className="text-muted-foreground font-normal">{m.adminEmail}</span>}
                  </span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}
                  </span>
                </div>
                <div className="text-sm whitespace-pre-wrap">{m.body}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={send} className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          placeholder="Write a message to the customer…"
          className="w-full border border-border rounded px-3 py-2 bg-background min-h-[80px] text-sm"
        />
        {sendErr && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /><span>{sendErr}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="inline-flex items-center gap-1.5 bg-foreground text-background px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send message"}
          </button>
          <span className="text-xs text-muted-foreground">
            Delivered to the customer&apos;s email.
          </span>
        </div>
      </form>
    </section>
  )
}

function ProofPill({ subOrders }: { subOrders?: AdminOrderLookup["subOrders"] }) {
  const hasProof = (subOrders ?? []).some((s) => !!s.deliveryProofImageUrl)
  return hasProof ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200"
      title="Delivery proof on file">
      <Camera className="h-3 w-3" /> Proof
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5 bg-amber-50 text-amber-700 border-amber-200"
      title="No delivery proof uploaded">
      <AlertTriangle className="h-3 w-3" /> No proof
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? "bg-gray-100 text-gray-600 border-gray-200"
  return (
    <span className={`inline-flex items-center text-[10px] font-medium border rounded px-1.5 py-0.5 ${cls}`}>
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

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to refund queue
      </button>

      {/* Order summary card */}
      <section className="border border-border rounded-md p-5 bg-card">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <code className="text-base font-medium">{order.orderNumber}</code>
              <StatusPill status={order.status} />
            </div>
            <div className="text-xs text-muted-foreground">
              Placed {new Date(order.placedAt ?? order.createdAt).toLocaleString()} · Buyer{" "}
              <code>{(order.buyerId ?? "").slice(0, 8)}</code>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold">{fmt(order.totalCents, order.currency)}</div>
            <div className="text-xs text-muted-foreground">order total</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
          <Stat label="Subtotal"        cents={order.subtotalCents} currency={order.currency} />
          <Stat label="Already refunded" cents={refundedTotal} currency={order.currency} dimWhenZero />
          <Stat label="Remaining refundable" cents={remaining} currency={order.currency} highlight />
        </div>

        {order.shipLine1 && (
          <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
            <div className="font-medium text-foreground mb-1">Ship to</div>
            <div>{order.recipientName}</div>
            <div>{order.shipLine1}</div>
            <div>{order.shipCity}, {order.shipStateRegion} {order.shipPostalCode} {order.shipCountryCode}</div>
            {order.shipPhone && <div>{order.shipPhone}</div>}
          </div>
        )}
      </section>

      {/* Delivery proof — evidence for the refund investigation */}
      <DeliveryProofSection subOrders={order.subOrders ?? []} />

      {/* Admin ↔ customer messaging */}
      <CustomerMessagePanel orderNumber={order.orderNumber} />

      {/* Existing refunds */}
      {refunds.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Refund history ({refunds.length})
          </h2>
          <ul className="space-y-2">
            {refunds.map((r) => <RefundRow key={r.id} r={r} />)}
          </ul>
        </section>
      )}

      {/* Issue refund form — only show if there's something to refund */}
      {remaining > 0 ? (
        <RefundForm order={order} maxCents={remaining} onIssued={onRefundIssued} />
      ) : (
        <div className="border border-emerald-200 bg-emerald-50 rounded p-4 text-sm text-emerald-800 inline-flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          This order has been fully refunded.
        </div>
      )}
    </div>
  )
}

function DeliveryProofSection({ subOrders }: { subOrders: NonNullable<AdminOrderLookup["subOrders"]> }) {
  if (subOrders.length === 0) return null
  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Delivery proof{subOrders.length > 1 ? ` (${subOrders.length} shipments)` : ""}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {subOrders.map((s) => (
          <div key={s.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="font-medium text-foreground">Shipment {s.id.slice(0, 8)}</span>
              <span className="capitalize text-muted-foreground">
                {(s.trackingStatus || s.fulfillmentStatus || "—").replace(/_/g, " ")}
              </span>
            </div>
            {s.deliveryProofImageUrl ? (
              <>
                <a href={s.deliveryProofImageUrl} target="_blank" rel="noopener noreferrer" className="block" title="Open full-size proof">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.deliveryProofImageUrl}
                    alt="Delivery proof"
                    className="w-full h-40 object-cover rounded-md border border-border hover:opacity-90 transition-opacity"
                  />
                </a>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {s.deliveryProofUploadedAt
                    ? `Proof uploaded ${new Date(s.deliveryProofUploadedAt).toLocaleString()}`
                    : "Proof uploaded"}
                  {s.trackingNumber && <> · Tracking <span className="font-mono">{s.trackingNumber}</span></>}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 h-40 rounded-md border border-dashed border-border text-xs text-muted-foreground text-center px-3">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>No delivery proof uploaded</span>
                {s.trackingNumber && <span className="font-mono text-[10px]">Tracking {s.trackingNumber}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function Stat({ label, cents, currency, dimWhenZero, highlight }: {
  label: string; cents: number; currency: string; dimWhenZero?: boolean; highlight?: boolean
}) {
  const dim = dimWhenZero && cents === 0
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-semibold ${dim ? "text-muted-foreground" : highlight ? "text-emerald-700" : ""}`}>
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
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setOk(null)
    const cents = Math.round(parseFloat(amount) * 100)
    if (!cents || cents <= 0) { setErr("Enter a positive amount."); return }
    if (cents > maxCents) { setErr(`Cannot exceed remaining refundable amount (${fmt(maxCents, order.currency)}).`); return }
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
      setAmount(""); setNotes("")
      onIssued()
    } catch (e) {
      logError(e, "refunds.issue")
      setErr(friendlyMessage(e, "Couldn't issue the refund. Please try again."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="border border-border rounded-md bg-card p-5">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
        <Package className="h-4 w-4" /> Issue a refund
      </h2>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Amount *</label>
            <div className="flex gap-2">
              <input
                type="number" step="0.01" min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 border border-border rounded px-3 py-2 bg-background"
                required
              />
              <button
                type="button"
                onClick={() => setAmount((maxCents / 100).toFixed(2))}
                className="text-xs text-muted-foreground hover:text-foreground px-2"
              >
                Full ({fmt(maxCents, order.currency)})
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-border rounded px-3 py-2 bg-background"
              required
            >
              {REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        {order.subOrders && order.subOrders.length > 1 && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Sub-order <span className="text-muted-foreground font-normal">(optional — refund a single seller's portion)</span>
            </label>
            <select
              value={subOrderId}
              onChange={(e) => setSubOrderId(e.target.value)}
              className="w-full border border-border rounded px-3 py-2 bg-background"
            >
              <option value="">Whole order ({order.subOrders.length} sellers)</option>
              {order.subOrders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id.slice(0, 8)} · {storeDisplayName(s.storeId)} · {fmt(s.subtotalCents, order.currency)}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={reverseTransfer}
            onChange={(e) => setReverseTransfer(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Reverse Transfer</span>
            <span className="block text-xs text-muted-foreground">
              Claw back from the seller's Connect balance. Required when funds have already settled to the seller.
              Auto-checked based on order status.
            </span>
          </span>
        </label>

        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            placeholder="Internal notes (not shown to buyer)…"
            className="w-full border border-border rounded px-3 py-2 bg-background min-h-[80px]"
          />
        </div>

        {err && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /><span>{err}</span>
          </div>
        )}
        {ok && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /><span>{ok}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-red-600 text-white px-5 py-2 rounded font-medium disabled:opacity-50"
          >
            {submitting ? "Refunding…" : "Issue refund"}
          </button>
          <span className="text-xs text-muted-foreground">
            Stripe is called with an idempotency key — re-submitting won't double-refund.
          </span>
        </div>
      </form>
    </section>
  )
}

function RefundRow({ r }: { r: RefundDto }) {
  const Icon = r.status === "succeeded" ? CheckCircle2
    : r.status === "failed" ? XCircle
    : Clock
  const cls =
    r.status === "succeeded" ? "border-emerald-200 bg-emerald-50/30"
    : r.status === "failed" ? "border-red-200 bg-red-50/30"
    : "border-blue-200 bg-blue-50/30"
  const iconColor =
    r.status === "succeeded" ? "text-emerald-600"
    : r.status === "failed" ? "text-red-600"
    : "text-blue-600"
  return (
    <li className={`border rounded-md p-3 ${cls}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <code className="text-xs">{r.id.slice(0, 8)}</code>
          <span className="text-sm font-medium">{fmt(r.amountCents, r.currency)}</span>
          <span className="text-xs text-muted-foreground">{r.reason.replace(/_/g, " ")} · by {r.initiatedBy}</span>
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {new Date(r.createdAt).toLocaleString()}
        </div>
      </div>
      {r.failureMessage && <div className="text-xs text-red-700 mt-2 ml-6">{r.failureMessage}</div>}
      {r.stripeRefundId && <div className="text-xs text-muted-foreground mt-1 ml-6 font-mono">{r.stripeRefundId}</div>}
    </li>
  )
}
