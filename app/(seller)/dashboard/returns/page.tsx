"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { RotateCcw, AlertTriangle, CheckCircle2, Clock, XCircle, Package, ChevronRight } from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import {
  getCurrentSeller,
  getSellerStores,
  sellerListReturns,
  sellerDecideReturn,
  sellerMarkReturnReceived,
  sellerInspectReturn,
  type ReturnDto,
  type ReturnStatus,
} from "@/lib/api"
import { pickPrimarySellerStoreId } from "@/lib/seller-store"

const fmt = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)

const STATUS_TONE: Record<ReturnStatus, { dot: string; text: string }> = {
  requested:              { dot: "bg-amber-500",   text: "text-amber-700" },
  approved:               { dot: "bg-blue-500",    text: "text-blue-700" },
  approved_partial:       { dot: "bg-blue-500",    text: "text-blue-700" },
  denied:                 { dot: "bg-red-500",     text: "text-red-700" },
  label_issued:           { dot: "bg-blue-500",    text: "text-blue-700" },
  in_transit:             { dot: "bg-blue-500",    text: "text-blue-700" },
  received:               { dot: "bg-violet-500",  text: "text-violet-700" },
  inspected:              { dot: "bg-violet-500",  text: "text-violet-700" },
  completed:              { dot: "bg-emerald-500", text: "text-emerald-700" },
  rejected_on_inspection: { dot: "bg-red-500",     text: "text-red-700" },
  cancelled:              { dot: "bg-gray-400",    text: "text-gray-600" },
  expired:                { dot: "bg-gray-400",    text: "text-gray-600" },
}

const OPEN_STATUSES: ReturnStatus[] = ["requested", "approved", "approved_partial", "label_issued", "in_transit", "received"]

