"use client"

import { useCallback, useEffect, useState } from "react"
import {
  BookOpen, RefreshCcw, AlertTriangle, Search, Download, TrendingUp,
  Wallet, ArrowUpRight, ArrowDownRight, Users,
} from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import {
  ACCOUNTING_ACCOUNTS,
  ApiError,
  adminLedgerAccountBalance,
  adminLedgerBackfill,
  adminLedgerSellerBalance,
  adminLedgerSummary,
  type AccountBalanceDto,
  type LedgerSummaryDto,
  type SellerLedgerBalanceDto,
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

export default function AdminAccountingPage() {
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
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
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
