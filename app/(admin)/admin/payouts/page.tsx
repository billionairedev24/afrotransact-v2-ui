"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
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
  MoreHorizontal,
  Eye,
  Copy,
  Bell,
} from "lucide-react"
import { toast } from "sonner"
import { API_BASE } from "@/lib/api"
import type { TransferRecord } from "@/lib/api"

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

function RowActionMenu({ onView }: { onView: () => void }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const menuW = 176

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    function handleScroll() { setOpen(false) }
    document.addEventListener("mousedown", handleClick)
    window.addEventListener("scroll", handleScroll, true)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [open])

  function toggle(e?: React.MouseEvent) {
    e?.stopPropagation()
    if (open) { setOpen(false); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const pad = 8
      let left = r.right - menuW
      left = Math.max(pad, Math.min(left, window.innerWidth - menuW - pad))
      const top = r.bottom + 4
      setPos({ top, left })
    }
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={toggle}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
        aria-label="Row actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
          style={{ top: pos.top, left: pos.left }}
        >
          <button
            type="button"
            onClick={() => { onView(); setOpen(false) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> View Details
          </button>
        </div>,
        document.body
      )}
    </>
  )
}

function shortId(id: string, len = 10) {
  if (id.length <= len) return id
  return `${id.slice(0, len)}…`
}

