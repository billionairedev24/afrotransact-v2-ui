"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock, FileText, RefreshCcw } from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import {
  adminListBusinessTypeChangeRequests,
  adminResolveBusinessTypeChange,
  type BusinessTypeChangeRequestDto,
} from "@/lib/api"

const OPEN_STATUSES = ["pending", "needs_more_info"]
const RESOLVED_STATUSES = ["approved", "rejected", "withdrawn"]

type Tab = "open" | "resolved"

export default function AdminBusinessTypeChangeRequestsPage() {
  const [tab, setTab] = useState<Tab>("open")
  const [items, setItems] = useState<BusinessTypeChangeRequestDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const res = await adminListBusinessTypeChangeRequests(token, {
        status: tab === "open" ? OPEN_STATUSES : RESOLVED_STATUSES,
        size: 50,
      })
      setItems(res.content)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load requests")
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  async function resolve(req: BusinessTypeChangeRequestDto,
                         decision: "approved" | "rejected" | "needs_more_info") {
    let adminNotes: string | undefined
    let infoRequest: string | undefined

    if (decision === "rejected") {
      adminNotes = window.prompt("Reason for rejection (shown to the seller):") ?? ""
      if (!adminNotes.trim()) return
    } else if (decision === "needs_more_info") {
      infoRequest = window.prompt(
        "What does the seller need to provide? (shown verbatim in their dashboard):",
      ) ?? ""
      if (!infoRequest.trim()) return
    } else if (decision === "approved") {
      if (!window.confirm(
        `Approve change for seller ${req.sellerId.slice(0, 8)}…?\n\n` +
        `${req.currentBusinessType} → ${req.newBusinessType}\n\n` +
        `This will update their seller profile immediately.`,
      )) return
    }

    setActing(req.id)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      await adminResolveBusinessTypeChange(token, req.id, {
        decision,
        adminNotes,
        infoRequest,
      })
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed")
    } finally {
      setActing(null)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Business-type change requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sellers asking to change "What you sell" after onboarding submit.
            Approving updates their seller profile immediately and re-emits the
            relevant compliance events.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCcw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="border-b border-border mb-4 flex items-center gap-1">
        <TabBtn active={tab === "open"} onClick={() => setTab("open")}>
          Open
        </TabBtn>
        <TabBtn active={tab === "resolved"} onClick={() => setTab("resolved")}>
          Resolved
        </TabBtn>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded">
          No {tab} requests.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id}>
              <RequestRow
                req={r}
                isOpen={tab === "open"}
                acting={acting === r.id}
                onResolve={resolve}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function TabBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : status === "rejected" ? "bg-red-50 text-red-700 border-red-200"
    : status === "needs_more_info" ? "bg-amber-50 text-amber-700 border-amber-200"
    : status === "withdrawn" ? "bg-gray-100 text-gray-600 border-gray-200"
    : "bg-blue-50 text-blue-700 border-blue-200"
  const Icon =
    status === "approved" ? CheckCircle2
    : status === "needs_more_info" ? AlertTriangle
    : Clock
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded px-2 py-0.5 ${cls}`}>
      <Icon className="h-3 w-3" />
      {status.replace(/_/g, " ")}
    </span>
  )
}

function RequestRow({
  req, isOpen, acting, onResolve,
}: {
  req: BusinessTypeChangeRequestDto
  isOpen: boolean
  acting: boolean
  onResolve: (req: BusinessTypeChangeRequestDto,
              decision: "approved" | "rejected" | "needs_more_info") => void
}) {
  const submitted = new Date(req.submittedAt).toLocaleString()
  return (
    <div className="border border-border rounded-md p-4 bg-card">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs text-muted-foreground">{req.sellerId.slice(0, 8)}…</code>
            <StatusPill status={req.status} />
            <span className="text-xs text-muted-foreground">submitted {submitted}</span>
          </div>
          <div className="text-base font-medium mt-1">
            {req.currentBusinessType} <span className="text-muted-foreground">→</span> {req.newBusinessType}
          </div>
          {(req.currentEntityType || req.newEntityType) && (
            <div className="text-xs text-muted-foreground">
              entity: {req.currentEntityType ?? "—"} → {req.newEntityType ?? "(unchanged)"}
            </div>
          )}
        </div>
      </div>

      <div className="text-sm bg-muted/50 border border-border rounded p-3">
        <div className="text-xs font-medium text-muted-foreground mb-1">Justification</div>
        <div className="whitespace-pre-wrap">{req.justification}</div>
      </div>

      {req.infoRequest && (
        <div className="text-sm bg-amber-50 border border-amber-200 rounded p-3 mt-3">
          <div className="text-xs font-medium text-amber-800 mb-1">Info requested</div>
          <div className="text-amber-900 whitespace-pre-wrap">{req.infoRequest}</div>
        </div>
      )}
      {req.adminNotes && (
        <div className="text-sm bg-muted/30 border border-border rounded p-3 mt-3">
          <div className="text-xs font-medium text-muted-foreground mb-1">Admin notes</div>
          <div className="whitespace-pre-wrap">{req.adminNotes}</div>
        </div>
      )}

      {isOpen && (
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            disabled={acting}
            onClick={() => onResolve(req, "approved")}
            className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded font-medium disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={acting}
            onClick={() => onResolve(req, "needs_more_info")}
            className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded font-medium disabled:opacity-50"
          >
            Request more info
          </button>
          <button
            disabled={acting}
            onClick={() => onResolve(req, "rejected")}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded font-medium disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