export default function SellerReturnsPage() {
  const { status } = useSession()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [returns, setReturns] = useState<ReturnDto[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReturnDto | null>(null)
  const [tab, setTab] = useState<"open" | "all">("open")

  async function loadStore() {
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const seller = await getCurrentSeller(token)
      const stores = await getSellerStores(token, seller.id)
      const sid = pickPrimarySellerStoreId(stores)
      setStoreId(sid)
      return sid
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load store")
      return null
    }
  }

  async function loadReturns(sid: string) {
    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const res = await sellerListReturns(token, sid, tab === "open" ? OPEN_STATUSES : undefined, 0, 50)
      setReturns(res.content)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load returns")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status !== "authenticated") return
    void loadStore().then((sid) => {
      if (sid) void loadReturns(sid)
    })
  }, [status])

  useEffect(() => {
    if (storeId) void loadReturns(storeId)
  }, [tab])

  async function refresh() {
    if (storeId) await loadReturns(storeId)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <RotateCcw className="h-6 w-6" /> Returns
        </h1>
        <p className="text-sm text-gray-600 mt-1 max-w-2xl">
          Respond within 48 hours. Returns are auto-approved after that — best to take action
          before the SLA expires so you can apply a restocking fee if your policy allows.
        </p>
      </header>

      <div className="border-b border-gray-200 mb-4 flex items-center gap-1">
        <TabBtn active={tab === "open"} onClick={() => setTab("open")}>
          Open
          {returns.length > 0 && tab === "open" && (
            <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
              {returns.length}
            </span>
          )}
        </TabBtn>
        <TabBtn active={tab === "all"} onClick={() => setTab("all")}>All returns</TabBtn>
      </div>

      {err && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 mb-4">{err}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : returns.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-lg py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-900">No {tab === "open" ? "open " : ""}returns</p>
          <p className="text-xs text-gray-500 mt-1">All caught up.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {returns.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSelected(r)}
                className="w-full text-left bg-white rounded-lg border border-gray-200 hover:border-gray-400 px-4 py-3 flex items-center gap-3 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-xs">{r.id.slice(0, 8)}</code>
                    <StatusPill status={r.status} />
                    {r.status === "requested" && (
                      <SlaPill due={r.sellerResponseDueAt} />
                    )}
                  </div>
                  <p className="text-sm text-gray-700">
                    Order <code className="font-mono">{r.orderNumber}</code> &middot; {r.reason.replace(/_/g, " ")}
                    {r.items.length > 0 && (
                      <> &middot; {r.items.reduce((a, b) => a + b.quantity, 0)} item(s)</>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {r.refundAmountCents != null && (
                    <p className="text-sm font-semibold tabular-nums">{fmt(r.refundAmountCents)}</p>
                  )}
                  <ChevronRight className="inline h-4 w-4 text-gray-400 ml-1" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && storeId && (
        <ReturnDetailModal
          ret={selected}
          storeId={storeId}
          onClose={() => setSelected(null)}
          onChange={async () => {
            await refresh()
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px inline-flex items-center ${
        active ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  )
}

function StatusPill({ status }: { status: ReturnStatus }) {
  const t = STATUS_TONE[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${t.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {status.replace(/_/g, " ")}
    </span>
  )
}

function SlaPill({ due }: { due: string }) {
  const dueMs = new Date(due).getTime() - Date.now()
  const overdue = dueMs <= 0
  const hours = Math.max(0, Math.round(dueMs / 3600_000))
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
      overdue ? "bg-red-100 text-red-700" : hours <= 6 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
    }`}>
      <Clock className="h-3 w-3" />
      {overdue ? "Overdue" : `${hours}h to respond`}
    </span>
  )
}

function ReturnDetailModal({
  ret, storeId, onClose, onChange,
}: {
  ret: ReturnDto
  storeId: string
  onClose: () => void
  onChange: () => void
}) {
  const [action, setAction] = useState<"approve" | "approve_partial" | "deny" | null>(null)
  const [partialAmount, setPartialAmount] = useState<string>(((ret.refundAmountCents ?? 0) / 100).toFixed(2))
  const [restockingBps, setRestockingBps] = useState<number>(0)
  const [reason, setReason] = useState("")
  const [sellerNotes, setSellerNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submitDecision() {
    setErr(null)
    if ((action === "deny" || action === "approve_partial") && !reason.trim()) {
      setErr("Reason is required.")
      return
    }
    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const body: Parameters<typeof sellerDecideReturn>[3] = {
        decision: action!,
        restockingFeeBps: action === "deny" ? undefined : restockingBps,
        reason: reason.trim() || undefined,
        sellerNotes: sellerNotes.trim() || undefined,
        provideLabel: action !== "deny",
      }
      if (action === "approve_partial") {
        body.refundAmountCents = Math.round(parseFloat(partialAmount) * 100)
      }
      await sellerDecideReturn(token, storeId, ret.id, body)
      onChange()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function markReceived() {
    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      await sellerMarkReturnReceived(token, storeId, ret.id)
      onChange()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed")
    } finally {
      setSubmitting(false)
    }
  }

  const [damageUsd, setDamageUsd] = useState("")

  async function inspect(rejectOnInspection: boolean) {
    setErr(null)
    if (rejectOnInspection && !reason.trim()) {
      setErr("Rejection reason is required.")
      return
    }
    const damageCents = damageUsd.trim() ? Math.round(parseFloat(damageUsd) * 100) : 0
    if (damageCents > 0 && !reason.trim()) {
      setErr("Reason is required when applying a damage reduction.")
      return
    }
    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      await sellerInspectReturn(token, storeId, ret.id, {
        rejectOnInspection,
        reason: reason.trim() || undefined,
        damageReductionCents: damageCents > 0 ? damageCents : undefined,
      })
      onChange()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed")
    } finally {
      setSubmitting(false)
    }
  }

  const canDecide = ret.status === "requested"
  const canMarkReceived = ["approved", "approved_partial", "label_issued", "in_transit"].includes(ret.status)
  const canInspect = ret.status === "received"

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <header className="px-6 py-5 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Return {ret.id.slice(0, 8)}</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Order <code className="font-mono">{ret.orderNumber}</code> &middot;{" "}
              <span className="capitalize">{ret.reason.replace(/_/g, " ")}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><XCircle className="h-4 w-4" /></button>
        </header>

        <div className="px-6 py-5 overflow-y-auto space-y-5">
          <div className="space-y-2 text-sm">
            <Row label="Status" value={<StatusPill status={ret.status} />} />
            <Row label="Requested refund" value={ret.refundAmountCents != null ? fmt(ret.refundAmountCents) : "—"} />
            <Row label="Items" value={ret.items.reduce((a, b) => a + b.quantity, 0)} />
            {ret.buyerNotes && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Buyer notes</p>
                <p className="text-sm bg-gray-50 border border-gray-200 rounded p-3 whitespace-pre-wrap">{ret.buyerNotes}</p>
              </div>
            )}
          </div>

          {canDecide && (
            <div className="border-t border-gray-200 pt-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Decide</p>
              <div className="grid grid-cols-3 gap-2">
                <DecisionBtn label="Approve" active={action === "approve"} onClick={() => setAction("approve")} variant="approve" />
                <DecisionBtn label="Partial" active={action === "approve_partial"} onClick={() => setAction("approve_partial")} variant="partial" />
                <DecisionBtn label="Deny" active={action === "deny"} onClick={() => setAction("deny")} variant="deny" />
              </div>

              {action === "approve_partial" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Refund amount (USD)</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                  />
                </div>
              )}

              {(action === "approve" || action === "approve_partial") && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Restocking fee % <span className="text-gray-500 normal-case font-medium">(if your policy allows)</span>
                  </label>
                  <input
                    type="number" min="0" max="50"
                    value={restockingBps / 100}
                    onChange={(e) => setRestockingBps(Math.round(parseFloat(e.target.value || "0") * 100))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                  />
                </div>
              )}

              {(action === "deny" || action === "approve_partial") && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Reason {action === "deny" ? "(shown to buyer, required)" : "(shown to buyer)"}
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={2000}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 min-h-[80px] text-sm"
                  />
                </div>
              )}

              {action && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Internal notes (optional)</label>
                  <textarea
                    value={sellerNotes}
                    onChange={(e) => setSellerNotes(e.target.value)}
                    maxLength={2000}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 min-h-[60px] text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {canMarkReceived && (
            <div className="border-t border-gray-200 pt-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Parcel</p>
              {ret.returnTrackingNumber && (
                <p className="text-sm font-mono mb-2">{ret.returnTrackingNumber}</p>
              )}
              <button
                onClick={markReceived}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-40"
              >
                <Package className="h-4 w-4" /> Mark as received
              </button>
            </div>
          )}

          {canInspect && (
            <div className="border-t border-gray-200 pt-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Inspection</p>
              <p className="text-xs text-gray-600">
                Complete to fire the refund pipeline. If the item arrived worse than described,
                reduce the refund by the damage amount. Reject only if the parcel arrived empty
                or completely unusable.
              </p>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Damage reduction (USD, optional)
                </label>
                <input
                  type="number" min="0" step="0.01"
                  value={damageUsd}
                  onChange={(e) => setDamageUsd(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Reason <span className="font-medium text-gray-500 normal-case">(required when reducing or rejecting)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={2000}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 min-h-[60px] text-sm"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => inspect(false)}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-40"
                >
                  <CheckCircle2 className="h-4 w-4" /> Complete + refund
                </button>
                <button
                  onClick={() => inspect(true)}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-40"
                >
                  <XCircle className="h-4 w-4" /> Reject on inspection
                </button>
              </div>
            </div>
          )}

          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          )}
        </div>

        {canDecide && action && (
          <footer className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
            <p className="text-[11px] text-gray-500">
              {action === "deny" ? "Buyer will be notified." : "We'll generate a prepaid label and email it to the buyer."}
            </p>
            <button
              onClick={submitDecision}
              disabled={submitting}
              className="px-5 py-2 rounded-full text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40"
            >
              {submitting ? "Submitting…" : `Submit ${action.replace("_", " ")}`}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  )
}

function DecisionBtn({ label, active, onClick, variant }: {
  label: string; active: boolean; onClick: () => void; variant: "approve" | "partial" | "deny"
}) {
  const baseColor = variant === "approve" ? "emerald" : variant === "partial" ? "blue" : "red"
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${
        active
          ? `bg-${baseColor}-50 border-${baseColor}-500 text-${baseColor}-700`
          : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
      }`}
    >
      {label}
    </button>
  )
}
