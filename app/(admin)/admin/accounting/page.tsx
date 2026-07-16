"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import {
  BookOpen, RefreshCcw, AlertTriangle, Search, Download, TrendingUp,
  Wallet, ArrowUpRight, ArrowDownRight, Users, ScrollText, Scale,
  ChevronRight, Package, CheckCircle2, XCircle,
} from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import {
  ACCOUNTING_ACCOUNTS,
  ApiError,
  adminLedgerAccountBalance,
  adminLedgerBackfill,
  adminLedgerSellerBalance,
  adminLedgerSummary,
  adminLedgerJournal,
  adminLedgerTrialBalance,
  type AccountBalanceDto,
  type LedgerSummaryDto,
  type SellerLedgerBalanceDto,
  type JournalEntryRow,
  type TrialBalance,
} from "@/lib/api"
import { friendlyMessage, logError } from "@/lib/errors"

const fmt = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100)

const ACCOUNT_TYPE_BADGE: Record<string, string> = {
  asset:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  liability:  "bg-amber-50  text-amber-700  border-amber-200",
  revenue:    "bg-blue-50   text-blue-700   border-blue-200",
  expense:    "bg-red-50    text-red-700    border-red-200",
  receivable: "bg-violet-50 text-violet-700 border-violet-200",
}

const TABS = [
  { key: "overview" as const, label: "Overview", icon: BookOpen },
  { key: "journal" as const, label: "Journal", icon: ScrollText },
  { key: "trial" as const, label: "Trial Balance", icon: Scale },
]

const TYPE_ORDER = ["asset", "liability", "revenue", "expense", "receivable"]
const TYPE_LABEL: Record<string, string> = {
  asset: "Assets", liability: "Liabilities", revenue: "Revenue",
  expense: "Expenses", receivable: "Receivables",
}

