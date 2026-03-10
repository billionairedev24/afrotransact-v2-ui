"use client"

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getAdminSellers,
  getAdminSellerStats,
  getAdminSellerDetail,
  reviewAdminSeller,
  triggerOnboardingReminders,
  sendSellerReminder,
} from "@/lib/api"
import type { OnboardingStats, AdminSellerDetail } from "@/lib/api"
import { toast } from "sonner"
import {
  Store,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Check,
  X as XIcon,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  ExternalLink,
  CreditCard,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Loader2,
  Bell,
} from "lucide-react"

interface AdminSellerRow {
  id: string
  businessName: string
  entityType: string | null
  status: string
  onboardingStatus: string
  onboardingStep: number
  contactEmail: string | null
  createdAt: string
  submittedAt: string | null
  approvedAt: string | null
}

type ActionMode = "none" | "reject" | "request"

const TABS = [
  { key: "all", label: "All" },
  { key: "in_progress", label: "Pending" },
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "In Review" },
  { key: "needs_action", label: "Requires Info" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  started:         { label: "Pending",         cls: "bg-gray-500/15 text-gray-400" },
  in_progress:     { label: "Pending",         cls: "bg-gray-500/15 text-gray-400" },
  pending:         { label: "Pending",         cls: "bg-gray-500/15 text-gray-400" },
  submitted:       { label: "Submitted",       cls: "bg-yellow-500/15 text-yellow-400" },
  pending_review:  { label: "Submitted",       cls: "bg-yellow-500/15 text-yellow-400" },
  under_review:    { label: "In Review",       cls: "bg-blue-500/15 text-blue-400" },
  needs_action:    { label: "Requires Info",   cls: "bg-orange-500/15 text-orange-400" },
  approved:        { label: "Approved",        cls: "bg-emerald-500/15 text-emerald-400" },
  active:          { label: "Approved",        cls: "bg-emerald-500/15 text-emerald-400" },
  rejected:        { label: "Rejected",        cls: "bg-red-500/15 text-red-400" },
  suspended:       { label: "Suspended",       cls: "bg-red-500/15 text-red-400" },
}

