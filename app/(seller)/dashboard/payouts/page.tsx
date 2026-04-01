"use client"

import { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from "react"
import { createPortal } from "react-dom"
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
  ChevronDown,
  ChevronUp,
  Receipt,
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; description: string }> = {
  pending_settlement: { label: "Settling", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500", description: "Payment is being processed by Stripe. This typically takes ~2 business days." },
  ready_for_transfer: { label: "Ready", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", dot: "bg-blue-500", description: "Funds have settled and are queued for transfer to your Stripe account." },
  transferred: { label: "Paid", color: "text-green-700", bg: "bg-green-50 border-green-200", dot: "bg-green-500", description: "Funds have been transferred to your connected Stripe account." },
  failed: { label: "Failed", color: "text-red-700", bg: "bg-red-50 border-red-200", dot: "bg-red-500", description: "Transfer failed. Our system will retry automatically." },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "text-gray-600", bg: "bg-gray-50 border-gray-200", dot: "bg-gray-400" }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

const PAYOUT_MENU_W = 176

function RowActionMenu({ onView }: { onView: () => void }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const updatePos = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const pad = 8
    let left = r.right - PAYOUT_MENU_W
    left = Math.max(pad, Math.min(left, window.innerWidth - PAYOUT_MENU_W - pad))
    setPos({ top: r.bottom + 4, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    updatePos()
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    function onResize() {
      updatePos()
    }
    document.addEventListener("mousedown", handleClick)
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onResize, true)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onResize, true)
    }
  }, [open, updatePos])

  const menu =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[200] w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
            style={{ top: pos.top, left: pos.left }}
          >
            <button
              type="button"
              onClick={() => {
                onView()
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <Eye className="h-3.5 w-3.5" /> View Breakdown
            </button>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menu}
    </>
  )
}

function BreakdownLine({ label, amount, variant = "default", indent = false }: {
  label: string
  amount: number
  variant?: "default" | "deduction" | "total" | "highlight"
  indent?: boolean
}) {
  const isDeduction = variant === "deduction"
  const isTotal = variant === "total"
  const isHighlight = variant === "highlight"

  return (
    <div className={`flex items-center justify-between py-1.5 ${isTotal ? "border-t border-gray-200 pt-3 mt-1" : ""} ${indent ? "pl-4" : ""}`}>
      <span className={`text-sm ${isTotal || isHighlight ? "font-semibold text-gray-900" : "text-gray-600"}`}>
        {label}
      </span>
      <span className={`text-sm font-mono tabular-nums ${
        isDeduction ? "text-red-600" : isTotal || isHighlight ? "font-semibold text-gray-900" : "text-gray-900"
      }`}>
        {isDeduction ? `−${formatCents(amount)}` : formatCents(amount)}
      </span>
    </div>
  )
}

