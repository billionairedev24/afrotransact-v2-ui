"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { toast } from "sonner"
import {
  Bell,
  Loader2,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Mail,
  Info,
  X,
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

const EVENT_COLORS: Record<string, string> = {
  seller: "bg-amber-100 text-amber-700",
  product: "bg-blue-100 text-blue-700",
  order: "bg-emerald-100 text-emerald-700",
  payment: "bg-purple-100 text-purple-700",
}

function eventColor(key: string) {
  const prefix = key.split(".")[0]
  return EVENT_COLORS[prefix] ?? "bg-gray-100 text-gray-600"
}

export default function NotificationRoutingPage() {
  const { status } = useSession()

  const [eventTypes, setEventTypes] = useState<EventTypeInfo[]>([])
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEvent, setFilterEvent] = useState("")

  // Add form
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
    } catch (e: any) {
      toast.error("Failed to load data: " + e.message)
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
    } catch (e: any) {
      toast.error("Add failed: " + e.message)
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
    } catch (e: any) {
      toast.error("Remove failed: " + e.message)
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
    } catch (e: any) {
      toast.error("Toggle failed: " + e.message)
    }
  }

  const filtered = filterEvent
    ? recipients.filter(r => r.event_type === filterEvent)
    : recipients

  const grouped = eventTypes.map(et => ({
    ...et,
    recipients: filtered.filter(r => r.event_type === et.key),
  }))

  const ungroupedRecipients = filtered.filter(
    r => !eventTypes.some(et => et.key === r.event_type)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-6 w-6 text-yellow-600" />
            Notification Routing
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure which email addresses receive admin alerts for each event type.
            If no recipients are configured, alerts fall back to the <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">ADMIN_EMAIL</code> environment variable.
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); if (!addEventType && eventTypes.length) setAddEventType(eventTypes[0].key) }}
          className="flex items-center gap-1.5 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Recipient
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Add Notification Recipient</h3>
            <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Event Type</label>
              <select
                value={addEventType}
                onChange={e => setAddEventType(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
              >
                {eventTypes.map(et => (
                  <option key={et.key} value={et.key}>{et.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
              <input
                type="email"
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                placeholder="team@afrotransact.com"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label (optional)</label>
              <input
                type="text"
                value={addLabel}
                onChange={e => setAddLabel(e.target.value)}
                placeholder="e.g. Seller Team, Product Manager"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={adding || !addEmail || !addEventType}
              className="flex items-center gap-1.5 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50 transition-colors"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterEvent("")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !filterEvent ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
        </button>
        {eventTypes.map(et => {
          const count = recipients.filter(r => r.event_type === et.key).length
          return (
            <button
              key={et.key}
              onClick={() => setFilterEvent(et.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterEvent === et.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {et.label} {count > 0 && `(${count})`}
            </button>
          )
        })}
      </div>

      {/* Grouped recipient cards */}
      <div className="space-y-4">
        {grouped.filter(g => !filterEvent || g.key === filterEvent).map(group => (
          <div key={group.key} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${eventColor(group.key)}`}>
                {group.key}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm text-gray-900">{group.label}</span>
                <span className="text-xs text-gray-500 ml-2">{group.description}</span>
              </div>
              {group.recipients.length === 0 && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Falls back to ADMIN_EMAIL
                </span>
              )}
            </div>
            {group.recipients.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {group.recipients.map(r => (
                  <RecipientRow key={r.id} recipient={r} onToggle={handleToggle} onRemove={handleRemove} />
                ))}
              </div>
            ) : (
              <div className="px-5 py-4 text-sm text-gray-400">
                No specific recipients configured. Alerts will go to the default admin email.
              </div>
            )}
          </div>
        ))}

        {/* Ungrouped (custom event types) */}
        {ungroupedRecipients.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <span className="font-medium text-sm text-gray-900">Other Event Types</span>
            </div>
            <div className="divide-y divide-gray-50">
              {ungroupedRecipients.map(r => (
                <RecipientRow key={r.id} recipient={r} onToggle={handleToggle} onRemove={handleRemove} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RecipientRow({
  recipient: r,
  onToggle,
  onRemove,
}: {
  recipient: NotificationRecipient
  onToggle: (r: NotificationRecipient) => void
  onRemove: (r: NotificationRecipient) => void
}) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3 ${!r.active ? "opacity-50" : ""}`}>
      <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900">{r.email}</span>
        {r.label && (
          <span className="ml-2 text-xs text-gray-500">({r.label})</span>
        )}
      </div>
      <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${
        r.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
      }`}>
        {r.active ? "Active" : "Paused"}
      </span>
      <button
        onClick={() => onToggle(r)}
        className="text-gray-400 hover:text-yellow-600 transition-colors p-1"
        title={r.active ? "Pause" : "Activate"}
      >
        {r.active ? <ToggleRight className="h-5 w-5 text-emerald-500" /> : <ToggleLeft className="h-5 w-5" />}
      </button>
      <button
        onClick={() => onRemove(r)}
        className="text-gray-400 hover:text-red-500 transition-colors p-1"
        title="Remove"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
