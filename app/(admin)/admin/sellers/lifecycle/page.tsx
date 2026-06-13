"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createColumnHelper } from "@tanstack/react-table"
import {
  AlertTriangle, ShieldOff, CreditCard, Clock, Hourglass, XCircle, Loader2, Mail, ExternalLink, RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/DataTable"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getAdminSellers,
  getSellerLifecycleSummary,
  nudgeSellerLifecycle,
  refreshSellerStripe,
  type SellerInfo,
} from "@/lib/api"

const STAGE_META: Record<string, { label: string; icon: typeof AlertTriangle; tone: string }> = {
  PAYOUTS_PAUSED:   { label: "Payouts paused",   icon: ShieldOff,    tone: "bg-amber-50 text-amber-900 border-amber-200" },
  CHARGES_PAUSED:   { label: "Charges paused",   icon: CreditCard,   tone: "bg-rose-50 text-rose-900 border-rose-200" },
  ACTION_REQUIRED:  { label: "Action required",  icon: AlertTriangle,tone: "bg-amber-50 text-amber-900 border-amber-200" },
  PAST_DUE:         { label: "Past due",         icon: Clock,        tone: "bg-rose-50 text-rose-900 border-rose-200" },
  UNDER_REVIEW:     { label: "Under review",     icon: Hourglass,    tone: "bg-blue-50 text-blue-900 border-blue-200" },
  REJECTED:         { label: "Rejected",         icon: XCircle,      tone: "bg-rose-100 text-rose-900 border-rose-300" },
}

function stageBadge(stage: string | null) {
  if (!stage || stage === "ACTIVE") {
    return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900 border border-emerald-200">Active</span>
  }
  const meta = STAGE_META[stage] ?? { label: stage, icon: AlertTriangle, tone: "bg-muted text-foreground border-border" }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.tone}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  )
}

const col = createColumnHelper<SellerInfo>()

