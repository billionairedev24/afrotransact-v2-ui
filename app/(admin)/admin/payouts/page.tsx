"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { Sheet, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/Sheet"
import {
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowRightLeft,
  XCircle,
  Filter,
  DollarSign,
  Eye,
  Copy,
} from "lucide-react"
import { toast } from "sonner"
import { API_BASE } from "@/lib/api"
import type { TransferRecord } from "@/lib/api"
import { DataTable } from "@/components/ui/DataTable"
import { RowActions } from "@/components/ui/RowActions"
import { createColumnHelper } from "@tanstack/react-table"

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

interface AdminSummary {
  pendingSettlementCents: number
  readyForTransferCents: number
  transferredCents: number
  failedCents: number
  totalCents: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_settlement: { label: "Settling", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  ready_for_transfer: { label: "Ready", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  transferred: { label: "Paid", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  failed: { label: "Failed", color: "text-red-700", bg: "bg-red-50 border-red-200" },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "text-gray-600", bg: "bg-gray-100 border-gray-200" }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.color.replace("text-", "bg-")}`} />
      {cfg.label}
    </span>
  )
}

function shortId(id: string, len = 10) {
  if (id.length <= len) return id
  return `${id.slice(0, len)}…`
}

const col = createColumnHelper<TransferRecord>()

export default function AdminPayoutsPage() {
  const { status } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [transfers, setTransfers] = useState<TransferRecord[]>([])
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [selected, setSelected] = useState<TransferRecord | null>(null)

  const fetchData = useCallback(async (filter?: string) => {
    const token = await getAccessToken()
    if (!token) return
    try {
      const params = new URLSearchParams({ page: "0", size: "100" })
      if (filter) params.set("status", filter)
      const [sumRes, payoutsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/admin/payouts/summary`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/v1/admin/payouts?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (sumRes.ok) setSummary(await sumRes.json())
      if (payoutsRes.ok) {
        const data = await payoutsRes.json()
        setTransfers(data.content || [])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load payouts")
    }
  }, [])

  useEffect(() => {
    if (status !== "authenticated") return
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [status, fetchData])

  useEffect(() => {
    if (status !== "authenticated") return
    fetchData(statusFilter || undefined)
  }, [status, statusFilter, fetchData])

  function handleCopyId(id: string) {
    navigator.clipboard.writeText(id)
    toast.success("ID copied")
  }

  const columns = useMemo(() => [
    col.accessor("id", {
      header: "Transfer ID",
      cell: info => <span className="font-mono text-xs text-gray-900" title={info.getValue()}>{shortId(info.getValue())}</span>,
    }),
    col.accessor("storeId", {
      header: "Store",
      cell: info => <span className="font-mono text-xs text-gray-500" title={info.getValue()}>{shortId(info.getValue())}</span>,
    }),
    col.accessor("amountCents", {
      header: "Amount",
      cell: info => <span className="tabular-nums font-semibold text-gray-900">{formatCents(info.getValue())}</span>,
    }),
    col.accessor("platformFeeCents", {
      header: "Fee",
      cell: info => <span className="tabular-nums text-xs text-gray-500">{formatCents(info.getValue())}</span>,
    }),
    col.accessor("status", {
      header: "Status",
      cell: info => <StatusBadge status={info.getValue()} />,
    }),
    col.accessor("createdAt", {
      header: "Date",
      cell: info => <span className="whitespace-nowrap text-xs text-gray-500">{formatDate(info.getValue())}</span>,
    }),
    col.display({
      id: "actions",
      header: "",
      enableHiding: false,
      cell: ({ row }) => (
        <RowActions actions={[
          {
            label: "View Details",
            icon: <Eye className="h-4 w-4" />,
            onClick: () => setSelected(row.original),
          },
        ]} />
      ),
    }),
  ], [])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading payouts...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-destructive">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto min-w-0 max-w-[1100px] space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">Platform Payouts</h1>
        <p className="mt-1 text-sm text-gray-500">Manage and monitor all seller payout settlements.</p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 sm:gap-4">
        {[
          { label: "Total", value: summary?.totalCents ?? 0, icon: DollarSign, color: "text-gray-900" },
          { label: "Settling", value: summary?.pendingSettlementCents ?? 0, icon: Clock, color: "text-yellow-700" },
          { label: "Ready", value: summary?.readyForTransferCents ?? 0, icon: ArrowRightLeft, color: "text-blue-700" },
          { label: "Transferred", value: summary?.transferredCents ?? 0, icon: CheckCircle2, color: "text-green-700" },
          { label: "Failed", value: summary?.failedCents ?? 0, icon: XCircle, color: "text-red-700" },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="min-w-0 rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <Icon className={`h-4 w-4 shrink-0 ${card.color}`} />
                <span className="truncate text-xs text-gray-500">{card.label}</span>
              </div>
              <p className={`truncate text-lg font-bold tabular-nums ${card.color}`}>{formatCents(card.value)}</p>
            </div>
          )
        })}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 shrink-0 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 outline-none focus:border-primary/60"
          >
            <option value="">All statuses</option>
            <option value="pending_settlement">Settling</option>
            <option value="ready_for_transfer">Ready</option>
            <option value="transferred">Paid</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={transfers}
          loading={loading}
          searchPlaceholder="Search by transfer ID…"
          searchColumn="id"
          enableExport
          exportFilename="payouts"
          emptyMessage="No transfers found."
        />
      </div>

      {/* Transfer detail sheet */}
      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        <SheetHeader onClose={() => setSelected(null)}>Transfer Details</SheetHeader>
        <SheetBody>
          {selected && (() => {
            const discount = selected.discountCents ?? 0
            const isPlatformCoupon = selected.couponType === "platform"
            const isSellerCoupon = selected.couponType === "seller"
            const orderTotal = selected.subtotalCents + selected.shippingCents + selected.taxCents
            const customerPaid = orderTotal - discount
            const platformPaid = isPlatformCoupon ? discount : 0
            return (
              <div className="min-w-0 space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Net Payout</p>
                    <p className="text-2xl font-bold tabular-nums text-gray-900">{formatCents(selected.amountCents)}</p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>

                {discount > 0 && isPlatformCoupon && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-800">Platform Coupon Applied</p>
                    <p className="text-xs text-blue-600 mt-1">
                      Coupon <span className="font-semibold">{selected.couponCode}</span> is a platform coupon. The platform absorbs the {formatCents(discount)} discount — this is not deducted from the seller&apos;s payout.
                    </p>
                  </div>
                )}

                <div className="min-w-0 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Payment Breakdown</h3>
                  <div className="space-y-1 rounded-xl border border-gray-200 bg-white p-5">
                    <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-gray-600">Product subtotal</span><span className="shrink-0 text-sm font-mono tabular-nums text-gray-900">{formatCents(selected.subtotalCents)}</span></div>
                    {selected.shippingCents > 0 && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-gray-600">Shipping</span><span className="shrink-0 text-sm font-mono tabular-nums text-gray-900">{formatCents(selected.shippingCents)}</span></div>}
                    {selected.taxCents > 0 && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-gray-600">Tax</span><span className="shrink-0 text-sm font-mono tabular-nums text-gray-900">{formatCents(selected.taxCents)}</span></div>}
                    {discount > 0 && (
                      <div className="flex justify-between gap-3 py-1.5">
                        <span className="text-sm text-green-600">
                          {selected.couponCode ? `Coupon (${selected.couponCode})` : "Coupon savings"}
                          <span className={`ml-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${isPlatformCoupon ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                            {isPlatformCoupon ? "Platform coupon" : "Seller coupon"}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-mono tabular-nums text-green-600">−{formatCents(discount)}</span>
                      </div>
                    )}
                    <div className="my-2 border-t border-gray-200" />
                    <div className="flex justify-between gap-3 py-1.5"><span className="text-sm font-semibold text-gray-900">Customer paid</span><span className="shrink-0 text-sm font-mono font-semibold tabular-nums text-gray-900">{formatCents(customerPaid)}</span></div>
                    {platformPaid > 0 && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm font-semibold text-blue-700">Platform paid</span><span className="shrink-0 text-sm font-mono font-semibold tabular-nums text-blue-700">{formatCents(platformPaid)}</span></div>}
                    {isSellerCoupon && discount > 0 && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm font-semibold text-orange-700">Seller coupon discount</span><span className="shrink-0 text-sm font-mono font-semibold tabular-nums text-orange-700">{formatCents(discount)}</span></div>}
                    <div className="my-3 border-t border-dashed border-gray-300" />
                    <p className="pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Deductions from seller</p>
                    {discount > 0 && isSellerCoupon && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-red-600">{selected.couponCode ? `Coupon discount (${selected.couponCode})` : "Coupon discount"} <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">Seller pays</span></span><span className="shrink-0 text-sm font-mono tabular-nums text-red-600">−{formatCents(discount)}</span></div>}
                    <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-red-600">Platform commission</span><span className="shrink-0 text-sm font-mono tabular-nums text-red-600">−{formatCents(selected.platformFeeCents)}</span></div>
                    {selected.stripeFeeCents > 0 && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-red-600">Stripe processing fee</span><span className="shrink-0 text-sm font-mono tabular-nums text-red-600">−{formatCents(selected.stripeFeeCents)}</span></div>}
                    {selected.taxCents > 0 && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-red-600">Tax remitted</span><span className="shrink-0 text-sm font-mono tabular-nums text-red-600">−{formatCents(selected.taxCents)}</span></div>}
                    {selected.shippingCents > 0 && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-red-600">Shipping remitted</span><span className="shrink-0 text-sm font-mono tabular-nums text-red-600">−{formatCents(selected.shippingCents)}</span></div>}
                    <div className="my-2 border-t-2 border-gray-900" />
                    <div className="flex justify-between gap-3 py-2"><span className="text-base font-bold text-gray-900">Seller net payout</span><span className="shrink-0 text-base font-bold font-mono tabular-nums text-gray-900">{formatCents(selected.amountCents)}</span></div>
                    <p className="break-words pt-1 text-[11px] text-gray-400">
                      Reconciliation: {formatCents(selected.subtotalCents)}
                      {discount > 0 && isSellerCoupon && ` − ${formatCents(discount)} (seller coupon)`}
                      {discount > 0 && isPlatformCoupon && ` (platform absorbs ${formatCents(discount)} coupon)`}
                      {` − ${formatCents(selected.platformFeeCents)} (commission) − ${formatCents(selected.stripeFeeCents)} (Stripe)`}
                      {` = ${formatCents(selected.subtotalCents - (isSellerCoupon ? discount : 0) - selected.platformFeeCents - selected.stripeFeeCents)}`}
                    </p>
                  </div>
                </div>

                <div className="min-w-0 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Transfer Information</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { label: "Transfer ID", value: selected.id, copyable: true },
                      { label: "Store ID", value: selected.storeId, copyable: true },
                      { label: "Order ID", value: selected.orderId || "—", copyable: !!selected.orderId },
                      { label: "Stripe Transfer ID", value: selected.stripeTransferId || "—" },
                      { label: "Created", value: formatDateTime(selected.createdAt) },
                      { label: "Est. Settlement", value: formatDateTime(selected.estimatedSettlementAt) },
                      { label: "Settled At", value: formatDateTime(selected.settledAt) },
                      { label: "Transferred At", value: formatDateTime(selected.transferredAt) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-3.5">
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">{item.label}</p>
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="min-w-0 break-all text-sm font-medium text-gray-900">{item.value}</p>
                          {item.copyable && item.value !== "—" && (
                            <button type="button" onClick={() => handleCopyId(String(item.value))} className="shrink-0 rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900">
                              <Copy className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}
        </SheetBody>
        <SheetFooter>
          <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900">
            Close
          </button>
        </SheetFooter>
      </Sheet>
    </div>
  )
}
