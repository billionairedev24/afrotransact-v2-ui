"use client"

import { useState } from "react"
import { Banknote, Search, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import {
  adminCreateRefund,
  adminListRefundsByOrder,
  type RefundDto,
} from "@/lib/api"

const fmt = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100)

const REASON_OPTIONS = [
  "admin_refund",
  "buyer_cancel",
  "fraud",
  "goodwill",
  "dispute_lost",
  "seller_suspended_grace_expired",
  "other",
]

export default function AdminRefundsPage() {
  const [orderId, setOrderId] = useState("")
  const [refunds, setRefunds] = useState<RefundDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // form
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("admin_refund")
  const [subOrderId, setSubOrderId] = useState("")
  const [reverseTransfer, setReverseTransfer] = useState(false)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [submitOk, setSubmitOk] = useState<string | null>(null)

  async function lookup() {
    const id = orderId.trim()
    if (!id) return
    setLoading(true)
    setError(null)
    setRefunds([])
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const data = await adminListRefundsByOrder(token, id)
      setRefunds(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "lookup failed")
    } finally {
      setLoading(false)
    }
  }

  async function issueRefund(e: React.FormEvent) {
    e.preventDefault()
    setSubmitErr(null)
    setSubmitOk(null)
    const amountCents = Math.round(parseFloat(amount) * 100)
    if (!amountCents || amountCents <= 0) {
      setSubmitErr("Enter a positive amount.")
      return
    }
    if (!orderId.trim()) {
      setSubmitErr("Look up an order first.")
      return
    }
    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const idempotencyKey = `admin:${orderId}:${amountCents}:${reason}:${Date.now()}`
      const created = await adminCreateRefund(token, {
        orderId: orderId.trim(),
        subOrderId: subOrderId.trim() || undefined,
        amountCents,
        reason,
        idempotencyKey,
        reverseTransfer,
        notes: notes.trim() || undefined,
      })
      setSubmitOk(`Refund ${created.id.slice(0, 8)} ${created.status}`)
      setAmount(""); setSubOrderId(""); setNotes(""); setReverseTransfer(false)
      await lookup()
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "refund failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Banknote className="h-6 w-6" /> Refunds
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Issue and inspect refunds. Every refund routes through the canonical
          RefundService — durable Refund row, Stripe call with idempotency,
          payment.refunded event consumed by accounting + order services.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Order UUID"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          className="flex-1 border border-border rounded px-3 py-2 bg-background text-sm font-mono"
          onKeyDown={(e) => e.key === "Enter" && lookup()}
        />
        <button
          onClick={lookup}
          disabled={loading || !orderId.trim()}
          className="inline-flex items-center gap-1 bg-foreground text-background px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
        >
          <Search className="h-4 w-4" /> {loading ? "Looking…" : "Look up"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-4">
          {error}
        </div>
      )}

      {refunds.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Refunds for this order
          </h2>
          <ul className="space-y-2">
            {refunds.map((r) => <RefundRow key={r.id} r={r} />)}
          </ul>
        </section>
      ) : orderId && !loading && !error ? (
        <div className="text-sm text-muted-foreground mb-6">No refunds yet for this order.</div>
      ) : null}

      {orderId && (
        <section className="border border-border rounded-md bg-card">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="w-full text-left px-5 py-3 font-medium hover:bg-muted/50 rounded-md"
          >
            {showForm ? "▾ Hide refund form" : "▸ Issue a new refund"}
          </button>

          {showForm && (
            <form onSubmit={issueRefund} className="px-5 pb-5 space-y-4 border-t border-border pt-4">
              <div>
                <label className="block text-sm font-medium mb-1">Amount (USD) *</label>
                <input
                  type="number" step="0.01" min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-border rounded px-3 py-2 bg-background"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reason *</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border border-border rounded px-3 py-2 bg-background"
                  required
                >
                  {REASON_OPTIONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Sub-order UUID <span className="text-muted-foreground font-normal">(optional — whole-order refund if blank)</span>
                </label>
                <input
                  type="text"
                  value={subOrderId}
                  onChange={(e) => setSubOrderId(e.target.value)}
                  className="w-full border border-border rounded px-3 py-2 bg-background font-mono text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reverseTransfer}
                  onChange={(e) => setReverseTransfer(e.target.checked)}
                />
                <span>Reverse Transfer (claw back from seller's Connect balance — required when funds have already settled to the seller)</span>
              </label>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                  className="w-full border border-border rounded px-3 py-2 bg-background min-h-[80px]"
                />
              </div>

              {submitErr && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{submitErr}</span>
                </div>
              )}
              {submitOk && (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{submitOk}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-red-600 text-white px-4 py-2 rounded font-medium disabled:opacity-50"
                >
                  {submitting ? "Refunding…" : "Issue refund"}
                </button>
                <span className="text-xs text-muted-foreground">
                  Stripe is called with an idempotency key derived from the order + amount + timestamp.
                </span>
              </div>
            </form>
          )}
        </section>
      )}
    </main>
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
  return (
    <li className={`border rounded-md p-3 ${cls}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 ${r.status === "succeeded" ? "text-emerald-600" : r.status === "failed" ? "text-red-600" : "text-blue-600"}`} />
          <code className="text-xs">{r.id.slice(0, 8)}</code>
          <span className="text-sm font-medium">{fmt(r.amountCents, r.currency)}</span>
          <span className="text-xs text-muted-foreground">{r.reason} · {r.initiatedBy}</span>
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {new Date(r.createdAt).toLocaleString()}
        </div>
      </div>
      {r.failureMessage && (
        <div className="text-xs text-red-700 mt-2 ml-6">{r.failureMessage}</div>
      )}
      {r.stripeRefundId && (
        <div className="text-xs text-muted-foreground mt-1 ml-6 font-mono">{r.stripeRefundId}</div>
      )}
    </li>
  )
}
