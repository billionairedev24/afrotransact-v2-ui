"use client"

/**
 * Lead pipeline. A table rather than kanban columns: the people using this are
 * often on a phone between conversations, where drag-and-drop is a liability.
 * Stage lives in a select on each row, so moving a lead is one tap.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createColumnHelper } from "@tanstack/react-table"
import { toast } from "sonner"
import { Loader2, Plus, Download, Link2, Send, Mail, MailCheck } from "lucide-react"
import { DataTable } from "@/components/ui/DataTable"
import { confirmDialog } from "@/components/ui/confirm"
import { getAccessToken } from "@/lib/auth-helpers"
import { logError } from "@/lib/errors"
import {
  listSellerLeads,
  getSellerLeadStats,
  updateSellerLead,
  convertSellerLead,
  mintLeadCaptureLink,
  sendLeadRegistrationLink,
  type SellerLead,
  type LeadStage,
} from "@/lib/api"

const STAGES: LeadStage[] = ["NEW", "CONTACTED", "INVITED", "ONBOARDING", "WON", "LOST"]

const STAGE_META: Record<LeadStage, { label: string; tone: string }> = {
  NEW:        { label: "New",        tone: "bg-sky-50 text-sky-900 border-sky-200" },
  CONTACTED:  { label: "Contacted",  tone: "bg-amber-50 text-amber-900 border-amber-200" },
  INVITED:    { label: "Invited",    tone: "bg-violet-50 text-violet-900 border-violet-200" },
  ONBOARDING: { label: "Onboarding", tone: "bg-indigo-50 text-indigo-900 border-indigo-200" },
  WON:        { label: "Won",        tone: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  LOST:       { label: "Lost",       tone: "bg-muted text-muted-foreground border-border" },
}

const col = createColumnHelper<SellerLead>()

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default function LeadsPage() {
  const qc = useQueryClient()
  const [stageFilter, setStageFilter] = useState<LeadStage | "">("")
  const [search, setSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const stats = useQuery({
    queryKey: ["admin", "seller-leads", "stats"],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("no session")
      return getSellerLeadStats(token)
    },
  })

  const leads = useQuery({
    queryKey: ["admin", "seller-leads", { stageFilter, search, pageIndex, pageSize }],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("no session")
      return listSellerLeads(token, {
        stage: stageFilter || undefined,
        q: search || undefined,
        page: pageIndex,
        size: pageSize,
      })
    },
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin", "seller-leads"] })
  }

  const moveStage = useMutation({
    mutationFn: async ({ id, stage, notes }: { id: string; stage: LeadStage; notes?: string }) => {
      const token = await getAccessToken()
      if (!token) throw new Error("Your session expired. Sign in again.")
      return updateSellerLead(token, id, { stage, ...(notes ? { notes } : {}) })
    },
    onSuccess: (lead) => {
      invalidate()
      toast.success(`Moved to ${STAGE_META[lead.stage].label}`)
    },
    onError: (e) => {
      logError(e, "moving lead stage")
      toast.error("Could not move that lead.")
    },
  })

  const convert = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken()
      if (!token) throw new Error("Your session expired. Sign in again.")
      return convertSellerLead(token, id)
    },
    onSuccess: (lead) => {
      invalidate()
      toast.success(`Invite sent to ${lead.email}`)
    },
    onError: (e) => {
      logError(e, "converting lead")
      toast.error("Could not send that invite.")
    },
  })

  const sendLink = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken()
      if (!token) throw new Error("Your session expired. Sign in again.")
      return sendLeadRegistrationLink(token, id)
    },
    onSuccess: () => {
      invalidate()
      toast.success("Registration link emailed")
    },
    onError: (e) => {
      logError(e, "sending registration link")
      toast.error("Could not email that link.")
    },
  })

  const captureLink = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("Your session expired. Sign in again.")
      return mintLeadCaptureLink(token, "Conference booth", 48)
    },
    onSuccess: async (res) => {
      const url = `${window.location.origin}/lead/${res.token}`
      try {
        await navigator.clipboard.writeText(url)
        toast.success("Capture link copied — valid for 48 hours")
      } catch {
        // Clipboard needs permission that a phone browser may refuse. Showing
        // the URL is worse than copying it, but far better than losing it.
        toast.success(url, { duration: 30_000 })
      }
    },
    onError: (e) => {
      logError(e, "minting capture link")
      toast.error("Could not create a capture link.")
    },
  })

  async function exportCsv() {
    try {
      const res = await fetch("/api/gw/api/v1/admin/seller-leads/export.csv")
      if (!res.ok) throw new Error(`export failed: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "seller-leads.csv"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      logError(e, "exporting leads")
      toast.error("Could not export the CSV.")
    }
  }

  const rows = useMemo<SellerLead[]>(() => leads.data?.content ?? [], [leads.data])

  const columns = useMemo(() => [
    col.accessor("email", {
      header: "Lead",
      cell: (info) => {
        const l = info.row.original
        return (
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">
              {l.firstName} {l.lastName}
            </div>
            <div className="truncate text-xs text-muted-foreground">{l.email}</div>
            {l.phone && <div className="truncate text-xs text-muted-foreground">{l.phone}</div>}
          </div>
        )
      },
    }),
    col.accessor("businessName", {
      header: "Business",
      cell: (info) => {
        const l = info.row.original
        return (
          <div className="min-w-0">
            <div className="truncate text-sm text-foreground">{l.businessName || "—"}</div>
            {l.sells && <div className="truncate text-xs text-muted-foreground">{l.sells}</div>}
            {l.city && <div className="truncate text-xs text-muted-foreground">{l.city}</div>}
          </div>
        )
      },
    }),
    col.accessor("stage", {
      header: "Stage",
      cell: (info) => {
        const l = info.row.original
        return (
          <select
            value={l.stage}
            disabled={moveStage.isPending}
            onChange={async (e) => {
              const next = e.target.value as LeadStage
              if (next === "LOST" && !l.notes) {
                const ok = await confirmDialog({
                  title: "Mark this lead lost?",
                  description: "Add why in the notes first — a lost lead with no reason is impossible to learn from.",
                  confirmLabel: "Mark lost anyway",
                  variant: "danger",
                })
                if (!ok) return
                moveStage.mutate({ id: l.id, stage: next, notes: "Marked lost (no reason given)" })
                return
              }
              moveStage.mutate({ id: l.id, stage: next })
            }}
            className={`rounded-full border px-2 py-1 text-xs font-medium ${STAGE_META[l.stage].tone}`}
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_META[s].label}</option>
            ))}
          </select>
        )
      },
    }),
    col.accessor("createdAt", {
      header: "Captured",
      cell: (info) => {
        const l = info.row.original
        return (
          <div>
            <div className="tabular-nums text-xs">{fmtDate(info.getValue())}</div>
            {l.profileCompletedAt ? (
              <div className="text-[11px] text-emerald-700">details completed</div>
            ) : l.linkSentAt ? (
              <div className="text-[11px] text-muted-foreground">link sent</div>
            ) : l.source === "PUBLIC" ? (
              <div className="text-[11px] text-muted-foreground">via capture link</div>
            ) : null}
          </div>
        )
      },
    }),
    col.display({
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: (info) => {
        const l = info.row.original
        const alreadyInvited = !!l.inviteId
        const linkSent = !!l.linkSentAt
        return (
          <div className="inline-flex justify-end gap-1">
            <button
              disabled={sendLink.isPending}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: linkSent ? `Resend link to ${l.firstName}?` : `Email ${l.firstName} a link?`,
                  description: linkSent
                    ? `Sends a fresh link to ${l.email}. The previous one stops working.`
                    : `Emails ${l.email} a personal link to finish their details.`,
                  confirmLabel: linkSent ? "Resend link" : "Send link",
                })
                if (ok) sendLink.mutate(l.id)
              }}
              title={linkSent
                ? `Link sent ${fmtDate(l.linkSentAt)} — resend`
                : "Email a personal registration link"}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
            >
              {sendLink.isPending && sendLink.variables === l.id
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : linkSent ? <MailCheck className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
              {linkSent ? "Resend" : "Send link"}
            </button>
            <button
              disabled={alreadyInvited || convert.isPending}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: `Invite ${l.firstName} ${l.lastName}?`,
                  description: `Creates their account and emails ${l.email} a link to set a password.`,
                  confirmLabel: "Send invite",
                })
                if (ok) convert.mutate(l.id)
              }}
              title={alreadyInvited ? "Already invited" : "Create their account and email an invite"}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              {convert.isPending && convert.variables === l.id
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Send className="h-3 w-3" />}
              {alreadyInvited ? "Invited" : "Invite"}
            </button>
          </div>
        )
      },
    }),
  ], [moveStage, convert, sendLink])

  const total = stats.data ? Object.values(stats.data).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Seller leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0 ? "No leads yet — capture your first one." : `${total} captured`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => captureLink.mutate()}
            disabled={captureLink.isPending}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <Link2 className="h-4 w-4" />
            Copy capture link
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <Link
            href="/admin/sellers/leads/capture"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New lead
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setStageFilter(""); setPageIndex(0) }}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            stageFilter === "" ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
          }`}
        >
          All {total > 0 && <span className="tabular-nums">({total})</span>}
        </button>
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => { setStageFilter(s); setPageIndex(0) }}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              stageFilter === s ? "border-foreground bg-foreground text-background" : STAGE_META[s].tone
            }`}
          >
            {STAGE_META[s].label}{" "}
            <span className="tabular-nums">({stats.data?.[s] ?? 0})</span>
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={leads.isLoading}
        // Search is server-side: with server pagination, client filtering would
        // only ever search the page already loaded.
        searchPlaceholder="Search name, email, business"
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPageIndex(0) }}
        emptyMessage={
          search || stageFilter
            ? "No leads match that filter."
            : "No leads yet. Tap New lead to capture one."
        }
        // Server-side: the pipeline can outgrow a client-paged table, and the
        // stage filter is applied in the query, not in the browser.
        serverPagination={{
          pageIndex,
          pageSize,
          pageCount: leads.data?.totalPages ?? 0,
          totalRows: leads.data?.totalElements ?? 0,
          onPageChange: setPageIndex,
          onPageSizeChange: setPageSize,
        }}
      />
    </div>
  )
}
