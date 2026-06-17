"use client"

import { useCallback, useEffect, useState } from "react"
import {
  RefreshCcw, AlertTriangle, Search, Download, TrendingUp,
  Wallet, ArrowUpRight, ArrowDownRight, ChevronRight,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/Skeleton"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  ACCOUNTING_ACCOUNTS,
  adminLedgerAccountBalance,
  adminLedgerBackfill,
  adminLedgerSellerBalance,
  adminLedgerSummary,
  type AccountBalanceDto,
  type LedgerSummaryDto,
  type SellerLedgerBalanceDto,
} from "@/lib/api"

const fmt = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100)

const fmtCompact = (cents: number) => {
  const d = cents / 100
  if (Math.abs(d) >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`
  if (Math.abs(d) >= 10_000) return `$${(d / 1_000).toFixed(1)}k`
  return fmt(cents)
}

const ACCOUNT_TYPE_TONE: Record<string, string> = {
  asset:      "text-emerald-700 dark:text-emerald-400",
  liability:  "text-amber-700 dark:text-amber-400",
  revenue:    "text-blue-700 dark:text-blue-400",
  expense:    "text-red-700 dark:text-red-400",
  receivable: "text-violet-700 dark:text-violet-400",
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
      try { setSummary(await adminLedgerSummary(token)) }
      catch (e) { setError(e instanceof Error ? e.message : "summary load failed") }
      const next: Record<string, AccountBalanceDto | { error: string }> = {}
      await Promise.all(
        ACCOUNTING_ACCOUNTS.map(async ({ code }) => {
          try { next[code] = await adminLedgerAccountBalance(token, code) }
          catch (e) { next[code] = { error: e instanceof Error ? e.message : "failed" } }
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
        `Posted ${r.paymentsPosted} payments (${r.paymentsSkipped} skipped) · ${r.refundsPosted} refunds (${r.refundsSkipped} skipped)`,
      )
      await loadAll()
    } catch (e) {
      setBackfillResult(`Backfill failed: ${e instanceof Error ? e.message : String(e)}`)
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
      setSellerLookupErr(e instanceof Error ? e.message : "lookup failed")
    } finally {
      setSellerLooking(false)
    }
  }

  const empty = summary?.journalEntryCount === 0

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Accounting</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Double-entry ledger. Postings flow in automatically from payment events. The headline numbers below are the truth-of-record for finance reconciliation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={runBackfill} disabled={backfillRunning}>
            <Download className="h-4 w-4" />
            {backfillRunning ? "Backfilling…" : empty ? "Run backfill" : "Re-run backfill"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void loadAll()}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </header>

      {backfillResult && (
        <div className="text-sm border rounded-md p-3 bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200">
          {backfillResult}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 dark:bg-red-950/40 dark:border-red-900">
          {error}
        </div>
      )}

      {empty && !loading && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50">
          <CardContent className="flex items-start gap-3 p-5 text-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-amber-900 dark:text-amber-200">No ledger entries yet</p>
              <p className="text-amber-800 dark:text-amber-300/80">
                The accounting consumer was added recently and only sees events from now on. Run the one-time backfill to replay every payment + refund from the database.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Headline KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Cash held in Stripe"
          icon={Wallet}
          value={summary ? fmt(summary.platformBalanceCents) : null}
          loading={loading && !summary}
          tone="default"
          sublabel="stripe.platform_balance"
        />
        <Kpi
          label="Commission revenue"
          icon={TrendingUp}
          value={summary ? fmt(summary.commissionRevenueCents) : null}
          loading={loading && !summary}
          tone="positive"
          sublabel="lifetime"
        />
        <Kpi
          label="We owe sellers"
          icon={ArrowUpRight}
          value={summary ? fmt(summary.totalSellerPayableCents) : null}
          loading={loading && !summary}
          tone="warn"
          sublabel="across all sellers"
        />
        <Kpi
          label="Sellers owe us"
          icon={ArrowDownRight}
          value={summary ? fmt(summary.totalSellerOwedToPlatformCents) : null}
          loading={loading && !summary}
          tone="danger"
          sublabel="post-settlement clawbacks"
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top sellers */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Top sellers by payable</CardTitle>
              <Badge variant="outline" className="font-normal">
                {summary?.topSellers?.length ?? 0} of {summary?.topSellers?.length ?? 0}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !summary?.topSellers?.length ? (
              <div className="text-sm text-muted-foreground p-6 text-center">
                No seller payables yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/30 text-xs text-muted-foreground">
                    <th className="text-left font-medium px-4 py-2">Seller</th>
                    <th className="text-right font-medium px-4 py-2">Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topSellers.map((s) => (
                    <tr
                      key={s.seller_id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => { setSellerId(s.seller_id); void lookupSeller() }}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs">{s.seller_id}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{fmt(s.payable_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Per-seller lookup */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Per-seller lookup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Seller UUID"
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                className="flex-1 border border-border rounded-md px-3 py-2 bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                onKeyDown={(e) => e.key === "Enter" && lookupSeller()}
              />
              <Button size="sm" onClick={lookupSeller} disabled={sellerLooking || !sellerId.trim()}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {sellerLookupErr && (
              <p className="text-xs text-red-600">{sellerLookupErr}</p>
            )}
            {sellerBalance && (
              <div className="space-y-2 pt-2 border-t border-border">
                <SellerRow label="We owe" cents={sellerBalance.payableCents} tone="positive" />
                <SellerRow label="Owes us" cents={sellerBalance.owedToPlatformCents} tone="danger" />
                <SellerRow label="Net" cents={sellerBalance.netOwedToSellerCents} tone="default" bold />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart of accounts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Chart of accounts
          </h2>
          <span className="text-xs text-muted-foreground">
            {summary?.journalEntryCount ?? 0} journal entries
          </span>
        </div>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <th className="text-left font-medium px-4 py-2.5">Account</th>
                <th className="text-left font-medium px-4 py-2.5">Type</th>
                <th className="text-right font-medium px-4 py-2.5">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ACCOUNTING_ACCOUNTS.map(({ code, label }) => {
                const v = balances[code]
                const isErr = v && "error" in v
                const balance = !isErr && v ? v.balanceCents : 0
                const type = !isErr && v ? v.type : "asset"
                const currency = !isErr && v ? v.currency : "USD"
                return (
                  <tr key={code} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{label}</div>
                      <code className="text-[11px] text-muted-foreground">{code}</code>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium ${ACCOUNT_TYPE_TONE[type] ?? ""}`}>
                        {type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {isErr ? (
                        <span className="text-xs text-red-600 inline-flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {(v as { error: string }).error}
                        </span>
                      ) : loading ? (
                        <Skeleton className="h-4 w-20 ml-auto" />
                      ) : (
                        <span className={`font-semibold ${balance < 0 ? "text-red-600" : ""}`}>
                          {fmt(balance, currency)}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  )
}

function Kpi({
  label, icon: Icon, value, sublabel, tone, loading,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  value: string | null
  sublabel: string
  tone: "default" | "positive" | "warn" | "danger"
  loading?: boolean
}) {
  const iconColor =
    tone === "positive" ? "text-emerald-600"
    : tone === "warn" ? "text-amber-600"
    : tone === "danger" ? "text-red-600"
    : "text-muted-foreground"
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <p className="text-3xl font-semibold tabular-nums">{value ?? "—"}</p>
        )}
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </CardContent>
    </Card>
  )
}

function SellerRow({ label, cents, tone, bold }: {
  label: string; cents: number; tone: "default" | "positive" | "danger"; bold?: boolean
}) {
  const color =
    cents === 0 ? "text-muted-foreground"
    : tone === "positive" ? "text-emerald-700"
    : tone === "danger" ? "text-red-700"
    : ""
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${color} ${bold ? "font-semibold" : ""}`}>{fmt(cents)}</span>
    </div>
  )
}
