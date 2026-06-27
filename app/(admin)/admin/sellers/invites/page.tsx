"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createColumnHelper } from "@tanstack/react-table"
import { Loader2, Mail, RefreshCcw, Ban, CheckCircle2, Clock, ShieldOff, MailX, Send } from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/DataTable"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  listSellerInvites,
  resendSellerInvite,
  revokeSellerInvite,
  getSellerInviteStats,
  type SellerInvite,
  type SellerInviteStatus,
} from "@/lib/api"

const STATUS_META: Record<SellerInviteStatus, { label: string; tone: string; icon: typeof Mail }> = {
  pending: { label: "Pending",  tone: "bg-amber-50 text-amber-900 border-amber-200",  icon: Clock },
  consumed: { label: "Accepted", tone: "bg-emerald-50 text-emerald-900 border-emerald-200", icon: CheckCircle2 },
  expired: { label: "Expired",  tone: "bg-muted text-foreground border-border", icon: MailX },
  revoked: { label: "Revoked",  tone: "bg-rose-50 text-rose-900 border-rose-200", icon: ShieldOff },
}

function statusBadge(status: SellerInviteStatus) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.tone}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  )
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function fmtExpiresIn(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return "expired"
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`
  if (hours >= 1) return `${hours}h left`
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`
}

const col = createColumnHelper<SellerInvite>()

export default function InvitesPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<SellerInviteStatus | "">("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const stats = useQuery({
    queryKey: ["admin", "seller-invites", "stats"],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      return getSellerInviteStats(token)
    },
    refetchInterval: 60_000,
  })

  const invites = useQuery({
    queryKey: ["admin", "seller-invites", { statusFilter, pageIndex, pageSize }],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      return listSellerInvites(token, {
        status: statusFilter || undefined,
        page: pageIndex,
        size: pageSize,
      })
    },
  })

  const resend = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      return resendSellerInvite(token, id)
    },
    onSuccess: () => {
      toast.success("Reminder sent")
      qc.invalidateQueries({ queryKey: ["admin", "seller-invites"] })
    },
    onError: () => toast.error("Failed to send reminder"),
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      return revokeSellerInvite(token, id)
    },
    onSuccess: () => {
      toast.success("Invite revoked")
      qc.invalidateQueries({ queryKey: ["admin", "seller-invites"] })
      qc.invalidateQueries({ queryKey: ["admin", "seller-invites", "stats"] })
    },
    onError: () => toast.error("Failed to revoke invite"),
  })

  const total = stats.data ? Object.values(stats.data).reduce((a, b) => a + b, 0) : 0
  const acceptanceRate =
    stats.data && (stats.data.consumed + stats.data.expired + stats.data.revoked) > 0
      ? Math.round((stats.data.consumed / (stats.data.consumed + stats.data.expired + stats.data.revoked)) * 100)
      : 0

  const rows = useMemo<SellerInvite[]>(() => invites.data?.content ?? [], [invites.data])

  const columns = useMemo(() => [
    col.accessor("email", {
      header: "Recipient",
      cell: (info) => {
        const inv = info.row.original
        const name = [inv.firstName, inv.lastName].filter(Boolean).join(" ")
        return (
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{name || "—"}</div>
            <div className="truncate text-xs text-muted-foreground">{inv.email}</div>
          </div>
        )
      },
    }),
    col.accessor("status", {
      header: "Status",
      cell: (info) => statusBadge(info.getValue()),
    }),
    col.accessor("createdAt", {
      header: "Sent",
      cell: (info) => <span className="tabular-nums text-xs">{fmtDate(info.getValue())}</span>,
    }),
    col.accessor("expiresAt", {
      header: "Expires",
      cell: (info) => {
        const inv = info.row.original
        return (
          <div>
            <div className="tabular-nums text-xs">{fmtDate(info.getValue())}</div>
            {inv.status === "pending" && (
              <div className="text-[11px] text-muted-foreground">{fmtExpiresIn(info.getValue())}</div>
            )}
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
        const inv = info.row.original
        const canAct = inv.status === "pending"
        return (
          <div className="inline-flex justify-end gap-1">
            <button
              disabled={!canAct || resend.isPending}
              onClick={() => resend.mutate(inv.id)}
              title="Send reminder email"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {resend.isPending && resend.variables === inv.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCcw className="h-3 w-3" />
              )}
              Remind
            </button>
            <button
              disabled={!canAct || revoke.isPending}
              onClick={() => {
                if (confirm(`Revoke invite for ${inv.email}? This disables their Keycloak user.`)) {
                  revoke.mutate(inv.id)
                }
              }}
              title="Revoke this invite"
              className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Ban className="h-3 w-3" />
              Revoke
            </button>
          </div>
        )
      },
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [resend.isPending, resend.variables, revoke.isPending])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Seller Invites</h1>
        <p className="text-sm text-muted-foreground">
          Every invite you&rsquo;ve sent. Resend a reminder if the seller hasn&rsquo;t accepted yet, or revoke if it&rsquo;s no longer valid.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs font-medium text-muted-foreground">Total sent</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.isLoading ? "—" : total}</div>
        </div>
        {(["pending", "consumed", "expired", "revoked"] as const).map((s) => {
          const meta = STATUS_META[s]
          const Icon = meta.icon
          return (
            <div key={s} className={`rounded-lg border p-3 ${meta.tone}`}>
              <div className="flex items-center gap-2 text-xs font-medium">
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{stats.data?.[s] ?? 0}</div>
              {s === "consumed" && total > 0 && (
                <div className="text-[11px] text-muted-foreground">{acceptanceRate}% acceptance</div>
              )}
            </div>
          )
        })}
      </section>

      {/* Status pills filter the server query */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setStatusFilter(""); setPageIndex(0) }}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            statusFilter === "" ? "bg-foreground text-background" : "bg-background text-muted-foreground"
          }`}
        >
          All
        </button>
        {(["pending", "consumed", "expired", "revoked"] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPageIndex(0) }}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              statusFilter === s ? "bg-foreground text-background" : "bg-background text-muted-foreground"
            }`}
          >
            {STATUS_META[s].label}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Send className="h-3 w-3" />
          Pending invites get a fresh email when you click <strong>Remind</strong>.
        </span>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={invites.isLoading}
        searchPlaceholder="Search recipient…"
        emptyMessage="No invites match these filters."
        exportFilename="seller-invites"
        enableExport
        serverPagination={{
          pageIndex,
          pageSize,
          pageCount: invites.data?.totalPages ?? 0,
          totalRows: invites.data?.totalElements ?? 0,
          onPageChange: setPageIndex,
          onPageSizeChange: (n) => { setPageSize(n); setPageIndex(0) },
        }}
      />
    </div>
  )
}