const STEP_LABELS: Record<number, string> = {
  1: "Business Info",
  2: "Entity Details",
  3: "Store Setup",
  4: "Documents",
  5: "Subscription",
  6: "Payment Setup",
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtAge(iso: string | null) {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return "< 1h"
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status.toLowerCase().replace(/ /g, "_")] ?? { label: status, cls: "bg-white/10 text-gray-400" }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${c.cls}`}>{c.label}</span>
}

const PAGE_SIZE = 15

export default function AdminSellersPage() {
  const { status: sessionStatus } = useSession()

  const [stats, setStats] = useState<OnboardingStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [sellers, setSellers] = useState<AdminSellerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  const [selectedDetail, setSelectedDetail] = useState<AdminSellerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [panelAction, setPanelAction] = useState<ActionMode>("none")

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const token = await getAccessToken()
      if (!token) return
      setStats(await getAdminSellerStats(token))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load stats")
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadSellers = useCallback(async (status: string, pg: number) => {
    try {
      setLoading(true)
      const token = await getAccessToken()
      if (!token) return
      const res = await getAdminSellers(token, undefined, pg, PAGE_SIZE, status === "all" ? undefined : status)
      setSellers(res.content as unknown as AdminSellerRow[])
      setTotalPages(res.totalPages)
      setTotalElements(res.totalElements)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load sellers")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      loadStats()
      loadSellers(activeTab, page)
    } else {
      setLoading(false)
      setStatsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus])

  function changeTab(tab: string) {
    setActiveTab(tab)
    setPage(0)
    loadSellers(tab, 0)
  }

  function changePage(p: number) {
    setPage(p)
    loadSellers(activeTab, p)
  }

  async function openDetail(sellerId: string, mode: ActionMode = "none") {
    setPanelAction(mode)
    setDetailLoading(true)
    setSelectedDetail(null)
    try {
      const token = await getAccessToken()
      if (!token) return
      setSelectedDetail(await getAdminSellerDetail(token, sellerId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load seller details")
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setSelectedDetail(null)
    setDetailLoading(false)
    setPanelAction("none")
  }

  async function handleReview(sellerId: string, action: string, reason?: string, adminNotes?: string) {
    try {
      const token = await getAccessToken()
      if (!token) return
      await reviewAdminSeller(token, sellerId, action, reason, adminNotes)
      const labels: Record<string, string> = { approve: "Approved", reject: "Rejected", request_info: "Requested info from" }
      toast.success(`${labels[action] ?? action} seller successfully`)
      closeDetail()
      loadStats()
      loadSellers(activeTab, page)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review action failed")
    }
  }

  async function handleTriggerReminders() {
    try {
      const token = await getAccessToken()
      if (!token) return
      const res = await triggerOnboardingReminders(token)
      toast.success(`Triggered reminders for ${res.triggered ?? 0} seller(s)`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to trigger reminders")
    }
  }

  async function handleSendReminder(sellerId: string, businessName: string) {
    try {
      const token = await getAccessToken()
      if (!token) return
      await sendSellerReminder(token, sellerId)
      toast.success(`Reminder sent to ${businessName}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send reminder")
    }
  }

  if (sessionStatus !== "authenticated" && !loading) {
    return <div className="flex items-center justify-center py-20 text-gray-400">Sign in as admin to manage sellers.</div>
  }

  const statCards = [
    { label: "Total Sellers", value: stats?.totalSellers ?? 0, icon: Users, color: "text-white" },
    { label: "Pending", value: (stats?.started ?? 0) + (stats?.inProgress ?? 0), icon: Clock, color: "text-gray-400" },
    { label: "Submitted", value: (stats?.submitted ?? 0) + (stats?.underReview ?? 0), icon: Clock, color: "text-yellow-400" },
    { label: "Approved", value: stats?.approved ?? 0, icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Requires Info", value: stats?.needsAction ?? 0, icon: AlertTriangle, color: "text-orange-400" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Seller Management</h1>
          <p className="text-sm text-gray-400 mt-1">Review applications, manage onboarding, and monitor seller status.</p>
        </div>
        <button
          onClick={handleTriggerReminders}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
        >
          <Bell className="h-4 w-4" />
          Trigger All Reminders
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/5 p-5" style={{ background: "hsl(0 0% 11%)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{c.label}</p>
                <p className={`text-2xl font-bold mt-1 ${c.color}`}>{statsLoading ? "…" : c.value}</p>
              </div>
              <div className={`rounded-xl p-2.5 bg-white/5 ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Donut + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {stats && !statsLoading && (
          <div className="lg:col-span-1 rounded-xl border border-white/5 p-5" style={{ background: "hsl(0 0% 11%)" }}>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Onboarding Funnel</h3>
            <DonutChart stats={stats} />
          </div>
        )}

        <div className={stats && !statsLoading ? "lg:col-span-3" : "lg:col-span-4"}>
          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => changeTab(t.key)}
                className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  activeTab === t.key ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-xl border border-white/5" style={{ background: "hsl(0 0% 11%)" }}>
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Business Name", "Entity Type", "Status", "Step", "Age", "Submitted", ""].map((h) => (
                      <th key={h || "actions"} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-500 mx-auto" />
                      </td>
                    </tr>
                  ) : sellers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-sm text-gray-500">
                        No sellers found.
                      </td>
                    </tr>
                  ) : (
                    sellers.map((s) => (
                      <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <Store className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{s.businessName}</p>
                              {s.contactEmail && <p className="text-xs text-gray-500 truncate">{s.contactEmail}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">{s.entityType || "—"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={s.onboardingStatus} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {STEP_LABELS[s.onboardingStep] || `Step ${s.onboardingStep}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{fmtAge(s.createdAt)}</td>
                        <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{fmtDate(s.submittedAt)}</td>
                        <td className="px-4 py-3">
                          <ActionDropdown
                            seller={s}
                            onView={() => openDetail(s.id)}
                            onApprove={() => handleReview(s.id, "approve")}
                            onReject={() => openDetail(s.id, "reject")}
                            onRequestInfo={() => openDetail(s.id, "request")}
                            onSendReminder={() => handleSendReminder(s.id, s.businessName)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
                <p className="text-xs text-gray-500">
                  Page {page + 1} of {totalPages} &middot; {totalElements} total
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => changePage(page - 1)}
                    disabled={page === 0}
                    className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => changePage(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Slide-Over */}
      <DetailPanel
        detail={selectedDetail}
        loading={detailLoading}
        initialMode={panelAction}
        onClose={closeDetail}
        onReview={handleReview}
      />
    </div>
  )
}

/* ─── Donut Chart (pure SVG) ─────────────────────────────────────────────── */

function DonutChart({ stats }: { stats: OnboardingStats }) {
  const segments = [
    { label: "Approved", value: stats.approved, color: "#34d399" },
    { label: "Submitted", value: stats.submitted, color: "#facc15" },
    { label: "In Review", value: stats.underReview, color: "#60a5fa" },
    { label: "Pending", value: stats.inProgress + stats.started, color: "#94a3b8" },
    { label: "Requires Info", value: stats.needsAction, color: "#fb923c" },
    { label: "Rejected", value: stats.rejected, color: "#f87171" },
  ].filter((s) => s.value > 0)

  const total = segments.reduce((a, s) => a + s.value, 0)
  if (total === 0) return <p className="text-sm text-gray-500">No data yet.</p>

  const R = 42
  const C = 2 * Math.PI * R
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {segments.map((seg) => {
            const dash = C * (seg.value / total)
            const cur = offset
            offset += dash
            return <circle key={seg.label} cx="50" cy="50" r={R} fill="none" stroke={seg.color} strokeWidth="12" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-cur} />
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-white">{total}</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Total</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1.5 w-full">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-gray-400 flex-1">{seg.label}</span>
            <span className="text-white font-medium">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Action Dropdown ────────────────────────────────────────────────────── */

function ActionDropdown({
  seller,
  onView,
  onApprove,
  onReject,
  onRequestInfo,
  onSendReminder,
}: {
  seller: AdminSellerRow
  onView: () => void
  onApprove: () => void
  onReject: () => void
  onRequestInfo: () => void
  onSendReminder: () => void
}) {
  const [open, setOpen] = useState(false)
  const [positioned, setPositioned] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean }>({ top: 0, left: 0, openUp: false })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const ob = (seller.onboardingStatus || "started").toLowerCase()
  const isSubmitted = ob === "submitted" || ob === "pending_review" || ob === "under_review"
  const isApproved = ob === "approved" || ob === "active"
  const _isRejected = ob === "rejected"
  const isSuspended = ob === "suspended"
  const canApprove = isSubmitted || ob === "under_review"
  const canReject = isSubmitted || ob === "needs_action"
  const canRequestInfo = isSubmitted || ob === "needs_action"
  const canSuspend = isApproved && !isSuspended
  const canRemind = ob !== "submitted" && ob !== "under_review" && ob !== "approved" && ob !== "rejected" && ob !== "active" && ob !== "pending_review"

  const recalc = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuWidth = 192
    const itemCount = [true, canApprove, canReject, canRequestInfo, canSuspend, canRemind].filter(Boolean).length
    const menuHeight = Math.max(itemCount * 40 + 16, 100)
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < menuHeight + 20
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))
    setCoords({ top: openUp ? rect.top - 4 : rect.bottom + 4, left, openUp })
    setPositioned(true)
  }, [canApprove, canReject, canRequestInfo, canSuspend])

  useEffect(() => {
    if (!open) { setPositioned(false); return }
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const handleScroll = () => recalc()
    document.addEventListener("mousedown", handler)
    window.addEventListener("scroll", handleScroll, true)
    return () => { document.removeEventListener("mousedown", handler); window.removeEventListener("scroll", handleScroll, true) }
  }, [open, recalc])

  useLayoutEffect(() => {
    if (!open) return
    recalc()
  }, [open, recalc])

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen((v) => !v)} className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && positioned && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-48 rounded-xl border border-white/10 py-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
            style={{
              background: "hsl(0 0% 13%)",
              top: coords.openUp ? undefined : coords.top,
              bottom: coords.openUp ? window.innerHeight - coords.top : undefined,
              left: coords.left,
              transformOrigin: coords.openUp ? "bottom right" : "top right",
            }}
          >
            <DdItem icon={<Eye className="h-3.5 w-3.5" />} onClick={() => { onView(); setOpen(false) }}>
              View Details
            </DdItem>
            {canApprove && (
              <DdItem icon={<Check className="h-3.5 w-3.5" />} className="text-emerald-400" onClick={() => { onApprove(); setOpen(false) }}>
                Approve
              </DdItem>
            )}
            {canReject && (
              <DdItem icon={<XIcon className="h-3.5 w-3.5" />} className="text-red-400" onClick={() => { onReject(); setOpen(false) }}>
                Reject
              </DdItem>
            )}
            {canRequestInfo && (
              <DdItem icon={<MessageSquare className="h-3.5 w-3.5" />} className="text-amber-400" onClick={() => { onRequestInfo(); setOpen(false) }}>
                Request More Info
              </DdItem>
            )}
            {canSuspend && (
              <DdItem icon={<XIcon className="h-3.5 w-3.5" />} className="text-red-400" onClick={() => { onReject(); setOpen(false) }}>
                Suspend Seller
              </DdItem>
            )}
            {canRemind && (
              <DdItem icon={<Bell className="h-3.5 w-3.5" />} className="text-blue-400" onClick={() => { onSendReminder(); setOpen(false) }}>
                Send Reminder
              </DdItem>
            )}
          </div>,
          document.body
        )}
    </>
  )
}

