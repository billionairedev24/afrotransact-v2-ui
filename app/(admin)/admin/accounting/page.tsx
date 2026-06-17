"use client"

import { useEffect, useState } from "react"
import { BookOpen, RefreshCcw, AlertTriangle, Search } from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import {
  ACCOUNTING_ACCOUNTS,
  adminLedgerAccountBalance,
  adminLedgerSellerBalance,
  type AccountBalanceDto,
  type SellerLedgerBalanceDto,
} from "@/lib/api"

const fmt = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)

const ACCOUNT_TYPE_COLOR: Record<string, string> = {
  asset:      "text-emerald-700 bg-emerald-50 border-emerald-200",
  liability:  "text-amber-700  bg-amber-50  border-amber-200",
  revenue:    "text-blue-700   bg-blue-50   border-blue-200",
  expense:    "text-red-700    bg-red-50    border-red-200",
  receivable: "text-violet-700 bg-violet-50 border-violet-200",
}

export default function AdminAccountingPage() {
  const [balances, setBalances] = useState<Record<string, AccountBalanceDto | { error: string }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sellerId, setSellerId] = useState("")
  const [sellerBalance, setSellerBalance] = useState<SellerLedgerBalanceDto | null>(null)
  const [sellerLookupError, setSellerLookupError] = useState<string | null>(null)
  const [sellerLooking, setSellerLooking] = useState(false)

  async function loadAll() {
    setLoading(true)
    setError(null)
    const token = await getAccessToken()
    if (!token) {
      setError("Not signed in")
      setLoading(false)
      return
    }
    const next: Record<string, AccountBalanceDto | { error: string }> = {}
    await Promise.all(
      ACCOUNTING_ACCOUNTS.map(async ({ code }) => {
        try {
          next[code] = await adminLedgerAccountBalance(token, code)
        } catch (e) {
          next[code] = { error: e instanceof Error ? e.message : "failed" }
        }
      }),
    )
    setBalances(next)
    setLoading(false)
  }

  useEffect(() => { void loadAll() }, [])

  async function lookupSeller() {
    setSellerLookupError(null)
    setSellerBalance(null)
    const id = sellerId.trim()
    if (!id) return
    setSellerLooking(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      setSellerBalance(await adminLedgerSellerBalance(token, id))
    } catch (e) {
      setSellerLookupError(e instanceof Error ? e.message : "lookup failed")
    } finally {
      setSellerLooking(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Accounting / Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Double-entry balances from the accounting service. Read-only —
            posting flows from Kafka events; manual adjustments require an
            audited POST to /api/v1/admin/ledger/adjustments.
          </p>
        </div>
        <button
          onClick={() => void loadAll()}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCcw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-4">
          {error}
        </div>
      )}

      {/* Platform accounts */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Chart of accounts
        </h2>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading balances…</div>
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
                    <div>
                      <div className="text-sm font-medium text-foreground">{label}</div>
                      <code className="text-xs text-muted-foreground">{code}</code>
                    </div>
                    <span className={`text-[10px] font-medium border rounded px-1.5 py-0.5 ${ACCOUNT_TYPE_COLOR[type] ?? ""}`}>
                      {type}
                    </span>
                  </div>
                  {isErr ? (
                    <div className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {(v as { error: string }).error}
                    </div>
                  ) : (
                    <div className={`text-xl font-semibold ${balance < 0 ? "text-red-600" : ""}`}>
                      {fmt(balance, currency)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Per-seller lookup */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Per-seller balance
        </h2>
        <div className="flex gap-2 mb-4">
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
            <Search className="h-4 w-4" />
            {sellerLooking ? "Looking…" : "Look up"}
          </button>
        </div>

        {sellerLookupError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-3">
            {sellerLookupError}
          </div>
        )}

        {sellerBalance && (
          <div className="border border-border rounded-md p-5 bg-card">
            <code className="text-xs text-muted-foreground">{sellerBalance.sellerId}</code>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
              <Stat label="We owe seller (payable)" cents={sellerBalance.payableCents} positiveGood />
              <Stat label="Seller owes us (receivable)" cents={sellerBalance.owedToPlatformCents} positiveGood={false} />
              <Stat label="Net (positive = we owe seller)" cents={sellerBalance.netOwedToSellerCents} positiveGood />
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function Stat({ label, cents, positiveGood }: { label: string; cents: number; positiveGood: boolean }) {
  const color = cents === 0
    ? "text-muted-foreground"
    : (cents > 0) === positiveGood
      ? "text-emerald-700"
      : "text-red-700"
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-semibold ${color}`}>{fmt(cents)}</div>
    </div>
  )
}
