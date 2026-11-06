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
import { Loader2, Plus, Download, Mail, X, Eye } from "lucide-react"
import { DataTable } from "@/components/ui/DataTable"
import { LeadDetailsPanel } from "@/components/leads/LeadDetailsPanel"
import { confirmDialog } from "@/components/ui/confirm"
import { getAccessToken } from "@/lib/auth-helpers"
import { logError } from "@/lib/errors"
import {
  listSellerLeads,
  getSellerLeadStats,
  updateSellerLead,
  convertSellerLead,
  sendLeadRegistrationLink,
  sendLeadLinkByEmail,
  ApiError,
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
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailForm, setEmailForm] = useState({ email: "", firstName: "", lastName: "" })
  const [emailError, setEmailError] = useState("")
  const [viewing, setViewing] = useState<SellerLead | null>(null)

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
      // The service tells us WHY. "user_exists" is the common one and reads as
      // a mystery failure otherwise: the person already has an account, so
      // there is nothing to fix — they just need looking up instead.
      const code = e instanceof ApiError ? e.code : undefined
      if (code === "user_exists") {
        toast.error(
          "That email already has an account. Check All Sellers or Invites — they may already be set up.",
          { duration: 8000 },
        )
        return
      }
      toast.error(e instanceof ApiError ? e.body : "Could not send that invite.")
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
      toast.error(e instanceof ApiError ? e.body : "Could not email that link.")
    },
  })

  const emailLink = useMutation({
    mutationFn: async (data: { email: string; firstName?: string; lastName?: string }) => {
      const token = await getAccessToken()
      if (!token) throw new Error("Your session expired. Sign in again.")
      return sendLeadLinkByEmail(token, data)
    },
    onSuccess: (lead) => {
      invalidate()
      setEmailOpen(false)
      setEmailForm({ email: "", firstName: "", lastName: "" })
      toast.success(`Link sent to ${lead.email}`)
    },
    onError: (e) => {
      logError(e, "sending link by email")
      toast.error("Could not send that link.")
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
    col.accessor("firstName", {
      header: "Name",
      cell: (info) => {
        const l = info.row.original
        const name = [l.firstName, l.lastName].filter(Boolean).join(" ")
        return <span className="font-medium text-foreground">{name || "—"}</span>
      },
    }),
    col.accessor("email", {
      header: "Email",
      cell: (info) => <span className="text-sm">{info.getValue() || "—"}</span>,
    }),
    col.accessor("phone", {
      header: "Phone",
      cell: (info) => <span className="tabular-nums text-sm">{info.getValue() || "—"}</span>,
    }),
    col.accessor("businessName", {
      header: "Business",
      cell: (info) => <span className="text-sm">{info.getValue() || "—"}</span>,
    }),
    col.accessor("city", {
      header: "City",
      cell: (info) => <span className="text-sm">{info.getValue() || "—"}</span>,
    }),
    col.accessor("categories", {
      header: "Sells",
      cell: (info) => {
        const l = info.row.original
        const text = l.categories || l.sells
        return <span className="text-sm">{text || "—"}</span>
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
            onClick={(e) => e.stopPropagation()}
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
            {STAGES.map((st) => (
              <option key={st} value={st}>{STAGE_META[st].label}</option>
            ))}
          </select>
        )
      },
    }),
    col.accessor("linkSentAt", {
      header: "Link sent",
      cell: (info) => <span className="tabular-nums text-xs">{fmtDate(info.getValue())}</span>,
    }),
    col.accessor("profileCompletedAt", {
      header: "Details in",
      cell: (info) => {
        const v = info.getValue()
        return v
          ? <span className="text-xs text-emerald-700">{fmtDate(v)}</span>
          : <span className="text-xs text-muted-foreground">—</span>
      },
    }),
    col.accessor("createdAt", {
      header: "Captured",
      cell: (info) => <span className="tabular-nums text-xs">{fmtDate(info.getValue())}</span>,
    }),
    col.display({
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: (info) => {
        const l = info.row.original
        return (
          <div className="inline-flex justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); setViewing(l) }}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
            >
              <Eye className="h-3 w-3" />
              View
            </button>
          </div>
        )
      },
    }),
  ], [moveStage])

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
            onClick={() => { setEmailOpen(true); setEmailError("") }}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
          >
            <Mail className="h-4 w-4" />
            Email a link
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

      {emailOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-link-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setEmailOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl border border-border bg-background p-6 sm:rounded-2xl"
          >
            <div className="mb-1 flex items-start justify-between gap-4">
              <h2 id="email-link-title" className="text-lg font-semibold text-foreground">
                Email a registration link
              </h2>
              <button
                onClick={() => setEmailOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              Their address is all you need. They&apos;ll get a link that opens a
              short form, and they appear here as a new lead straight away.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const email = emailForm.email.trim()
                if (!email) { setEmailError("Enter an email address"); return }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                  setEmailError("That email address doesn't look right"); return
                }
                setEmailError("")
                emailLink.mutate({
                  email,
                  firstName: emailForm.firstName.trim() || undefined,
                  lastName: emailForm.lastName.trim() || undefined,
                })
              }}
              className="space-y-4"
              noValidate
            >
              <div>
                <label htmlFor="link-email" className="mb-1.5 block text-sm font-medium text-foreground">
                  Email
                </label>
                <input
                  id="link-email"
                  type="email"
                  inputMode="email"
                  autoFocus
                  value={emailForm.email}
                  onChange={(e) => { setEmailForm((f) => ({ ...f, email: e.target.value })); setEmailError("") }}
                  aria-invalid={!!emailError}
                  className={`h-12 w-full rounded-lg border bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 ${
                    emailError
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
                      : "border-border focus:border-primary focus:ring-primary/40"
                  }`}
                />
                {emailError && <p className="mt-1.5 text-sm text-rose-700">{emailError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="link-first" className="mb-1.5 block text-sm font-medium text-foreground">
                    First name <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    id="link-first"
                    value={emailForm.firstName}
                    onChange={(e) => setEmailForm((f) => ({ ...f, firstName: e.target.value }))}
                    autoCapitalize="words"
                    className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label htmlFor="link-last" className="mb-1.5 block text-sm font-medium text-foreground">
                    Last name <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    id="link-last"
                    value={emailForm.lastName}
                    onChange={(e) => setEmailForm((f) => ({ ...f, lastName: e.target.value }))}
                    autoCapitalize="words"
                    className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={emailLink.isPending}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-base font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {emailLink.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
                {emailLink.isPending ? "Sending…" : "Send link"}
              </button>
            </form>
          </div>
        </div>
      )}

      {viewing && (
        <LeadDetailsPanel
          // Re-read from the current page so the panel reflects a stage change
          // or a link send made while it is open, instead of a stale snapshot.
          lead={rows.find((r) => r.id === viewing.id) ?? viewing}
          stageLabel={(st) => STAGE_META[st].label}
          onClose={() => setViewing(null)}
          onSendLink={() => sendLink.mutate(viewing.id)}
          onInvite={() => convert.mutate(viewing.id)}
          sending={sendLink.isPending}
          inviting={convert.isPending}
        />
      )}

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
