"use client"

import { useCallback, useEffect, useState } from "react"
import { Wallet, Search, Loader2, Plus, ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import { toast } from "sonner"

import { getAccessToken } from "@/lib/auth-helpers"
import { adminGetStoreCredit, adminGrantStoreCredit, type AdminStoreCreditView } from "@/lib/api"
import { friendlyMessage, logError } from "@/lib/errors"

const fmt = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)

export default function AdminStoreCreditPage() {
  const [userId, setUserId] = useState("")
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [view, setView] = useState<AdminStoreCreditView | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Grant form
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("overcharge_compensation")
  const [orderNumber, setOrderNumber] = useState("")
  const [granting, setGranting] = useState(false)

  // Prefill from ?userId= so a user/dispute row can deep-link here.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("userId")
    if (q) { setUserId(q); void load(q) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(async (id: string) => {
    const trimmed = id.trim()
    if (!trimmed) return
    setLoading(true); setErr(null); setView(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const res = await adminGetStoreCredit(token, trimmed)
      setView(res)
      setLoadedUserId(trimmed)
    } catch (e) {
      logError(e, "storeCredit.load")
      setErr(friendlyMessage(e, "Couldn't load store credit. Check the customer's user ID."))
    } finally {
      setLoading(false)
    }
  }, [])

  async function grant(e: React.FormEvent) {
    e.preventDefault()
    if (!loadedUserId) return
    const dollars = parseFloat(amount)
    if (!Number.isFinite(dollars) || dollars <= 0) { toast.error("Enter a valid amount."); return }
    setGranting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      await adminGrantStoreCredit(token, {
        userId: loadedUserId,
        amountCents: Math.round(dollars * 100),
        reason: reason.trim() || "admin_grant",
        orderNumber: orderNumber.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      toast.success(`Granted ${fmt(Math.round(dollars * 100))} store credit`)
      setAmount("")
      await load(loadedUserId)
    } catch (e) {
      logError(e, "storeCredit.grant")
      toast.error(friendlyMessage(e, "Couldn't grant store credit. Please try again."))
    } finally {
      setGranting(false)
    }
  }

  const inputCls = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Wallet className="h-6 w-6" /> Store credit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grant a customer store credit — e.g. compensating an overcharge in lieu of a refund. Unlike a coupon, store credit
          is a tracked balance: the customer keeps whatever they don&apos;t spend.
        </p>
      </div>

      {/* Lookup */}
      <form
        onSubmit={(e) => { e.preventDefault(); void load(userId) }}
        className="mb-6 flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Customer user ID (UUID)"
          className={`${inputCls} flex-1 font-mono`}
        />
        <button
          type="submit"
          disabled={loading || !userId.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Look up
        </button>
      </form>

      {err && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {view && (
        <div className="space-y-6">
          {/* Balance + grant */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current balance</div>
                <div className="mt-1 text-3xl font-bold tabular-nums text-foreground">{fmt(view.balanceCents)}</div>
              </div>
            </div>

            <form onSubmit={grant} className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-[1fr_1.4fr_1fr_auto] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Amount (USD)</span>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Reason</span>
                <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Order # (optional)</span>
                <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="e.g. NWECQ8V" className={`${inputCls} font-mono`} />
              </label>
              <button
                type="submit"
                disabled={granting}
                className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-xl bg-brand-gold px-4 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover disabled:opacity-50"
              >
                {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Grant
              </button>
            </form>
          </div>

          {/* Ledger */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-foreground">History</h2>
            {view.entries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No store-credit activity yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {view.entries.map((e) => {
                  const credit = e.deltaCents >= 0
                  return (
                    <li key={e.id} className="flex items-center gap-3 py-2.5">
                      {credit
                        ? <ArrowUpCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                        : <ArrowDownCircle className="h-4 w-4 shrink-0 text-red-500" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{e.reason.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.createdAt ? new Date(e.createdAt).toLocaleString() : ""}
                          {e.orderNumber ? ` · ${e.orderNumber}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 text-sm font-bold tabular-nums ${credit ? "text-emerald-700" : "text-red-600"}`}>
                        {credit ? "+" : "−"}{fmt(Math.abs(e.deltaCents))}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