export default function AdminPayoutsPage() {
  const { status } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [transfers, setTransfers] = useState<TransferRecord[]>([])
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [selected, setSelected] = useState<TransferRecord | null>(null)
  const [triggeringReminders, setTriggeringReminders] = useState(false)

  async function fetchData(filter?: string) {
    const token = await getAccessToken()
    if (!token) return

    try {
      const params = new URLSearchParams({ page: "0", size: "50" })
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
  }

  async function triggerOnboardingReminders() {
    setTriggeringReminders(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const res = await fetch(`${API_BASE}/api/v1/admin/sellers/onboarding-reminders/trigger`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || `${data.sent} reminder(s) sent`)
      } else {
        toast.error("Failed to trigger reminders")
      }
    } catch {
      toast.error("Failed to trigger reminders")
    } finally {
      setTriggeringReminders(false)
    }
  }

  useEffect(() => {
    if (status !== "authenticated") return
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [status])

  useEffect(() => {
    if (status !== "authenticated") return
    fetchData(statusFilter || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, statusFilter])

  function handleCopyId(id: string) {
    navigator.clipboard.writeText(id)
    toast.success("ID copied")
  }

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
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Platform Payouts</h1>
          <p className="mt-1 text-sm text-gray-500">Manage and monitor all seller payout settlements.</p>
        </div>
        <button
          type="button"
          onClick={triggerOnboardingReminders}
          disabled={triggeringReminders}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
        >
          {triggeringReminders ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
          Send Onboarding Reminders
        </button>
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

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex min-w-0 flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
          <h2 className="text-base font-semibold text-gray-900">All Transfers</h2>
          <div className="flex min-w-0 items-center gap-2">
            <Filter className="h-3.5 w-3.5 shrink-0 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-0 max-w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 outline-none focus:border-primary/60"
            >
              <option value="">All statuses</option>
              <option value="pending_settlement">Settling</option>
              <option value="ready_for_transfer">Ready</option>
              <option value="transferred">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {transfers.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-500">No transfers found.</div>
        ) : (
          <div className="min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="whitespace-nowrap px-4 py-2.5 sm:px-5">Transfer ID</th>
                  <th className="whitespace-nowrap px-2 py-2.5 sm:px-3">Store</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums sm:px-3">Amount</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums sm:px-3">Fee</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-center sm:px-3">Status</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right sm:px-3">Date</th>
                  <th className="w-12 whitespace-nowrap px-2 py-2.5 text-right sm:px-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transfers.map((t) => (
                  <tr key={t.id} className="bg-white transition-colors hover:bg-gray-50/80">
                    <td className="max-w-[8rem] px-4 py-3 sm:max-w-[10rem] sm:px-5">
                      <span className="font-mono text-xs text-gray-900" title={t.id}>{shortId(t.id)}</span>
                    </td>
                    <td className="max-w-[7rem] px-2 py-3 sm:px-3">
                      <span className="font-mono text-xs text-gray-500" title={t.storeId}>{shortId(t.storeId)}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right text-sm font-semibold tabular-nums text-gray-900 sm:px-3">
                      {formatCents(t.amountCents)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right text-xs tabular-nums text-gray-500 sm:px-3">
                      {formatCents(t.platformFeeCents)}
                    </td>
                    <td className="px-2 py-3 sm:px-3">
                      <div className="flex justify-center">
                        <StatusBadge status={t.status} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right text-xs text-gray-500 sm:px-3">
                      {formatDate(t.createdAt)}
                    </td>
                    <td className="px-2 py-3 text-right sm:px-3">
                      <div className="flex justify-end">
                        <RowActionMenu onView={() => setSelected(t)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer detail sheet */}
      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        <SheetHeader onClose={() => setSelected(null)}>Transfer Details</SheetHeader>
        <SheetBody>
          {selected && (() => {
            const discount = selected.discountCents ?? 0
            const customerPaid = selected.subtotalCents + selected.shippingCents + selected.taxCents - discount
            return (
            <div className="min-w-0 space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Net Payout</p>
                  <p className="text-2xl font-bold tabular-nums text-gray-900">{formatCents(selected.amountCents)}</p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <div className="min-w-0 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Financial Breakdown</h3>
                <div className="space-y-1 rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-gray-600">Product subtotal</span><span className="shrink-0 text-sm font-mono tabular-nums text-gray-900">{formatCents(selected.subtotalCents)}</span></div>
                  {discount > 0 && (
                    <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-green-600">{selected.couponCode ? `Coupon (${selected.couponCode})` : "Coupon savings"}</span><span className="shrink-0 text-sm font-mono tabular-nums text-green-600">−{formatCents(discount)}</span></div>
                  )}
                  {selected.shippingCents > 0 && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-gray-600">Shipping</span><span className="shrink-0 text-sm font-mono tabular-nums text-gray-900">{formatCents(selected.shippingCents)}</span></div>}
                  {selected.taxCents > 0 && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-gray-600">Tax</span><span className="shrink-0 text-sm font-mono tabular-nums text-gray-900">{formatCents(selected.taxCents)}</span></div>}
                  <div className="my-2 border-t border-gray-200" />
                  <div className="flex justify-between gap-3 py-1.5"><span className="text-sm font-semibold text-gray-900">Customer paid</span><span className="shrink-0 text-sm font-mono font-semibold tabular-nums text-gray-900">{formatCents(customerPaid)}</span></div>
                  <div className="my-3 border-t border-dashed border-gray-300" />
                  <p className="pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Deductions</p>
                  {discount > 0 && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-red-600">{selected.couponCode ? `Coupon discount (${selected.couponCode})` : "Coupon discount"}</span><span className="shrink-0 text-sm font-mono tabular-nums text-red-600">−{formatCents(discount)}</span></div>}
                  <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-red-600">Platform commission</span><span className="shrink-0 text-sm font-mono tabular-nums text-red-600">−{formatCents(selected.platformFeeCents)}</span></div>
                  {selected.stripeFeeCents > 0 && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-red-600">Stripe processing fee</span><span className="shrink-0 text-sm font-mono tabular-nums text-red-600">−{formatCents(selected.stripeFeeCents)}</span></div>}
                  {selected.taxCents > 0 && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-red-600">Tax remitted</span><span className="shrink-0 text-sm font-mono tabular-nums text-red-600">−{formatCents(selected.taxCents)}</span></div>}
                  {selected.shippingCents > 0 && <div className="flex justify-between gap-3 py-1.5"><span className="text-sm text-red-600">Shipping remitted</span><span className="shrink-0 text-sm font-mono tabular-nums text-red-600">−{formatCents(selected.shippingCents)}</span></div>}
                  <div className="my-2 border-t-2 border-gray-900" />
                  <div className="flex justify-between gap-3 py-2"><span className="text-base font-bold text-gray-900">Seller net payout</span><span className="shrink-0 text-base font-bold font-mono tabular-nums text-gray-900">{formatCents(selected.amountCents)}</span></div>
                  <p className="break-words pt-1 text-[11px] text-gray-400">
                    Reconciliation: {formatCents(selected.subtotalCents)}
                    {discount > 0 && ` − ${formatCents(discount)} (coupon)`}
                    {` − ${formatCents(selected.platformFeeCents)} (commission) − ${formatCents(selected.stripeFeeCents)} (Stripe)`}
                    {` = ${formatCents(selected.subtotalCents - discount - selected.platformFeeCents - selected.stripeFeeCents)}`}
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
                          <button
                            type="button"
                            onClick={() => handleCopyId(String(item.value))}
                            className="shrink-0 rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                          >
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
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            Close
          </button>
        </SheetFooter>
      </Sheet>
    </div>
  )
}