export default function SellerLifecyclePage() {
  const qc = useQueryClient()
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const summary = useQuery({
    queryKey: ["admin", "sellers", "lifecycle-summary"],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      return getSellerLifecycleSummary(token)
    },
    refetchInterval: 60_000,
  })

  const sellers = useQuery({
    queryKey: ["admin", "sellers", "at-risk", { pageIndex, pageSize }],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      return getAdminSellers(token, undefined, pageIndex, pageSize, undefined, true)
    },
    refetchInterval: 60_000,
  })

  const nudge = useMutation({
    mutationFn: async (sellerId: string) => {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      return nudgeSellerLifecycle(token, sellerId)
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`Reminder sent (stage: ${res.stage})`)
      } else {
        toast.error(res.reason || "Cannot nudge — seller is healthy")
      }
      qc.invalidateQueries({ queryKey: ["admin", "sellers", "at-risk"] })
    },
    onError: () => toast.error("Failed to send nudge"),
  })

  // Pull live Account state from Stripe — same code path the account.updated
  // webhook uses. Covers the case where the seller bailed mid-onboarding and
  // no webhook ever fired (Stripe doesn't emit account.updated unless
  // something actually transitions on the account).
  const refresh = useMutation({
    mutationFn: async (sellerId: string) => {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      return refreshSellerStripe(token, sellerId)
    },
    onSuccess: () => {
      toast.success("Stripe state refreshed")
      qc.invalidateQueries({ queryKey: ["admin", "sellers", "at-risk"] })
      qc.invalidateQueries({ queryKey: ["admin", "sellers", "lifecycle-summary"] })
    },
    onError: () => toast.error("Failed to refresh from Stripe"),
  })

  const rows = useMemo<SellerInfo[]>(() => sellers.data?.content ?? [], [sellers.data])

  const columns = useMemo(() => [
    col.accessor("businessName", {
      header: "Seller",
      cell: (info) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{info.getValue()}</div>
          <div className="truncate text-xs text-muted-foreground">{info.row.original.contactEmail ?? "—"}</div>
        </div>
      ),
    }),
    col.accessor("lifecycleStage", {
      header: "Stage",
      cell: (info) => stageBadge(info.getValue()),
    }),
    col.display({
      id: "stripeState",
      header: "Stripe state",
      enableSorting: false,
      cell: (info) => {
        const s = info.row.original
        return (
          <div className="flex flex-col gap-0.5 text-xs">
            <span className={s.chargesEnabled ? "text-emerald-700" : "text-rose-700"}>
              charges: {s.chargesEnabled ? "on" : "off"}
            </span>
            <span className={s.payoutsEnabled ? "text-emerald-700" : "text-rose-700"}>
              payouts: {s.payoutsEnabled ? "on" : "off"}
            </span>
            {s.stripeDisabledReason && (
              <span className="text-muted-foreground">{s.stripeDisabledReason}</span>
            )}
          </div>
        )
      },
    }),
    col.display({
      id: "outstanding",
      header: "Outstanding",
      enableSorting: false,
      cell: (info) => {
        const s = info.row.original
        const due = (s.currentlyDueItems ?? []).concat(s.pastDueItems ?? [])
        if (due.length === 0) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {due.slice(0, 4).map((item) => (
              <span key={item} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{item}</span>
            ))}
            {due.length > 4 && <span className="text-[11px] text-muted-foreground">+{due.length - 4}</span>}
          </div>
        )
      },
    }),
    col.accessor("currentDeadline", {
      header: "Deadline",
      cell: (info) => (
        <span className="text-xs tabular-nums">
          {info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : "—"}
        </span>
      ),
    }),
    col.display({
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: (info) => {
        const s = info.row.original
        const canNudge = s.lifecycleStage && s.lifecycleStage !== "ACTIVE"
        const canRefresh = !!s.stripeAccountId
        return (
          <div className="inline-flex justify-end gap-1">
            <button
              disabled={!canRefresh || refresh.isPending}
              onClick={() => refresh.mutate(s.id)}
              title="Pull live state from Stripe (use when a webhook never delivered)"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {refresh.isPending && refresh.variables === s.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Refresh
            </button>
            <button
              disabled={!canNudge || nudge.isPending}
              onClick={() => nudge.mutate(s.id)}
              title="Re-fire the seller's current-stage email"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {nudge.isPending && nudge.variables === s.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Mail className="h-3 w-3" />
              )}
              Nudge
            </button>
            <Link
              href={`/admin/sellers?sellerId=${s.id}`}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </Link>
          </div>
        )
      },
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [nudge.isPending, nudge.variables, refresh.isPending, refresh.variables])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Seller Lifecycle</h1>
        <p className="text-sm text-muted-foreground">
          Sellers whose Stripe Connect account isn&rsquo;t fully healthy. Use <strong>Nudge</strong> to manually re-fire the stage-appropriate email to the seller (and admin recipients) without waiting for the next Stripe webhook.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(Object.keys(STAGE_META) as Array<keyof typeof STAGE_META>).map((stage) => {
          const meta = STAGE_META[stage]
          const Icon = meta.icon
          const count = summary.data?.[stage] ?? 0
          return (
            <div key={stage} className={`rounded-lg border p-3 ${meta.tone}`}>
              <div className="flex items-center gap-2 text-xs font-medium">
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{count}</div>
            </div>
          )
        })}
      </section>

      <DataTable
        columns={columns}
        data={rows}
        loading={sellers.isLoading}
        searchPlaceholder="Search seller…"
        emptyMessage="No at-risk sellers right now."
        exportFilename="at-risk-sellers"
        enableExport
        serverPagination={{
          pageIndex,
          pageSize,
          pageCount: sellers.data?.totalPages ?? 0,
          totalRows: sellers.data?.totalElements ?? 0,
          onPageChange: setPageIndex,
          onPageSizeChange: (n) => { setPageSize(n); setPageIndex(0) },
        }}
      />
    </div>
  )
}
