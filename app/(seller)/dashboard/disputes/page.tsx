"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { ShieldAlert, RefreshCcw, CheckCircle2, Clock, AlertTriangle } from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import { friendlyMessage, logError } from "@/lib/errors"
import { toast } from "sonner"
import { promptDialog } from "@/components/ui/confirm"
import { sellerListDisputes, sellerRespondDispute, type DisputeDto, type DisputeStatus } from "@/lib/api"
import { useSelectedStoreId } from "@/hooks/useSelectedStoreId"

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

export default function SellerDisputesPage() {
  const { status } = useSession()
  const { storeId } = useSelectedStoreId()
  const [items, setItems] = useState<DisputeDto[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("open")
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async (sid: string) => {
    setLoading(true)
    setErr(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const res = await sellerListDisputes(token, sid, tab === "open" ? OPEN_STATUSES : RESOLVED_STATUSES, 0, 50)
      setItems(res.content)
    } catch (e) {
      logError(e, "seller.disputes.load")
      setErr(friendlyMessage(e, "Couldn't load disputes."))
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    if (status !== "authenticated" || !storeId) return
    void load(storeId)
  }, [status, storeId, load])

  async function respond(d: DisputeDto, response: "accept" | "contest") {
    if (!storeId) return
    const sellerNotes = await promptDialog({
      title: response === "accept" ? "Accept this dispute?" : "Contest this dispute?",
      description: response === "accept"
        ? "Add a note (optional). AfroTransact finalizes the refund."
        : "Explain your side for the AfroTransact team reviewing this.",
      placeholder: response === "accept" ? "Optional note" : "Your response",
      multiline: true,
      required: response === "contest",
      confirmLabel: response === "accept" ? "Accept" : "Contest",
    })
    if (sellerNotes == null) return
    if (response === "contest" && !sellerNotes.trim()) return

    setActing(d.id)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      await sellerRespondDispute(token, storeId, d.id, { response, sellerNotes: sellerNotes.trim() || undefined })
      toast.success("Response sent")
      await load(storeId)
    } catch (e) {
      logError(e, "seller.disputes.respond")
      toast.error(friendlyMessage(e, "Couldn't send your response."))
    } finally {
      setActing(null)
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldAlert className="h-6 w-6" /> Disputes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer disputes on your orders. Respond within the window; AfroTransact makes the final call.
          </p>
        </div>
        <button
          onClick={() => storeId && void load(storeId)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCcw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="mb-4 flex items-center gap-1 border-b border-border">
        <TabBtn active={tab === "open"} onClick={() => setTab("open")}>Open</TabBtn>
        <TabBtn active={tab === "resolved"} onClick={() => setTab("resolved")}>Resolved</TabBtn>
      </div>

      {err && <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{err}</div>}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No {tab} disputes.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((d) => (
            <li key={d.id} className="rounded-md border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{d.orderNumber}</span>
                <StatusPill status={d.status} />
                {d.sellerResponseDueAt && !d.status.startsWith("resolved") && d.status !== "seller_responded" && (
                  <span className="text-xs text-muted-foreground">
                    respond by {new Date(d.sellerResponseDueAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="text-base font-medium">{TYPE_LABEL[d.type] ?? d.type}</div>
              {d.buyerNotes && (
                <div className="mt-2 rounded border border-border bg-muted/50 p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">What the buyer said</div>
                  <div className="whitespace-pre-wrap">{d.buyerNotes}</div>
                </div>
              )}
              {d.evidenceUrls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {d.evidenceUrls.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt="evidence" className="h-16 w-16 rounded border border-border object-cover" />
                  ))}
                </div>
              )}
              {d.sellerNotes && (
                <div className="mt-2 rounded border border-border bg-muted/30 p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Your response</div>
                  <div className="whitespace-pre-wrap">{d.sellerNotes}</div>
                </div>
              )}
              {tab === "open" && (d.status === "open" || d.status === "needs_info") && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    disabled={acting === d.id}
                    onClick={() => respond(d, "accept")}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Accept (refund)
                  </button>
                  <button
                    disabled={acting === d.id}
                    onClick={() => respond(d, "contest")}
                    className="rounded border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Contest
                  </button>
                </div>
              )}
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
