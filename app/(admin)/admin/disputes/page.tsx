"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, RefreshCcw, Store, Home } from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import { confirmDialog, promptDialog } from "@/components/ui/confirm"
import { toast } from "sonner"
import {
  ApiError,
  adminListDisputes,
  adminResolveDispute,
  type DisputeDto,
  type DisputeStatus,
} from "@/lib/api"
import { friendlyMessage, logError } from "@/lib/errors"

const OPEN_STATUSES: DisputeStatus[] = ["open", "needs_info", "seller_responded", "escalated"]
const RESOLVED_STATUSES: DisputeStatus[] = ["resolved_refund", "resolved_declined", "withdrawn"]

const TYPE_LABEL: Record<string, string> = {
  not_received: "Not received",
  not_as_described: "Not as described",
  damaged: "Damaged / defective",
  unauthorized: "Unauthorized charge",
  other: "Other",
}

type Tab = "open" | "resolved"

const fmt = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)

export default function AdminDisputesPage() {
  const [tab, setTab] = useState<Tab>("open")
  const [items, setItems] = useState<DisputeDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const res = await adminListDisputes(token, tab === "open" ? OPEN_STATUSES : RESOLVED_STATUSES, 0, 50)
      setItems(res.content)
    } catch (e) {
      logError(e, "disputes.load")
      setError(friendlyMessage(e, "Couldn't load disputes. Please try again."))
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  async function resolve(d: DisputeDto, decision: "refund" | "decline") {
    let refundAmountCents: number | undefined
    let resolutionNotes: string | undefined

    if (decision === "refund") {
      const raw = await promptDialog({
        title: "Refund the buyer",
        description: `Amount to refund for dispute ${d.orderNumber} (USD). This fires the standard refund.`,
        placeholder: "0.00",
        required: true,
        confirmLabel: "Refund",
      })
      if (raw == null) return
      const dollars = parseFloat(raw)
      if (!Number.isFinite(dollars) || dollars <= 0) {
        toast.error("Enter a valid refund amount.")
        return
      }
      refundAmountCents = Math.round(dollars * 100)
    } else {
      const notes = await promptDialog({
        title: "Decline this dispute?",
        description: "Reason (shown to the buyer):",
        placeholder: "Reason for declining",
        multiline: true,
        required: true,
        confirmLabel: "Decline",
      })
      if (notes == null || !notes.trim()) return
      resolutionNotes = notes.trim()
    }

    if (decision === "refund") {
      const notes = await promptDialog({
        title: "Resolution note (optional)",
        description: "Add a note for the record (optional).",
        placeholder: "e.g. Item confirmed not delivered by carrier",
        multiline: true,
      })
      resolutionNotes = notes?.trim() || undefined
    }

    setActing(d.id)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      await adminResolveDispute(token, d.id, { decision, refundAmountCents, resolutionNotes })
      toast.success(decision === "refund" ? "Refund issued" : "Dispute declined")
      await load()
    } catch (e) {
      logError(e, "disputes.resolve")
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to resolve disputes.")
      } else {
        toast.error(friendlyMessage(e, "Couldn't resolve the dispute. Please try again."))
      }
    } finally {
      setActing(null)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldAlert className="h-6 w-6" /> Disputes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer disputes (no send-back). House disputes come straight here; seller disputes
            appear once escalated or after the seller responds. Resolving with a refund fires the
            standard refund path.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCcw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="mb-4 flex items-center gap-1 border-b border-border">
        <TabBtn active={tab === "open"} onClick={() => setTab("open")}>Open</TabBtn>
        <TabBtn active={tab === "resolved"} onClick={() => setTab("resolved")}>Resolved</TabBtn>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No {tab} disputes.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((d) => (
            <li key={d.id}>
              <DisputeRow d={d} isOpen={tab === "open"} acting={acting === d.id} onResolve={resolve} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "resolved_refund" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : status === "resolved_declined" ? "bg-red-50 text-red-700 border-red-200"
    : status === "withdrawn" ? "bg-gray-100 text-gray-600 border-gray-200"
    : status === "escalated" ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-blue-50 text-blue-700 border-blue-200"
  const Icon = status.startsWith("resolved") ? CheckCircle2 : status === "escalated" ? AlertTriangle : Clock
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      <Icon className="h-3 w-3" />
      {status.replace(/_/g, " ")}
    </span>
  )
}

function DisputeRow({
  d, isOpen, acting, onResolve,
}: {
  d: DisputeDto
  isOpen: boolean
  acting: boolean
  onResolve: (d: DisputeDto, decision: "refund" | "decline") => void
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{d.orderNumber}</span>
            <StatusPill status={d.status} />
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {d.house ? <Home className="h-3 w-3" /> : <Store className="h-3 w-3" />}
              {d.house ? "AfroTransact" : "Seller"}
            </span>
          </div>
          <div className="mt-1 text-base font-medium">{TYPE_LABEL[d.type] ?? d.type}</div>
          <div className="text-xs text-muted-foreground">
            Opened {new Date(d.createdAt).toLocaleString()}
            {d.items.length > 0 ? ` · ${d.items.length} item(s)` : " · whole order"}
          </div>
        </div>
        {d.refundAmountCents != null && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Refunded</div>
            <div className="text-sm font-bold tabular-nums">{fmt(d.refundAmountCents)}</div>
          </div>
        )}
      </div>

      {d.buyerNotes && (
        <div className="rounded border border-border bg-muted/50 p-3 text-sm">
          <div className="mb-1 text-xs font-medium text-muted-foreground">What the buyer said</div>
          <div className="whitespace-pre-wrap">{d.buyerNotes}</div>
        </div>
      )}
      {d.sellerNotes && (
        <div className="mt-3 rounded border border-border bg-muted/30 p-3 text-sm">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Seller response</div>
          <div className="whitespace-pre-wrap">{d.sellerNotes}</div>
        </div>
      )}
      {d.evidenceUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {d.evidenceUrls.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="evidence" className="h-16 w-16 rounded border border-border object-cover" />
          ))}
        </div>
      )}
      {d.resolutionNotes && (
        <div className="mt-3 rounded border border-border bg-muted/30 p-3 text-sm">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Resolution</div>
          <div className="whitespace-pre-wrap">{d.resolutionNotes}</div>
        </div>
      )}

      {isOpen && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            disabled={acting}
            onClick={() => onResolve(d, "refund")}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Refund buyer
          </button>
          <button
            disabled={acting}
            onClick={() => onResolve(d, "decline")}
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  )
}