function DdItem({ icon, children, onClick, className = "" }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 transition-colors ${className || "text-gray-300"}`}>
      {icon}
      {children}
    </button>
  )
}

/* ─── Detail Slide-Over Panel ────────────────────────────────────────────── */

function DetailPanel({
  detail,
  loading,
  initialMode,
  onClose,
  onReview,
}: {
  detail: AdminSellerDetail | null
  loading: boolean
  initialMode: ActionMode
  onClose: () => void
  onReview: (id: string, action: string, reason?: string, adminNotes?: string) => Promise<void>
}) {
  const [mode, setMode] = useState<ActionMode>("none")
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setMode(initialMode)
    setReason("")
    setMessage("")
    setSubmitting(false)
  }, [detail?.id, initialMode])

  const open = detail !== null || loading

  async function submit(action: string, text?: string) {
    if (!detail) return
    setSubmitting(true)
    try {
      await onReview(detail.id, action, action === "reject" || action === "request_info" ? text : undefined, action === "request_info" ? text : undefined)
    } finally {
      setSubmitting(false)
    }
  }

  const st = (detail?.onboardingStatus || "").toLowerCase()
  const canApprove = st === "submitted" || st === "pending_review" || st === "under_review"

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-lg transform transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "hsl(0 0% 9%)" }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Seller Details</h2>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              </div>
            )}

            {detail && !loading && (
              <>
                {/* Business Info */}
                <Section title="Business Information">
                  <InfoTable>
                    <InfoRow icon={<Building2 className="h-4 w-4" />} label="Business Name" value={detail.businessName} />
                    <InfoRow icon={<Store className="h-4 w-4" />} label="Entity Type" value={detail.entityType || "—"} />
                    <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={detail.contactEmail || "—"} />
                    <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={detail.contactPhone || "—"} />
                    <InfoRow icon={<Globe className="h-4 w-4" />} label="Website" value={detail.website || "—"} />
                    <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={detail.businessAddress || "—"} />
                  </InfoTable>
                  {detail.businessDescription && (
                    <div className="mt-3 rounded-xl border border-white/5 px-4 py-3" style={{ background: "hsl(0 0% 11%)" }}>
                      <p className="text-xs text-gray-500 mb-1">Description</p>
                      <p className="text-sm text-gray-300 leading-relaxed">{detail.businessDescription}</p>
                    </div>
                  )}
                </Section>

                {/* Stores */}
                {detail.stores.length > 0 && (
                  <Section title="Stores">
                    <div className="space-y-2">
                      {detail.stores.map((store) => (
                        <div key={store.id} className="rounded-xl border border-white/5 px-4 py-3 flex items-center gap-3" style={{ background: "hsl(0 0% 11%)" }}>
                          {store.logoUrl ? (
                            <img src={store.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center">
                              <Store className="h-4 w-4 text-gray-500" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">{store.name}</p>
                            <p className="text-xs text-gray-500">/{store.slug}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Documents */}
                <Section title={`Documents (${detail.documents.length})`}>
                  {detail.documents.length === 0 ? (
                    <p className="text-sm text-gray-500">No documents uploaded.</p>
                  ) : (
                    <div className="space-y-3">
                      {detail.documents.map((doc) => {
                        const isImage = doc.mimeType?.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(doc.fileName)
                        return (
                          <div key={doc.id} className="rounded-xl border border-white/5 p-4" style={{ background: "hsl(0 0% 11%)" }}>
                            <div className="flex items-center gap-3 mb-2">
                              <FileText className="h-4 w-4 text-gray-500 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-200 truncate">{doc.fileName}</p>
                                <p className="text-xs text-gray-500 capitalize">{doc.documentType.replace(/_/g, " ")}</p>
                              </div>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${doc.status === "approved" ? "bg-green-500/10 text-green-400" : doc.status === "rejected" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                                {doc.status || "pending"}
                              </span>
                              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1.5 text-primary hover:text-white hover:bg-white/5 transition-colors" title="Open document">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>
                            {isImage && doc.fileUrl && (
                              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="block mt-2">
                                <img
                                  src={doc.fileUrl}
                                  alt={doc.fileName}
                                  className="w-full max-h-48 object-contain rounded-lg border border-white/5 bg-black/20"
                                />
                              </a>
                            )}
                            {!isImage && doc.fileUrl && (
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" /> View Document
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Section>

                {/* Stripe */}
                <Section title="Stripe Connect">
                  <InfoTable>
                    <InfoRow icon={<CreditCard className="h-4 w-4" />} label="Connect Account ID" value={detail.stripeAccountId || "Not created"} mono />
                    <InfoRow icon={<CreditCard className="h-4 w-4" />} label="Connect Country" value={detail.stripeConnectCountry || "—"} />
                    <InfoRow icon={<CreditCard className="h-4 w-4" />} label="Connect Business Type" value={detail.stripeConnectBusinessType || "—"} />
                    <InfoRow icon={<CheckCircle2 className="h-4 w-4" />} label="Charges" value={detail.chargesEnabled ? "Enabled" : "Disabled"} valueColor={detail.chargesEnabled ? "text-emerald-400" : "text-red-400"} />
                    <InfoRow icon={<CheckCircle2 className="h-4 w-4" />} label="Payouts" value={detail.payoutsEnabled ? "Enabled" : "Disabled"} valueColor={detail.payoutsEnabled ? "text-emerald-400" : "text-red-400"} />
                  </InfoTable>
                </Section>

                <Section title="Stripe Billing (Subscription Charges)">
                  <InfoTable>
                    <InfoRow icon={<CreditCard className="h-4 w-4" />} label="Customer ID" value={detail.stripeCustomerId || "Not created"} mono />
                    <InfoRow icon={<CreditCard className="h-4 w-4" />} label="Default Payment Method" value={detail.stripeDefaultPmId || "No card on file"} mono />
                  </InfoTable>
                </Section>

                {/* Status & Dates */}
                <Section title="Status">
                  <InfoTable>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-gray-400">Current Status</span>
                      <StatusBadge status={detail.onboardingStatus} />
                    </div>
                    <InfoRow label="Created" value={fmtDate(detail.createdAt)} />
                    <InfoRow label="Submitted" value={fmtDate(detail.submittedAt)} />
                    <InfoRow label="Approved" value={fmtDate(detail.approvedAt)} />
                  </InfoTable>
                  {detail.rejectionReason && (
                    <div className="mt-3 rounded-xl border border-red-500/20 px-4 py-3" style={{ background: "hsl(0 0% 11%)" }}>
                      <p className="text-xs text-red-400/70 mb-1">Rejection Reason</p>
                      <p className="text-sm text-red-400">{detail.rejectionReason}</p>
                    </div>
                  )}
                  {detail.adminNotes && (
                    <div className="mt-2 rounded-xl border border-white/5 px-4 py-3" style={{ background: "hsl(0 0% 11%)" }}>
                      <p className="text-xs text-gray-500 mb-1">Admin Notes</p>
                      <p className="text-sm text-gray-300">{detail.adminNotes}</p>
                    </div>
                  )}
                </Section>

                {/* Actions */}
                <section className="pb-4">
                  {mode === "none" && (
                    <div className="flex gap-3">
                      {canApprove && (
                        <button
                          onClick={() => submit("approve")}
                          disabled={submitting}
                          className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                        >
                          {submitting ? "Approving…" : "Approve"}
                        </button>
                      )}
                      <button onClick={() => setMode("reject")} className="flex-1 rounded-xl bg-red-600/20 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-600/30 transition-colors">
                        Reject
                      </button>
                      <button onClick={() => setMode("request")} className="flex-1 rounded-xl bg-amber-600/20 px-4 py-2.5 text-sm font-medium text-amber-400 hover:bg-amber-600/30 transition-colors">
                        Request Info
                      </button>
                    </div>
                  )}

                  {mode === "reject" && (
                    <div className="space-y-3">
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Rejection reason…"
                        rows={3}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500/50 resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setMode("none")} className="rounded-xl px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (!reason.trim()) { toast.error("Please provide a reason"); return }
                            submit("reject", reason.trim())
                          }}
                          disabled={submitting || !reason.trim()}
                          className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                        >
                          {submitting ? "Rejecting…" : "Confirm Reject"}
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === "request" && (
                    <div className="space-y-3">
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="What information do you need?"
                        rows={3}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setMode("none")} className="rounded-xl px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (!message.trim()) { toast.error("Please provide a message"); return }
                            submit("request_info", message.trim())
                          }}
                          disabled={submitting || !message.trim()}
                          className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                        >
                          {submitting ? "Sending…" : "Send Request"}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Shared micro-components ────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </section>
  )
}

function InfoTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 divide-y divide-white/5" style={{ background: "hsl(0 0% 11%)" }}>
      {children}
    </div>
  )
}

function InfoRow({ icon, label, value, mono, valueColor }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        {icon && <span className="text-gray-500">{icon}</span>}
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <span className={`text-sm text-right max-w-[55%] truncate ${valueColor || "text-gray-200"} ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  )
}
