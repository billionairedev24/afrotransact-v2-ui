"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { Sheet, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/Sheet"
import {
  ExternalLink,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowRightLeft,
  Filter,
  MoreHorizontal,
  Eye,
  Copy,
} from "lucide-react"
import { toast } from "sonner"
import {
  getCurrentSeller,
  getSellerStores,
  getPayoutSummary,
  getPayouts,
  type PayoutSummary,
  type TransferRecord,
} from "@/lib/api"
import type { SellerInfo } from "@/lib/api"

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; description: string }> = {
  pending_settlement: { label: "Settling", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", description: "Payment is being processed by Stripe. This typically takes ~2 business days." },
  ready_for_transfer: { label: "Ready", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", description: "Funds have settled and are queued for transfer to your Stripe account." },
  transferred: { label: "Paid", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", description: "Funds have been transferred to your connected Stripe account." },
  failed: { label: "Failed", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", description: "Transfer failed. Our system will retry automatically." },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "text-gray-400", bg: "bg-white/5 border-white/10" }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.color.replace("text-", "bg-")}`} />
      {cfg.label}
    </span>
  )
}

function RowActionMenu({ onView }: { onView: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-white/10 py-1 shadow-xl" style={{ background: "hsl(0 0% 11%)" }}>
          <button
            onClick={() => { onView(); setOpen(false) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> View Details
          </button>
        </div>
      )}
    </div>
  )
}

export default function PayoutsPage() {
  const { status } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [seller, setSeller] = useState<SellerInfo | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [summary, setSummary] = useState<PayoutSummary | null>(null)
  const [transfers, setTransfers] = useState<TransferRecord[]>([])
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [selected, setSelected] = useState<TransferRecord | null>(null)

  useEffect(() => {
    if (status !== "authenticated") return
    let cancelled = false

    async function load() {
      const token = await getAccessToken()
      if (!token) return
      setLoading(true)
      setError("")
      try {
        const s = await getCurrentSeller(token)
        if (cancelled) return
        setSeller(s)

        const stores = await getSellerStores(token, s.id)
        if (cancelled || stores.length === 0) { setLoading(false); return }

        const sid = stores[0].id
        setStoreId(sid)

        const [sum, payoutsRes] = await Promise.all([
          getPayoutSummary(token, sid),
          getPayouts(token, sid, 0, 50),
        ])
        if (cancelled) return

        setSummary(sum)
        setTransfers(payoutsRes.content || [])
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load payouts")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [status])

  useEffect(() => {
    if (!storeId || status !== "authenticated") return
    let cancelled = false

    async function reload() {
      const token = await getAccessToken()
      if (!token || cancelled) return
      try {
        const res = await getPayouts(token, storeId!, 0, 50, statusFilter || undefined)
        if (!cancelled) setTransfers(res.content || [])
      } catch { /* ignore */ }
    }
    reload()
    return () => { cancelled = true }
  }, [statusFilter, storeId, status])

  const filtered = useMemo(() => {
    if (!statusFilter) return transfers
    return transfers.filter((t) => t.status === statusFilter)
  }, [transfers, statusFilter])

  function handleCopyId(id: string) {
    navigator.clipboard.writeText(id)
    toast.success("Copied")
  }

  if (status !== "authenticated") {
    return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Sign in to view payouts</div>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading payouts...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-destructive">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  const stripeAccountId = seller?.stripeAccountId
  const stripeDashboardUrl = stripeAccountId
    ? `https://dashboard.stripe.com/connect/accounts/${stripeAccountId}`
    : "https://dashboard.stripe.com/connect/accounts/overview"

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Payouts</h1>
          <p className="text-sm text-gray-400 mt-1">Track your earnings from customer orders.</p>
        </div>
        <a
          href={stripeDashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
        >
          Stripe Dashboard
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Earnings", value: formatCents(summary?.totalEarningsCents ?? 0), icon: TrendingUp, color: "text-white", iconBg: "bg-white/10" },
          { label: "Settling", value: formatCents(summary?.pendingSettlementCents ?? 0), sub: "~2 business days", icon: Clock, color: "text-yellow-400", iconBg: "bg-yellow-500/10" },
          { label: "Ready to Transfer", value: formatCents(summary?.readyForTransferCents ?? 0), icon: ArrowRightLeft, color: "text-blue-400", iconBg: "bg-blue-500/10" },
          { label: "Transferred", value: formatCents(summary?.transferredCents ?? 0), icon: CheckCircle2, color: "text-green-400", iconBg: "bg-green-500/10" },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-2xl border border-white/10 p-5" style={{ background: "hsl(0 0% 11%)" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${card.iconBg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <span className="text-xs text-gray-400 font-medium">{card.label}</span>
              </div>
              <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              {"sub" in card && card.sub && <p className="text-[11px] text-gray-500 mt-1">{card.sub}</p>}
            </div>
          )
        })}
      </div>

      {/* How payouts work */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <DollarSign className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-sm text-white font-medium">How payouts work</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            When a customer pays, the funds are held for ~2 business days while Stripe settles the payment.
            Once settled, funds are automatically transferred to your connected Stripe account.
            From there, Stripe pays out to your bank on your configured schedule.
          </p>
        </div>
      </div>

      {/* Transfers table */}
      <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "hsl(0 0% 11%)" }}>
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Transfer History</h2>
            <p className="text-xs text-gray-400 mt-0.5">Individual payouts for each order</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-primary/60"
            >
              <option value="">All statuses</option>
              <option value="pending_settlement">Settling</option>
              <option value="ready_for_transfer">Ready</option>
              <option value="transferred">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400 text-sm">
            {transfers.length === 0 ? "No payouts yet. Earnings will appear here when customers place orders." : "No transfers match this filter."}
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_100px_100px_120px_100px_44px] gap-2 px-5 py-2.5 text-xs text-gray-500 font-medium uppercase tracking-wide border-b border-white/5">
              <span>Order</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Fee</span>
              <span className="text-center">Status</span>
              <span className="text-right">Date</span>
              <span />
            </div>
            <div className="divide-y divide-white/5">
              {filtered.map((t) => (
                <div key={t.id} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_120px_100px_44px] gap-2 px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm text-white font-mono truncate">
                      {t.orderId ? t.orderId.substring(0, 8) + "…" : "—"}
                    </p>
                    {t.estimatedSettlementAt && t.status === "pending_settlement" && (
                      <p className="text-[11px] text-gray-500 mt-0.5">Est. settlement: {formatDate(t.estimatedSettlementAt)}</p>
                    )}
                  </div>
                  <span className="text-sm text-white font-semibold text-right">{formatCents(t.amountCents)}</span>
                  <span className="text-sm text-gray-400 text-right">{formatCents(t.platformFeeCents)}</span>
                  <div className="flex justify-center"><StatusBadge status={t.status} /></div>
                  <span className="text-xs text-gray-400 text-right">{t.transferredAt ? formatDate(t.transferredAt) : formatDate(t.createdAt)}</span>
                  <RowActionMenu onView={() => setSelected(t)} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-gray-500 text-center">
        Platform commission is deducted from each order. After settlement, funds are transferred
        to your Stripe Connect account. Bank payouts follow your Stripe payout schedule.
      </p>

      {/* Transfer detail sheet */}
      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        <SheetHeader onClose={() => setSelected(null)}>Payout Details</SheetHeader>
        <SheetBody>
          {selected && (
            <div className="space-y-6">
              {/* Top summary */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Net Amount</p>
                  <p className="text-3xl font-bold text-white">{formatCents(selected.amountCents)}</p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              {/* Status explanation */}
              {STATUS_CONFIG[selected.status] && (
                <div className={`rounded-xl border p-4 ${STATUS_CONFIG[selected.status].bg}`}>
                  <p className={`text-sm font-medium ${STATUS_CONFIG[selected.status].color}`}>
                    {STATUS_CONFIG[selected.status].label}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{STATUS_CONFIG[selected.status].description}</p>
                </div>
              )}

              {/* Details grid */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Payout Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Payout ID", value: selected.id, copyable: true },
                    { label: "Order ID", value: selected.orderId || "—", copyable: !!selected.orderId },
                    { label: "Gross Amount", value: formatCents(selected.amountCents + selected.platformFeeCents) },
                    { label: "Platform Fee", value: formatCents(selected.platformFeeCents) },
                    { label: "Net Amount", value: formatCents(selected.amountCents) },
                    { label: "Created", value: formatDateTime(selected.createdAt) },
                    { label: "Est. Settlement", value: formatDateTime(selected.estimatedSettlementAt) },
                    { label: "Settled At", value: formatDateTime(selected.settledAt) },
                    { label: "Transferred At", value: formatDateTime(selected.transferredAt) },
                    { label: "Stripe Transfer ID", value: selected.stripeTransferId || "Pending" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/10 p-3.5" style={{ background: "hsl(0 0% 9%)" }}>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">{item.label}</p>
                      <div className="flex items-center gap-2">
                        <p className="break-all text-sm font-medium text-white truncate">{item.value}</p>
                        {item.copyable && item.value !== "—" && (
                          <button onClick={() => handleCopyId(String(item.value))} className="shrink-0 rounded p-1 text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetBody>
        <SheetFooter>
          <button
            onClick={() => setSelected(null)}
            className="rounded-xl border border-white/15 px-5 py-2 text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </SheetFooter>
      </Sheet>
    </div>
  )
}