export default function AdminAccountingPage() {
  const [tab, setTab] = useState<"overview" | "journal" | "trial">("overview")
  const [summary, setSummary] = useState<LedgerSummaryDto | null>(null)
  const [balances, setBalances] = useState<Record<string, AccountBalanceDto | { error: string }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [backfillRunning, setBackfillRunning] = useState(false)
  const [backfillResult, setBackfillResult] = useState<string | null>(null)

  const [sellerId, setSellerId] = useState("")
  const [sellerBalance, setSellerBalance] = useState<SellerLedgerBalanceDto | null>(null)
  const [sellerLookupErr, setSellerLookupErr] = useState<string | null>(null)
  const [sellerLooking, setSellerLooking] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await getAccessToken()
      if (!token) { setError("Not signed in"); setLoading(false); return }

      // Summary (single call, fast)
      try { setSummary(await adminLedgerSummary(token)) } catch (e) {
        logError(e, "accounting.loadSummary")
        if (e instanceof ApiError && e.status === 401) {
          setError("Your admin session has expired. Please sign in again.")
        } else if (e instanceof ApiError && e.status === 403) {
          setError("You don't have permission to view the ledger.")
        } else {
          setError(friendlyMessage(e, "Couldn't load the ledger summary. Please try again."))
        }
      }

      // Per-account balances (parallel)
      const next: Record<string, AccountBalanceDto | { error: string }> = {}
      await Promise.all(
        ACCOUNTING_ACCOUNTS.map(async ({ code }) => {
          try { next[code] = await adminLedgerAccountBalance(token, code) }
          catch (e) {
            logError(e, "accounting.loadAccountBalance")
            next[code] = { error: friendlyMessage(e, "failed to load") }
          }
        }),
      )
      setBalances(next)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAll() }, [loadAll])

  async function runBackfill() {
    if (!confirm("Replay every existing payment and refund into the ledger. Safe to re-run — duplicates are skipped. Proceed?")) return
    setBackfillRunning(true); setBackfillResult(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const r = await adminLedgerBackfill(token)
      setBackfillResult(
        `Posted ${r.paymentsPosted} payments (${r.paymentsSkipped} already on ledger), ` +
        `${r.refundsPosted} refunds (${r.refundsSkipped} already on ledger).`,
      )
      await loadAll()
    } catch (e) {
      logError(e, "accounting.runBackfill")
      if (e instanceof ApiError && e.status === 401) {
        setBackfillResult("Your admin session has expired. Please sign in again.")
      } else if (e instanceof ApiError && e.status === 403) {
        setBackfillResult("You don't have permission to run the backfill.")
      } else {
        setBackfillResult(friendlyMessage(e, "Backfill failed. Please try again."))
      }
    } finally {
      setBackfillRunning(false)
    }
  }

  async function lookupSeller() {
    setSellerLookupErr(null); setSellerBalance(null)
    const id = sellerId.trim()
    if (!id) return
    setSellerLooking(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      setSellerBalance(await adminLedgerSellerBalance(token, id))
    } catch (e) {
      logError(e, "accounting.lookupSeller")
      if (e instanceof ApiError && e.status === 401) {
        setSellerLookupErr("Your admin session has expired. Please sign in again.")
      } else if (e instanceof ApiError && e.status === 403) {
        setSellerLookupErr("You don't have permission to view seller balances.")
      } else if (e instanceof ApiError && e.status === 404) {
        setSellerLookupErr("No seller matches that ID.")
      } else {
        setSellerLookupErr(friendlyMessage(e, "Couldn't look up that seller. Please try again."))
      }
    } finally {
      setSellerLooking(false)
    }
  }

  const empty = summary?.journalEntryCount === 0

  return (
    <main className="py-2">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Accounting
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Double-entry ledger. Postings flow in automatically from payment
            events; if the dashboard is empty, run the one-time backfill to
            replay existing Stripe charges into the ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runBackfill}
            disabled={backfillRunning}
            className="inline-flex items-center gap-1 text-sm border border-border rounded px-3 py-1.5 hover:bg-muted/50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {backfillRunning ? "Backfilling…" : empty ? "Run initial backfill" : "Re-run backfill"}
          </button>
          <button onClick={() => void loadAll()} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {backfillResult && (
        <div className="mb-4 text-sm border rounded p-3 bg-emerald-50 border-emerald-200 text-emerald-900">
          {backfillResult}
        </div>
      )}
      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "journal" && <JournalTab />}
      {tab === "trial" && <TrialBalanceTab />}

      {tab === "overview" && (
        <>
      {/* Headline cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <HeroCard
          label="Cash held in Stripe"
          icon={Wallet}
          value={summary ? fmt(summary.platformBalanceCents) : "—"}
          hint="stripe.platform_balance"
          good={(summary?.platformBalanceCents ?? 0) >= 0}
        />
        <HeroCard
          label="Commission revenue"
          icon={TrendingUp}
          value={summary ? fmt(summary.commissionRevenueCents) : "—"}
          hint="Lifetime"
          good
        />
        <HeroCard
          label="We owe sellers"
          icon={ArrowUpRight}
          value={summary ? fmt(summary.totalSellerPayableCents) : "—"}
          hint="seller_payable across all sellers"
          good={false}
        />
        <HeroCard
          label="Sellers owe us"
          icon={ArrowDownRight}
          value={summary ? fmt(summary.totalSellerOwedToPlatformCents) : "—"}
          hint="post-settlement clawbacks"
          good={false}
        />
      </section>

      {empty && !loading && (
        <div className="mb-8 border border-amber-200 bg-amber-50 rounded p-4 flex items-start gap-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <div className="font-medium text-amber-900">No ledger entries yet.</div>
            <div className="text-amber-800">
              The accounting consumer was added recently — it only sees payment
              events from now on. Click <strong>Run initial backfill</strong>{" "}
              above to replay every existing payment + refund from the database
              into the ledger.
            </div>
          </div>
        </div>
      )}

      {/* Top sellers */}
      {summary?.topSellers && summary.topSellers.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" /> Top sellers by payable
          </h2>
          <ul className="border border-border rounded-md bg-card divide-y divide-border">
            {summary.topSellers.map((s) => (
              <li key={s.seller_id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <code className="text-xs">{s.seller_id}</code>
                <span className="font-medium tabular-nums">{fmt(s.payable_cents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Per-seller lookup */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Per-seller balance lookup
        </h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Seller UUID"
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            className="flex-1 border border-border rounded px-3 py-2 bg-background text-sm font-mono"
            onKeyDown={(e) => e.key === "Enter" && lookupSeller()}
          />
          <button
            onClick={lookupSeller}
            disabled={sellerLooking || !sellerId.trim()}
            className="inline-flex items-center gap-1 bg-foreground text-background px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            <Search className="h-4 w-4" /> {sellerLooking ? "Looking…" : "Look up"}
          </button>
        </div>
        {sellerLookupErr && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-3">{sellerLookupErr}</div>
        )}
        {sellerBalance && (
          <div className="border border-border rounded-md p-5 bg-card">
            <code className="text-xs text-muted-foreground">{sellerBalance.sellerId}</code>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
              <SellerStat label="We owe seller" cents={sellerBalance.payableCents} positiveGood />
              <SellerStat label="Seller owes us" cents={sellerBalance.owedToPlatformCents} positiveGood={false} />
              <SellerStat label="Net (positive = we owe)" cents={sellerBalance.netOwedToSellerCents} positiveGood />
            </div>
          </div>
        )}
      </section>

      {/* Full chart of accounts */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Chart of accounts
        </h2>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ACCOUNTING_ACCOUNTS.map(({ code, label }) => {
              const v = balances[code]
              const isErr = v && "error" in v
              const balance = !isErr && v ? v.balanceCents : 0
              const type = !isErr && v ? v.type : "asset"
              const currency = !isErr && v ? v.currency : "USD"
              return (
                <div key={code} className="border border-border rounded-md p-4 bg-card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{label}</div>
                      <code className="text-xs text-muted-foreground truncate block">{code}</code>
                    </div>
                    <span className={`text-[10px] font-medium border rounded px-1.5 py-0.5 whitespace-nowrap ${ACCOUNT_TYPE_BADGE[type] ?? ""}`}>
                      {type}
                    </span>
                  </div>
                  {isErr ? (
                    <div className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {(v as { error: string }).error}
                    </div>
                  ) : (
                    <div className={`text-lg font-semibold tabular-nums ${balance < 0 ? "text-red-600" : ""}`}>
                      {fmt(balance, currency)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
        </>
      )}
    </main>
  )
}

function HeroCard({ label, icon: Icon, value, hint, good }: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  value: string
  hint: string
  good: boolean
}) {
  return (
    <div className="border border-border rounded-md p-5 bg-card">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={`h-4 w-4 ${good ? "text-emerald-600" : "text-amber-600"}`} />
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  )
}

function SellerStat({ label, cents, positiveGood }: { label: string; cents: number; positiveGood: boolean }) {
  const color = cents === 0
    ? "text-muted-foreground"
    : (cents > 0) === positiveGood
      ? "text-emerald-700"
      : "text-red-700"
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${color}`}>{fmt(cents)}</div>
    </div>
  )
}

const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

const EVENT_BADGE: Record<string, string> = {
  "payment.completed": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "payment.refunded":  "bg-red-50    text-red-700    border-red-200",
  "ledger.adjustment": "bg-violet-50 text-violet-700 border-violet-200",
}

// ── Journal (general journal / audit trail) ──────────────────────────────────
function JournalTab() {
  const LIMIT = 50
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [offset, setOffset] = useState(0)
  const [entries, setEntries] = useState<JournalEntryRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true); setErr(null)
      try {
        const token = await getAccessToken()
        if (!token) { if (!cancelled) setErr("Not signed in"); return }
        const page = await adminLedgerJournal(token, {
          from: from || undefined, to: to || undefined, limit: LIMIT, offset,
        })
        if (!cancelled) { setEntries(page.entries); setTotal(page.total) }
      } catch (e) {
        if (!cancelled) { logError(e, "accounting.journal"); setErr(friendlyMessage(e, "Couldn't load the journal.")) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [from, to, offset])

  return (
    <section>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-xs text-muted-foreground">
          From
          <input type="date" value={from}
            onChange={(e) => { setFrom(e.target.value); setOffset(0) }}
            className="block mt-1 border border-border rounded px-2 py-1.5 bg-background text-sm" />
        </label>
        <label className="text-xs text-muted-foreground">
          To
          <input type="date" value={to}
            onChange={(e) => { setTo(e.target.value); setOffset(0) }}
            className="block mt-1 border border-border rounded px-2 py-1.5 bg-background text-sm" />
        </label>
        {(from || to) && (
          <button onClick={() => { setFrom(""); setTo(""); setOffset(0) }}
            className="text-xs text-muted-foreground hover:text-foreground underline pb-2">Clear</button>
        )}
        <div className="ml-auto text-xs text-muted-foreground pb-2">
          {total} {total === 1 ? "entry" : "entries"}
        </div>
      </div>

      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-4">{err}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : entries && entries.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded p-6 text-center">
          No journal entries for this range.
        </div>
      ) : (
        <div className="space-y-2">
          {entries?.map((en) => {
            const isOpen = !!open[en.id]
            return (
              <div key={en.id} className="border border-border rounded-md bg-card overflow-hidden">
                <button
                  onClick={() => setOpen((o) => ({ ...o, [en.id]: !o[en.id] }))}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                >
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-medium border rounded px-1.5 py-0.5 ${EVENT_BADGE[en.eventType] ?? "bg-muted text-muted-foreground border-border"}`}>
                        {en.eventType}
                      </span>
                      <span className="text-sm text-foreground truncate">{en.description || "—"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(en.postedAt)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{fmt(en.totalDebitsCents)}</div>
                    {!en.balanced && <div className="text-[10px] text-red-600 font-medium">unbalanced</div>}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border bg-muted/20 px-4 py-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="text-left font-medium py-1">Account</th>
                          <th className="text-right font-medium py-1 w-28">Debit</th>
                          <th className="text-right font-medium py-1 w-28">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {en.lines.map((l, i) => (
                          <tr key={i} className="border-t border-border/60">
                            <td className="py-1.5">
                              <code className="text-xs">{l.accountCode}</code>
                              {l.orderId && <span className="text-[10px] text-muted-foreground ml-2">order {l.orderId.slice(0, 8)}</span>}
                            </td>
                            <td className="py-1.5 text-right tabular-nums">{l.direction === "DR" ? fmt(l.amountCents, l.currency) : ""}</td>
                            <td className="py-1.5 text-right tabular-nums">{l.direction === "CR" ? fmt(l.amountCents, l.currency) : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {total > LIMIT && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            className="border border-border rounded px-3 py-1.5 disabled:opacity-40 hover:bg-muted/50">Previous</button>
          <span className="text-xs text-muted-foreground">
            {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </span>
          <button disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}
            className="border border-border rounded px-3 py-1.5 disabled:opacity-40 hover:bg-muted/50">Next</button>
        </div>
      )}
    </section>
  )
}

// ── Trial balance + income statement + house/inventory ───────────────────────
function TrialBalanceTab() {
  const [asOf, setAsOf] = useState("")
  const [tb, setTb] = useState<TrialBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true); setErr(null)
      try {
        const token = await getAccessToken()
        if (!token) { if (!cancelled) setErr("Not signed in"); return }
        const data = await adminLedgerTrialBalance(token, asOf || undefined)
        if (!cancelled) setTb(data)
      } catch (e) {
        if (!cancelled) { logError(e, "accounting.trialBalance"); setErr(friendlyMessage(e, "Couldn't load the trial balance.")) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [asOf])

  const is = tb?.incomeStatement
  const house = tb?.house

  return (
    <section>
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <label className="text-xs text-muted-foreground">
          As of
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)}
            className="block mt-1 border border-border rounded px-2 py-1.5 bg-background text-sm" />
        </label>
        {asOf && (
          <button onClick={() => setAsOf("")} className="text-xs text-muted-foreground hover:text-foreground underline pb-2">
            All time
          </button>
        )}
      </div>

      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-4">{err}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : tb ? (
        <>
          {/* Balanced check */}
          <div className={`flex items-center gap-2 text-sm border rounded-md p-3 mb-6 ${
            tb.balanced ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
          }`}>
            {tb.balanced
              ? <><CheckCircle2 className="h-4 w-4" /> Balanced — total debits equal total credits ({fmt(tb.totalDebitsCents)}).</>
              : <><XCircle className="h-4 w-4" /> Out of balance by {fmt(Math.abs(tb.outOfBalanceCents))} — the books do not reconcile.</>}
          </div>

          {/* Income statement */}
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Income statement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard label="Revenue" cents={is?.revenueCents ?? 0} tone="emerald" />
            <StatCard label="Expenses" cents={is?.expenseCents ?? 0} tone="red" />
            <StatCard label="Net income" cents={is?.netIncomeCents ?? 0} tone={(is?.netIncomeCents ?? 0) >= 0 ? "emerald" : "red"} strong />
          </div>

          {/* House / inventory */}
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Package className="h-4 w-4" /> AfroTransact (house) goods &amp; inventory
          </h2>
          <div className="border border-border rounded-md bg-card p-5 mb-8 grid grid-cols-2 sm:grid-cols-5 gap-4">
            <MiniStat label="Sales revenue" cents={house?.salesRevenueCents ?? 0} />
            <MiniStat label="COGS" cents={house?.cogsCents ?? 0} />
            <MiniStat label="Gross profit" cents={house?.grossProfitCents ?? 0} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Gross margin</div>
              <div className="text-lg font-semibold tabular-nums">{(house?.grossMarginPct ?? 0).toFixed(1)}%</div>
            </div>
            <MiniStat label="Inventory book value" cents={house?.inventoryBookValueCents ?? 0} />
          </div>
          <p className="text-xs text-muted-foreground -mt-6 mb-8">
            Inventory book value is the ledger&apos;s <code>inventory.asset</code> balance — reconcile it against
            the stock valuation in the inventory system for AfroTransact products.
          </p>

          {/* Trial balance table */}
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Trial balance{tb.asOf ? ` as of ${fmtDateTime(tb.asOf)}` : ""}
          </h2>
          <div className="border border-border rounded-md bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-4 py-2">Account</th>
                  <th className="text-right font-medium px-4 py-2 w-36">Debit</th>
                  <th className="text-right font-medium px-4 py-2 w-36">Credit</th>
                </tr>
              </thead>
              <tbody>
                {TYPE_ORDER.filter((t) => tb.rows.some((r) => r.type === t)).map((type) => (
                  <Fragment key={type}>
                    <tr className="bg-muted/40">
                      <td colSpan={3} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {TYPE_LABEL[type] ?? type}
                      </td>
                    </tr>
                    {tb.rows.filter((r) => r.type === type).map((r) => (
                      <tr key={r.code} className="border-b border-border/60">
                        <td className="px-4 py-2">
                          <div className="text-foreground">{r.name}</div>
                          <code className="text-[10px] text-muted-foreground">{r.code}</code>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{r.debitCents ? fmt(r.debitCents) : ""}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{r.creditCents ? fmt(r.creditCents) : ""}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                <tr className="border-t-2 border-foreground font-semibold">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(tb.totalDebitsCents)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(tb.totalCreditsCents)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  )
}

function StatCard({ label, cents, tone, strong }: { label: string; cents: number; tone: "emerald" | "red"; strong?: boolean }) {
  const color = tone === "emerald" ? "text-emerald-700" : "text-red-700"
  return (
    <div className="border border-border rounded-md p-5 bg-card">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{label}</div>
      <div className={`${strong ? "text-2xl" : "text-xl"} font-semibold tabular-nums ${color}`}>{fmt(cents)}</div>
    </div>
  )
}

function MiniStat({ label, cents }: { label: string; cents: number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${cents < 0 ? "text-red-600" : ""}`}>{fmt(cents)}</div>
    </div>
  )
}