function InlineBreakdown({ t }: { t: TransferRecord }) {
  const discount = t.discountCents ?? 0
  const customerPaid = t.subtotalCents + t.shippingCents + t.taxCents - discount

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-0.5">
      <BreakdownLine label="Product subtotal" amount={t.subtotalCents} />
      {discount > 0 && (
        <BreakdownLine
          label={t.couponCode ? `Coupon (${t.couponCode})` : "Coupon discount"}
          amount={discount}
          variant="deduction"
        />
      )}
      {t.shippingCents > 0 && <BreakdownLine label="Shipping" amount={t.shippingCents} />}
      {t.taxCents > 0 && <BreakdownLine label="Tax" amount={t.taxCents} />}
      <BreakdownLine label="Customer paid" amount={customerPaid} variant="highlight" />
      <div className="my-2 border-t border-dashed border-gray-300" />
      <BreakdownLine label="Platform commission" amount={t.platformFeeCents} variant="deduction" />
      {t.stripeFeeCents > 0 && <BreakdownLine label="Stripe processing fee" amount={t.stripeFeeCents} variant="deduction" />}
      {t.taxCents > 0 && <BreakdownLine label="Tax (remitted)" amount={t.taxCents} variant="deduction" />}
      {t.shippingCents > 0 && <BreakdownLine label="Shipping (remitted)" amount={t.shippingCents} variant="deduction" />}
      <BreakdownLine label="Your payout" amount={t.amountCents} variant="total" />
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
    return <div className="flex items-center justify-center min-h-[400px] text-gray-500">Sign in to view payouts</div>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] gap-2 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading payouts...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-red-600">
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
    <div className="mx-auto min-w-0 w-full max-w-[960px] space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
          <p className="text-sm text-gray-500 mt-1">Track your earnings and see exactly where every dollar goes.</p>
        </div>
        <a
          href={stripeDashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 sm:w-auto"
        >
          Stripe Dashboard
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Summary cards */}
      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[
          { label: "Total Earnings", value: formatCents(summary?.totalEarningsCents ?? 0), icon: TrendingUp, color: "text-gray-900", iconBg: "bg-gray-100" },
          { label: "Settling", value: formatCents(summary?.pendingSettlementCents ?? 0), sub: "~2 business days", icon: Clock, color: "text-amber-600", iconBg: "bg-amber-50" },
          { label: "Ready to Transfer", value: formatCents(summary?.readyForTransferCents ?? 0), icon: ArrowRightLeft, color: "text-blue-600", iconBg: "bg-blue-50" },
          { label: "Transferred", value: formatCents(summary?.transferredCents ?? 0), icon: CheckCircle2, color: "text-green-600", iconBg: "bg-green-50" },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-3 sm:p-5">
              <div className="mb-2 flex items-center gap-2 sm:mb-3 sm:gap-3">
                <div className={`shrink-0 rounded-lg p-1.5 sm:p-2 ${card.iconBg}`}>
                  <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${card.color}`} />
                </div>
                <span className="min-w-0 text-[10px] font-medium leading-tight text-gray-500 sm:text-xs">{card.label}</span>
              </div>
              <p className={`truncate text-base font-bold sm:text-xl ${card.color}`}>{card.value}</p>
              {"sub" in card && card.sub && <p className="text-[11px] text-gray-500 mt-1">{card.sub}</p>}
            </div>
          )
        })}
      </div>

      {/* How payouts work */}
      <div className="flex items-start gap-3 rounded-xl border border-[#EAB308]/20 bg-[#EAB308]/5 p-4">
        <DollarSign className="h-5 w-5 text-[#EAB308] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm text-gray-900 font-medium">How payouts work</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            When a customer pays, Stripe deducts its processing fee (~2.9% + $0.30). The platform then deducts its
            commission. Tax and shipping are collected and remitted separately. The remaining amount is your net payout,
            transferred to your Stripe account after ~2 business days of settlement.
          </p>
        </div>
      </div>

      {/* Transfers table */}
      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Transfer History</h2>
            <p className="text-xs text-gray-500 mt-0.5">Click any row to see the full financial breakdown</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Filter className="h-3.5 w-3.5 shrink-0 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 outline-none focus:border-[#EAB308]/60"
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
          <div className="px-5 py-12 text-center text-gray-500 text-sm">
            {transfers.length === 0 ? "No payouts yet. Earnings will appear here when customers place orders." : "No transfers match this filter."}
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1fr)_90px_90px_90px_90px_100px_100px_44px] gap-1 border-b border-gray-100 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 sm:grid">
              <span>Order</span>
              <span className="text-right">Net Sales</span>
              <span className="text-right">Fees</span>
              <span className="text-right">Tax</span>
              <span className="text-right">Net Payout</span>
              <span className="text-center">Status</span>
              <span className="text-right">Date</span>
              <span />
            </div>
            <div className="divide-y divide-gray-100">
              {filtered.map((t) => {
                const totalFees = t.platformFeeCents + t.stripeFeeCents
                const netSales = t.subtotalCents - (t.discountCents ?? 0)
                const isExpanded = expandedRows.has(t.id)
                const dateStr = t.transferredAt ? formatDate(t.transferredAt) : formatDate(t.createdAt)

                return (
                  <div key={t.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer px-4 py-4 transition-colors hover:bg-gray-50/80 sm:hidden"
                      onClick={() => toggleExpand(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          toggleExpand(t.id)
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                          <div className="min-w-0">
                            <p className="font-mono text-sm text-gray-900">
                              {t.orderId ? `${t.orderId.substring(0, 8)}…` : "—"}
                            </p>
                            {t.estimatedSettlementAt && t.status === "pending_settlement" && (
                              <p className="mt-0.5 text-[11px] text-gray-400">Est. {formatDate(t.estimatedSettlementAt)}</p>
                            )}
                          </div>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <RowActionMenu onView={() => setSelected(t)} />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Net sales</p>
                          <p className="mt-0.5 text-gray-700">{formatCents(netSales)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Fees</p>
                          <p className="mt-0.5 text-red-500">−{formatCents(totalFees)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Tax</p>
                          <p className="mt-0.5 text-gray-600">{formatCents(t.taxCents)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Net payout</p>
                          <p className="mt-0.5 font-semibold text-gray-900">{formatCents(t.amountCents)}</p>
                        </div>
                        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
                          <StatusBadge status={t.status} />
                          <span className="text-xs text-gray-500">{dateStr}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-center text-[11px] text-gray-400">
                        {isExpanded ? "Tap to hide breakdown" : "Tap row for breakdown"}
                      </p>
                      {isExpanded && (
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <InlineBreakdown t={t} />
                        </div>
                      )}
                    </div>

                    <div className="hidden sm:block">
                      <div
                        className="grid grid-cols-[minmax(0,1fr)_90px_90px_90px_90px_100px_100px_44px] cursor-pointer items-center gap-1 px-5 py-3.5 transition-colors hover:bg-gray-50/80"
                        onClick={() => toggleExpand(t.id)}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                          <div className="min-w-0">
                            <p className="truncate font-mono text-sm text-gray-900">
                              {t.orderId ? t.orderId.substring(0, 8) + "…" : "—"}
                            </p>
                            {t.estimatedSettlementAt && t.status === "pending_settlement" && (
                              <p className="mt-0.5 text-[11px] text-gray-400">Est. {formatDate(t.estimatedSettlementAt)}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-right text-sm text-gray-600">{formatCents(netSales)}</span>
                        <span className="text-right text-sm text-red-500">−{formatCents(totalFees)}</span>
                        <span className="text-right text-sm text-gray-500">{formatCents(t.taxCents)}</span>
                        <span className="text-right text-sm font-semibold text-gray-900">{formatCents(t.amountCents)}</span>
                        <div className="flex justify-center"><StatusBadge status={t.status} /></div>
                        <span className="text-right text-xs text-gray-500">{dateStr}</span>
                        <div onClick={(e) => e.stopPropagation()}>
                          <RowActionMenu onView={() => setSelected(t)} />
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-5 pb-4">
                          <InlineBreakdown t={t} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        All amounts shown in USD. Stripe fees are estimates based on standard pricing (2.9% + $0.30).
        Bank payouts follow your Stripe payout schedule.
      </p>

      {/* Transfer detail sheet */}
      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        <SheetHeader onClose={() => setSelected(null)}>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#EAB308]" />
            Payout Breakdown
          </div>
        </SheetHeader>
        <SheetBody>
          {selected && (
            <div className="space-y-6">
              {/* Top summary */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Your Payout</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{formatCents(selected.amountCents)}</p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              {/* Status explanation */}
              {STATUS_CONFIG[selected.status] && (
                <div className={`rounded-xl border p-4 ${STATUS_CONFIG[selected.status].bg}`}>
                  <p className={`text-sm font-medium ${STATUS_CONFIG[selected.status].color}`}>
                    {STATUS_CONFIG[selected.status].label}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{STATUS_CONFIG[selected.status].description}</p>
                </div>
              )}

              {/* Full financial breakdown */}
              {(() => {
                const discount = selected.discountCents ?? 0
                const customerPaid = selected.subtotalCents + selected.shippingCents + selected.taxCents - discount
                return (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Financial Breakdown</h3>
                    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-1">
                      <BreakdownLine label="Product subtotal" amount={selected.subtotalCents} />
                      {discount > 0 && (
                        <BreakdownLine
                          label={selected.couponCode ? `Coupon applied (${selected.couponCode})` : "Coupon discount"}
                          amount={discount}
                          variant="deduction"
                        />
                      )}
                      <BreakdownLine label="Shipping collected" amount={selected.shippingCents} />
                      <BreakdownLine label="Tax collected" amount={selected.taxCents} />
                      <div className="border-t border-gray-200 my-2" />
                      <BreakdownLine
                        label="Total customer charge"
                        amount={customerPaid}
                        variant="highlight"
                      />
                      <div className="border-t border-dashed border-gray-300 my-3" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 pb-1">Deductions</p>
                      {discount > 0 && (
                        <BreakdownLine
                          label={selected.couponCode ? `Coupon discount (${selected.couponCode})` : "Coupon discount"}
                          amount={discount}
                          variant="deduction"
                        />
                      )}
                      <BreakdownLine label="Platform commission" amount={selected.platformFeeCents} variant="deduction" />
                      <BreakdownLine label="Stripe processing fee" amount={selected.stripeFeeCents} variant="deduction" />
                      <BreakdownLine label="Tax remitted" amount={selected.taxCents} variant="deduction" />
                      <BreakdownLine label="Shipping remitted" amount={selected.shippingCents} variant="deduction" />
                      <div className="border-t-2 border-gray-900 my-2" />
                      <div className="flex items-center justify-between py-2">
                        <span className="text-base font-bold text-gray-900">Your net payout</span>
                        <span className="text-base font-bold text-gray-900 font-mono tabular-nums">
                          {formatCents(selected.amountCents)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 pt-1">
                        Reconciliation: {formatCents(selected.subtotalCents)}
                        {discount > 0 && ` − ${formatCents(discount)} (coupon)`}
                        {` − ${formatCents(selected.platformFeeCents)} (commission) − ${formatCents(selected.stripeFeeCents)} (Stripe)`}
                        {` = ${formatCents(selected.subtotalCents - discount - selected.platformFeeCents - selected.stripeFeeCents)}`}
                      </p>
                    </div>
                  </div>
                )
              })()}

              {/* IDs and timestamps */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Payout Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Payout ID", value: selected.id, copyable: true },
                    { label: "Order ID", value: selected.orderId || "—", copyable: !!selected.orderId },
                    { label: "Created", value: formatDateTime(selected.createdAt) },
                    { label: "Est. Settlement", value: formatDateTime(selected.estimatedSettlementAt) },
                    { label: "Settled At", value: formatDateTime(selected.settledAt) },
                    { label: "Transferred At", value: formatDateTime(selected.transferredAt) },
                    { label: "Stripe Transfer ID", value: selected.stripeTransferId || "Pending" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">{item.label}</p>
                      <div className="flex items-center gap-2">
                        <p className="break-all text-sm font-medium text-gray-900 truncate">{item.value}</p>
                        {item.copyable && item.value !== "—" && (
                          <button onClick={() => handleCopyId(String(item.value))} className="shrink-0 rounded p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
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
            className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </SheetFooter>
      </Sheet>
    </div>
  )
}
