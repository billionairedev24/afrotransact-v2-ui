"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { toast } from "sonner"
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
      toast.error("Failed to load data: " + (e instanceof Error ? e.message : "Unknown error"))
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
      toast.error("Add failed: " + (e instanceof Error ? e.message : "Unknown error"))
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
      toast.error("Remove failed: " + (e instanceof Error ? e.message : "Unknown error"))
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
      toast.error("Toggle failed: " + (e instanceof Error ? e.message : "Unknown error"))
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
              : "bg-gray-50 text-gray-500 border-gray-200"
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
          className="inline-flex items-center gap-2 rounded-xl bg-[#EAB308] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#CA8A04] transition-colors whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Add Recipient
        </button>
      </div>

      {/* Available events */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Available Notification Events</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Events you can route. Add recipients below to receive alerts.
          </p>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-[#EAB308]" />
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
        <div className="rounded-2xl border border-[#EAB308]/30 bg-[#EAB308]/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Add Notification Recipient</h3>
            <button onClick={() => setShowAdd(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">Event Type</label>
              <select
                value={addEventType}
                onChange={e => setAddEventType(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#EAB308] focus:ring-1 focus:ring-[#EAB308]/50"
              >
                {eventTypes.map(et => (
                  <option key={et.key} value={et.key}>{et.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">Email Address</label>
              <input
                type="email"
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                placeholder="team@afrotransact.com"
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#EAB308] focus:ring-1 focus:ring-[#EAB308]/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">Label (optional)</label>
              <input
                type="text"
                value={addLabel}
                onChange={e => setAddLabel(e.target.value)}
                placeholder="e.g. Seller Team"
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#EAB308] focus:ring-1 focus:ring-[#EAB308]/50"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAdd}
              disabled={adding || !addEmail || !addEventType}
              className="inline-flex items-center gap-2 rounded-xl bg-[#EAB308] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#CA8A04] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Recipient
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recipients table */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="px-5 py-4 border-b border-gray-200">
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
