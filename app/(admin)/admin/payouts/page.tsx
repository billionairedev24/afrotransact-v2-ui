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

  function toggle() {
    if (open) { setOpen(false); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.right - 176 })
    }
    setOpen(true)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
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

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Payouts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and monitor all seller payout settlements.</p>
        </div>
        <button
          onClick={triggerOnboardingReminders}
          disabled={triggeringReminders}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {triggeringReminders ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
          Send Onboarding Reminders
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total", value: summary?.totalCents ?? 0, icon: DollarSign, color: "text-gray-900" },
          { label: "Settling", value: summary?.pendingSettlementCents ?? 0, icon: Clock, color: "text-yellow-700" },
          { label: "Ready", value: summary?.readyForTransferCents ?? 0, icon: ArrowRightLeft, color: "text-blue-700" },
          { label: "Transferred", value: summary?.transferredCents ?? 0, icon: CheckCircle2, color: "text-green-700" },
          { label: "Failed", value: summary?.failedCents ?? 0, icon: XCircle, color: "text-red-700" },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-xl border border-gray-200 p-4 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-xs text-gray-500">{card.label}</span>
              </div>
              <p className={`text-lg font-bold ${card.color}`}>{formatCents(card.value)}</p>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-base font-semibold text-gray-900">All Transfers</h2>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-gray-500" />
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
        </div>

        {transfers.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-500 text-sm">No transfers found.</div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_120px_90px_90px_110px_90px_44px] gap-2 px-5 py-2.5 text-xs text-gray-500 font-medium uppercase tracking-wide border-b border-gray-100">
              <span>Transfer ID</span>
              <span>Store</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Fee</span>
              <span className="text-center">Status</span>
              <span className="text-right">Date</span>
              <span />
            </div>
            <div className="divide-y divide-gray-100">
              {transfers.map((t) => (
                <div key={t.id} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_90px_90px_110px_90px_44px] gap-2 px-5 py-3 items-center hover:bg-gray-50 transition-colors">
                  <span className="text-xs text-gray-900 font-mono truncate">{t.id.substring(0, 8)}…</span>
                  <span className="text-xs text-gray-500 font-mono truncate">{t.storeId.substring(0, 8)}…</span>
                  <span className="text-sm text-gray-900 font-semibold text-right">{formatCents(t.amountCents)}</span>
                  <span className="text-xs text-gray-500 text-right">{formatCents(t.platformFeeCents)}</span>
                  <div className="flex justify-center"><StatusBadge status={t.status} /></div>
                  <span className="text-xs text-gray-500 text-right">{formatDate(t.createdAt)}</span>
                  <RowActionMenu onView={() => setSelected(t)} />
                </div>
              ))}
            </div>
          </>
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
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Net Payout</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCents(selected.amountCents)}</p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Financial Breakdown</h3>
                <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-1">
                  <div className="flex justify-between py-1.5"><span className="text-sm text-gray-600">Product subtotal</span><span className="text-sm font-mono text-gray-900">{formatCents(selected.subtotalCents)}</span></div>
                  {discount > 0 && (
                    <div className="flex justify-between py-1.5"><span className="text-sm text-green-600">{selected.couponCode ? `Coupon (${selected.couponCode})` : "Coupon savings"}</span><span className="text-sm font-mono text-green-600">−{formatCents(discount)}</span></div>
                  )}
                  {selected.shippingCents > 0 && <div className="flex justify-between py-1.5"><span className="text-sm text-gray-600">Shipping</span><span className="text-sm font-mono text-gray-900">{formatCents(selected.shippingCents)}</span></div>}
                  {selected.taxCents > 0 && <div className="flex justify-between py-1.5"><span className="text-sm text-gray-600">Tax</span><span className="text-sm font-mono text-gray-900">{formatCents(selected.taxCents)}</span></div>}
                  <div className="border-t border-gray-200 my-2" />
                  <div className="flex justify-between py-1.5"><span className="text-sm font-semibold text-gray-900">Customer paid</span><span className="text-sm font-mono font-semibold text-gray-900">{formatCents(customerPaid)}</span></div>
                  <div className="border-t border-dashed border-gray-300 my-3" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 pb-1">Deductions</p>
                  {discount > 0 && <div className="flex justify-between py-1.5"><span className="text-sm text-red-600">{selected.couponCode ? `Coupon discount (${selected.couponCode})` : "Coupon discount"}</span><span className="text-sm font-mono text-red-600">−{formatCents(discount)}</span></div>}
                  <div className="flex justify-between py-1.5"><span className="text-sm text-red-600">Platform commission</span><span className="text-sm font-mono text-red-600">−{formatCents(selected.platformFeeCents)}</span></div>
                  {selected.stripeFeeCents > 0 && <div className="flex justify-between py-1.5"><span className="text-sm text-red-600">Stripe processing fee</span><span className="text-sm font-mono text-red-600">−{formatCents(selected.stripeFeeCents)}</span></div>}
                  {selected.taxCents > 0 && <div className="flex justify-between py-1.5"><span className="text-sm text-red-600">Tax remitted</span><span className="text-sm font-mono text-red-600">−{formatCents(selected.taxCents)}</span></div>}
                  {selected.shippingCents > 0 && <div className="flex justify-between py-1.5"><span className="text-sm text-red-600">Shipping remitted</span><span className="text-sm font-mono text-red-600">−{formatCents(selected.shippingCents)}</span></div>}
                  <div className="border-t-2 border-gray-900 my-2" />
                  <div className="flex justify-between py-2"><span className="text-base font-bold text-gray-900">Seller net payout</span><span className="text-base font-bold text-gray-900 font-mono">{formatCents(selected.amountCents)}</span></div>
                  <p className="text-[11px] text-gray-400 pt-1">
                    Reconciliation: {formatCents(selected.subtotalCents)}
                    {discount > 0 && ` − ${formatCents(discount)} (coupon)`}
                    {` − ${formatCents(selected.platformFeeCents)} (commission) − ${formatCents(selected.stripeFeeCents)} (Stripe)`}
                    {` = ${formatCents(selected.subtotalCents - discount - selected.platformFeeCents - selected.stripeFeeCents)}`}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Transfer Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <div key={item.label} className="rounded-xl border border-gray-200 p-3.5 bg-white">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">{item.label}</p>
                      <div className="flex items-center gap-2">
                        <p className="break-all text-sm font-medium text-gray-900 truncate">{item.value}</p>
                        {item.copyable && item.value !== "—" && (
                          <button
                            onClick={() => handleCopyId(String(item.value))}
                            className="shrink-0 rounded p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
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
