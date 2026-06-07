"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { toast } from "sonner"
import { logError } from "@/lib/errors"
import {
  Bell,
  Loader2,
  Plus,
  Trash2,
  Mail,
  X,
  Power,
  PowerOff,
} from "lucide-react"
import {
  getNotificationRecipients,
  getEventTypes,
  addNotificationRecipient,
  removeNotificationRecipient,
  toggleNotificationRecipient,
  type NotificationRecipient,
  type EventTypeInfo,
} from "@/lib/api"
import { DataTable } from "@/components/ui/DataTable"
import type { ColumnDef } from "@tanstack/react-table"

const EVENT_COLORS: Record<string, { bg: string; text: string }> = {
  seller:  { bg: "bg-amber-50",   text: "text-amber-700"  },
  product: { bg: "bg-blue-50",    text: "text-blue-700"   },
  order:   { bg: "bg-emerald-50", text: "text-emerald-700"},
  payment: { bg: "bg-purple-50",  text: "text-purple-700" },
}

function eventStyle(key: string) {
  const prefix = key.split(".")[0]
  return EVENT_COLORS[prefix] ?? { bg: "bg-gray-50", text: "text-gray-600" }
}

export default function NotificationRoutingPage() {
  const { status } = useSession()

  const [eventTypes, setEventTypes] = useState<EventTypeInfo[]>([])
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([])
  const [loading, setLoading] = useState(true)

  const [showAdd, setShowAdd] = useState(false)
  const [addEventType, setAddEventType] = useState("")
  const [addEmail, setAddEmail] = useState("")
  const [addLabel, setAddLabel] = useState("")
  const [adding, setAdding] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const token = await getAccessToken()
      if (!token) return
      const [types, recs] = await Promise.all([
        getEventTypes(token),
        getNotificationRecipients(token),
      ])
      setEventTypes(types ?? [])
      setRecipients(recs ?? [])
    } catch (e: unknown) {
      logError(e, "loading notification routing data")
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") loadData()
  }, [status, loadData])

  const handleAdd = async () => {
    if (!addEventType || !addEmail) {
      toast.error("Event type and email are required")
      return
    }
    setAdding(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      await addNotificationRecipient(token, {
        event_type: addEventType,
        email: addEmail,
        label: addLabel,
      })
      toast.success(`Added ${addEmail} for ${addEventType}`)
      setAddEmail("")
      setAddLabel("")
      setShowAdd(false)
      loadData()
    } catch (e: unknown) {
      logError(e, "adding notification recipient")
      toast.error("Add failed")
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (r: NotificationRecipient) => {
    if (!confirm(`Remove ${r.email} from "${r.event_type}" notifications?`)) return
    try {
      const token = await getAccessToken()
      if (!token) return
      const resp = await removeNotificationRecipient(token, r.id)
      if (!resp.ok) throw new Error("Delete failed")
      toast.success("Recipient removed")
      loadData()
    } catch (e: unknown) {
      logError(e, "removing notification recipient")
      toast.error("Remove failed")
    }
  }

  const handleToggle = async (r: NotificationRecipient) => {
    try {
      const token = await getAccessToken()
      if (!token) return
      await toggleNotificationRecipient(token, r.id, !r.active)
      setRecipients(prev =>
        prev.map(x => x.id === r.id ? { ...x, active: !r.active } : x)
      )
      toast.success(r.active ? "Paused" : "Activated")
    } catch (e: unknown) {
      logError(e, "toggling notification recipient")
      toast.error("Toggle failed")
    }
  }

  const columns = useMemo<ColumnDef<NotificationRecipient, unknown>[]>(() => [
    {
      accessorKey: "event_type",
      header: "Event",
      cell: ({ getValue }) => {
        const key = getValue() as string
        const style = eventStyle(key)
        const info = eventTypes.find(et => et.key === key)
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`inline-flex w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
              {info?.label || key}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ getValue }) => (
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-sm font-medium text-gray-900">{getValue() as string}</span>
        </div>
      ),
    },
    {
      accessorKey: "label",
      header: "Label",
      cell: ({ getValue }) => {
        const label = getValue() as string
        return label ? (
          <span className="text-sm text-gray-500">{label}</span>
        ) : (
          <span className="text-sm text-gray-300 italic">—</span>
        )
      },
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ getValue }) => {
        const active = getValue() as boolean
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            active
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-gray-50 text-gray-500 border-input"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-gray-400"}`} />
            {active ? "Active" : "Paused"}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: "",
      size: 80,
      cell: ({ row }) => {
        const r = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => handleToggle(r)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title={r.active ? "Pause" : "Activate"}
            >
              {r.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            </button>
            <button
              onClick={() => handleRemove(r)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      },
      enableSorting: false,
    },
  ], [eventTypes])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alert Routing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Route platform notifications to specific email addresses per event type.
          </p>
        </div>
        <button
          onClick={() => {
            setShowAdd(true)
            if (!addEventType && eventTypes.length) setAddEventType(eventTypes[0].key)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-5 py-2 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors whitespace-nowrap disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Add Recipient
        </button>
      </div>

      {/* Available events */}
      <div className="rounded-2xl border border-input bg-white">
        <div className="px-5 py-4 border-b border-input">
          <h2 className="text-sm font-semibold text-gray-900">Available Notification Events</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Events you can route. Add recipients below to receive alerts.
          </p>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {eventTypes.map(et => {
                const style = eventStyle(et.key)
                const count = recipients.filter(r => r.event_type === et.key).length
                return (
                  <div key={et.key} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.bg}`}>
                      <Bell className={`h-4 w-4 ${style.text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{et.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{et.description}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {count > 0 ? `${count} recipient${count > 1 ? "s" : ""}` : "No recipients — falls back to admin email"}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">Add Notification Recipient</h3>
            <button
              onClick={() => setShowAdd(false)}
              aria-label="Close"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="route-event-type" className="text-sm font-medium text-foreground">
                  Event Type <span className="text-destructive">*</span>
                </label>
                <select
                  id="route-event-type"
                  value={addEventType}
                  onChange={e => setAddEventType(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  {eventTypes.map(et => (
                    <option key={et.key} value={et.key}>{et.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="route-email" className="text-sm font-medium text-foreground">
                  Email Address <span className="text-destructive">*</span>
                </label>
                <input
                  id="route-email"
                  type="email"
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  placeholder="team@afrotransact.com"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="route-label" className="text-sm font-medium text-foreground">
                  Label <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  id="route-label"
                  type="text"
                  value={addLabel}
                  onChange={e => setAddLabel(e.target.value)}
                  placeholder="e.g. Seller Team"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3">
            <button
              onClick={() => setShowAdd(false)}
              disabled={adding}
              className="rounded-lg border border-input bg-background px-5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={adding || !addEmail || !addEventType}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-5 py-2 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} /> : null}
              {adding ? "Adding..." : "Add Recipient"}
            </button>
          </div>
        </div>
      )}

      {/* Recipients table */}
      <div className="rounded-2xl border border-input bg-white">
        <div className="px-5 py-4 border-b border-input">
          <h2 className="text-sm font-semibold text-gray-900">Configured Recipients</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage who receives notifications for each event. Toggle to pause without removing.
          </p>
        </div>
        <DataTable
          columns={columns}
          data={recipients}
          loading={loading}
          searchPlaceholder="Search by email..."
          searchColumn="email"
          emptyMessage="No recipients configured yet. Click 'Add Recipient' to get started."
          pageSize={15}
        />
      </div>
    </div>
  )
}
