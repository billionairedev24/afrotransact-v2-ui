"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BookOpen, Download, ScrollText, Scale, TrendingUp, Wallet, Landmark } from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import {
  ApiError,
  getAccounts,
  getPnl,
  getScopedSummary,
  getReconciliation,
  getTrialBalance,
  adminLedgerJournal,
  adminLedgerBackfill,
  listOpex,
  recordOpex,
  voidOpex,
  type AccountRef,
  type PnlDto,
  type LedgerSummaryDto,
  type ReconciliationDto,
  type OpExDto,
  type JournalEntryRow,
  type TrialBalance,
} from "@/lib/api"
import { friendlyMessage, logError } from "@/lib/errors"
import { cn } from "@/lib/utils"

import { AccountSelector } from "./_components/AccountSelector"
import { SyncButton } from "./_components/SyncButton"
import { PeriodSelect, type PeriodKey, type PeriodChange } from "./_components/PeriodSelect"
import { KpiRow, type KpiItem } from "./_components/KpiRow"
import { PnlStatement } from "./_components/PnlStatement"
import { ReconciliationPanel } from "./_components/ReconciliationPanel"
import { OperatingCosts } from "./_components/OperatingCosts"
import { RecordCostForm } from "./_components/RecordCostForm"
import { JournalTable, TrialBalanceTable } from "./_components/ScopedLedgerTable"
import { money } from "./_components/format"

type TabKey = "pnl" | "reconciliation" | "opex" | "journal" | "trial"

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "pnl", label: "Profit & Loss", icon: TrendingUp },
  { key: "reconciliation", label: "Reconciliation", icon: Landmark },
  { key: "opex", label: "Operating costs", icon: Wallet },
  { key: "journal", label: "Journal", icon: ScrollText },
  { key: "trial", label: "Trial balance", icon: Scale },
]

function mtdDefault(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: from.toISOString(), to: now.toISOString() }
}

/** Build the top KPI row from a scope's P&L (hero = TOTAL line) + supplementary lines. */
function kpisFromPnl(pnl: PnlDto | null): KpiItem[] {
  if (!pnl) return []
  const total = pnl.lines.find((l) => l.role === "TOTAL")
  const others = pnl.lines.filter((l) => l.role !== "TOTAL" && l.role !== "SUBTOTAL").slice(0, 3)
  const items: KpiItem[] = []
  if (total) items.push({ label: total.label, value: money(total.amountCents), hero: true })
  for (const l of others) items.push({ label: l.label, value: money(l.amountCents) })
  return items
}

export default function AdminAccountingPage() {
  // ── Scope + period ───────────────────────────────────────────────────────
  const [account, setAccount] = useState("house")
  const [accounts, setAccounts] = useState<AccountRef[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)

  const [periodKey, setPeriodKey] = useState<PeriodKey>("mtd")
  const [range, setRange] = useState<{ from: string; to: string }>(mtdDefault())

  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  const [tab, setTab] = useState<TabKey>("pnl")

  const isSellerScope = useMemo(() => {
    if (account === "all" || account === "house") return false
    const known = accounts.find((a) => a.id === account)
    return known ? known.kind === "seller" : true
  }, [account, accounts])

  // ── Section data ─────────────────────────────────────────────────────────
  const [pnl, setPnl] = useState<PnlDto | null>(null)
  const [pnlLoading, setPnlLoading] = useState(true)
  const [pnlError, setPnlError] = useState<string | null>(null)

  const [summary, setSummary] = useState<LedgerSummaryDto | null>(null)

  const [reconciliation, setReconciliation] = useState<ReconciliationDto | { applicable: false; reason: string } | null>(null)
  const [reconciliationLoading, setReconciliationLoading] = useState(false)
  const [reconError, setReconError] = useState<string | null>(null)

  const [opex, setOpex] = useState<OpExDto[] | null>(null)
  const [opexLoading, setOpexLoading] = useState(false)
  const [opexFormOpen, setOpexFormOpen] = useState(false)
  const [opexSubmitting, setOpexSubmitting] = useState(false)
  const [opexError, setOpexError] = useState<string | null>(null)

  const [journal, setJournal] = useState<JournalEntryRow[] | null>(null)
  const [journalLoading, setJournalLoading] = useState(false)
  const [journalError, setJournalError] = useState<string | null>(null)

  const [trial, setTrial] = useState<TrialBalance | null>(null)
  const [trialLoading, setTrialLoading] = useState(false)
  const [trialError, setTrialError] = useState<string | null>(null)

  const [backfillRunning, setBackfillRunning] = useState(false)
  const [backfillResult, setBackfillResult] = useState<string | null>(null)

  // ── Fetchers ─────────────────────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      setAccounts(await getAccounts(token))
    } catch (e) {
      logError(e, "accounting.loadAccounts")
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const loadPnlAndSummary = useCallback(async () => {
    setPnlLoading(true)
    setPnlError(null)
    try {
      const token = await getAccessToken()
      if (!token) { setPnlError("Not signed in"); return }
      const [pnlData, summaryData] = await Promise.all([
        getPnl(token, { account, from: range.from, to: range.to }),
        getScopedSummary(token, { account }),
      ])
      setPnl(pnlData)
      setSummary(summaryData)
    } catch (e) {
      logError(e, "accounting.loadPnl")
      if (e instanceof ApiError && e.status === 401) {
        setPnlError("Your admin session has expired. Please sign in again.")
      } else if (e instanceof ApiError && e.status === 403) {
        setPnlError("You don't have permission to view this account's numbers.")
      } else {
        setPnlError(friendlyMessage(e, "Couldn't load the profit & loss statement."))
      }
    } finally {
      setPnlLoading(false)
    }
  }, [account, range.from, range.to])

  const loadReconciliation = useCallback(async () => {
    if (isSellerScope) { setReconciliation(null); setReconError(null); return }
    setReconciliationLoading(true)
    setReconError(null)
    try {
      const token = await getAccessToken()
      if (!token) return
      setReconciliation(await getReconciliation(token, { from: range.from, to: range.to }))
    } catch (e) {
      logError(e, "accounting.loadReconciliation")
      setReconError(friendlyMessage(e, "Couldn't load the reconciliation."))
    } finally {
      setReconciliationLoading(false)
    }
  }, [isSellerScope, range.from, range.to])

  const loadOpex = useCallback(async () => {
    if (isSellerScope) { setOpex(null); setOpexError(null); return }
    setOpexLoading(true)
    setOpexError(null)
    try {
      const token = await getAccessToken()
      if (!token) return
      setOpex(await listOpex(token, { from: range.from, to: range.to }))
    } catch (e) {
      logError(e, "accounting.loadOpex")
      setOpexError(friendlyMessage(e, "Couldn't load the operating costs."))
    } finally {
      setOpexLoading(false)
    }
  }, [isSellerScope, range.from, range.to])

  const loadJournal = useCallback(async () => {
    setJournalLoading(true)
    setJournalError(null)
    try {
      const token = await getAccessToken()
      if (!token) return
      const page = await adminLedgerJournal(token, { account, from: range.from, to: range.to, limit: 50, offset: 0 })
      setJournal(page.entries)
    } catch (e) {
      logError(e, "accounting.loadJournal")
      setJournalError(friendlyMessage(e, "Couldn't load the journal."))
    } finally {
      setJournalLoading(false)
    }
  }, [account, range.from, range.to])

  const loadTrial = useCallback(async () => {
    setTrialLoading(true)
    setTrialError(null)
    try {
      const token = await getAccessToken()
      if (!token) return
      setTrial(await getTrialBalance(token, { account, asOf: range.to }))
    } catch (e) {
      logError(e, "accounting.loadTrial")
      setTrialError(friendlyMessage(e, "Couldn't load the trial balance."))
    } finally {
      setTrialLoading(false)
    }
  }, [account, range.to])

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => { void loadAccounts() }, [loadAccounts])

  useEffect(() => { void loadPnlAndSummary() }, [loadPnlAndSummary])

  useEffect(() => { void loadReconciliation() }, [loadReconciliation])
  useEffect(() => { void loadOpex() }, [loadOpex])

  useEffect(() => {
    if (tab === "journal") void loadJournal()
  }, [tab, loadJournal])

  useEffect(() => {
    if (tab === "trial") void loadTrial()
  }, [tab, loadTrial])

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handlePeriodChange(change: PeriodChange) {
    setPeriodKey(change.key)
    if (change.from && change.to) setRange({ from: change.from, to: change.to })
  }

  async function handleSync() {
    setSyncing(true)
    try {
      await Promise.all([
        loadPnlAndSummary(),
        loadReconciliation(),
        loadOpex(),
        tab === "journal" ? loadJournal() : Promise.resolve(),
        tab === "trial" ? loadTrial() : Promise.resolve(),
      ])
      setLastSyncedAt(new Date())
    } finally {
      setSyncing(false)
    }
  }

  async function handleRecordOpex(body: {
    expenseDate: string
    category: string
    amountCents: number
    currency?: string
    description?: string
    recurring?: boolean
  }) {
    setOpexSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      await recordOpex(token, body)
      setOpexFormOpen(false)
      await Promise.all([loadOpex(), loadPnlAndSummary()])
    } catch (e) {
      logError(e, "accounting.recordOpex")
      alert(friendlyMessage(e, "Couldn't record that cost. Please try again."))
    } finally {
      setOpexSubmitting(false)
    }
  }

  async function handleVoidOpex(id: string) {
    const reason = window.prompt("Reason for voiding this cost?")
    if (reason === null) return
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      await voidOpex(token, id, reason || "voided")
      await Promise.all([loadOpex(), loadPnlAndSummary()])
    } catch (e) {
      logError(e, "accounting.voidOpex")
      alert(friendlyMessage(e, "Couldn't void that cost. Please try again."))
    }
  }

  async function runBackfill() {
    if (!confirm("Replay every existing payment and refund into the ledger. Safe to re-run — duplicates are skipped. Proceed?")) return
    setBackfillRunning(true)
    setBackfillResult(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const r = await adminLedgerBackfill(token)
      setBackfillResult(
        `Posted ${r.paymentsPosted} payments (${r.paymentsSkipped} already on ledger), ` +
        `${r.refundsPosted} refunds (${r.refundsSkipped} already on ledger).`,
      )
      await loadPnlAndSummary()
    } catch (e) {
      logError(e, "accounting.runBackfill")
      setBackfillResult(friendlyMessage(e, "Backfill failed. Please try again."))
    } finally {
      setBackfillRunning(false)
    }
  }

  const kpis = useMemo(() => kpisFromPnl(pnl), [pnl])
  const empty = summary?.journalEntryCount === 0

  return (
    <main className="py-2">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BookOpen className="h-6 w-6" /> Accounting
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Account-scoped ledger — pick House, a seller, or All accounts to see that scope&apos;s P&amp;L,
            reconciliation, operating costs, and audit trail.
          </p>
        </div>
        <button
          onClick={runBackfill}
          disabled={backfillRunning}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-muted/50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {backfillRunning ? "Backfilling…" : empty ? "Run initial backfill" : "Re-run backfill"}
        </button>
      </div>

      {backfillResult && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {backfillResult}
        </div>
      )}

      {/* Command bar */}
      <div className="sticky top-0 z-10 mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-sm backdrop-blur">
        <AccountSelector accounts={accounts} value={account} onChange={setAccount} loading={accountsLoading} />
        <PeriodSelect value={periodKey} onChange={handlePeriodChange} />
        {periodKey === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={range.from.slice(0, 10)}
              onChange={(e) => setRange((r) => ({ ...r, from: new Date(e.target.value).toISOString() }))}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={range.to.slice(0, 10)}
              onChange={(e) => setRange((r) => ({ ...r, to: new Date(e.target.value).toISOString() }))}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
        )}
        <div className="ml-auto">
          <SyncButton onSync={handleSync} syncing={syncing} lastSyncedAt={lastSyncedAt} />
        </div>
      </div>

      {pnlError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{pnlError}</div>
      )}

      <div className="mb-8">
        <KpiRow items={kpis} />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-brand-gold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "pnl" && (
        <section className="space-y-4">
          <PnlStatement pnl={pnl} loading={pnlLoading} />
          <p className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            {account === "house"
              ? "House P&L covers AfroTransact's own sales, commission revenue, and operating costs."
              : account === "all"
                ? "All-accounts P&L combines the house and every seller into a single platform-wide net profit."
                : "This seller's P&L covers their own sales and net earnings after commission; it never includes house operating costs."}
          </p>
        </section>
      )}

      {tab === "reconciliation" && (
        !isSellerScope && reconError ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{reconError}</div>
        ) : (
          <ReconciliationPanel data={reconciliation} loading={reconciliationLoading} isSellerScope={isSellerScope} />
        )
      )}

      {tab === "opex" && (
        <>
          {!isSellerScope && opexError ? (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{opexError}</div>
          ) : (
            <OperatingCosts
              items={opex}
              loading={opexLoading}
              isSellerScope={isSellerScope}
              onRecord={() => setOpexFormOpen(true)}
              onVoid={handleVoidOpex}
            />
          )}
          <RecordCostForm
            open={opexFormOpen}
            onClose={() => setOpexFormOpen(false)}
            onSubmit={handleRecordOpex}
            submitting={opexSubmitting}
          />
        </>
      )}

      {tab === "journal" && (
        journalError ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{journalError}</div>
        ) : (
          <JournalTable entries={journal} loading={journalLoading} />
        )
      )}

      {tab === "trial" && (
        trialError ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{trialError}</div>
        ) : (
          <TrialBalanceTable
            rows={trial?.rows ?? null}
            totalDebitsCents={trial?.totalDebitsCents}
            totalCreditsCents={trial?.totalCreditsCents}
            loading={trialLoading}
          />
        )
      )}
    </main>
  )
}
