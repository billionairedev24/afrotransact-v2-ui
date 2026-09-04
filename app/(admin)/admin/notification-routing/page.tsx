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
  Power,
  PowerOff,
  Pencil,
  Search,
  Check,
  Users,
  Zap,
  AtSign,
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
import { Sheet, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/Sheet"
import { createColumnHelper } from "@tanstack/react-table"

// ---------------------------------------------------------------------------
// Event-type color styling (by prefix: seller.*, order.*, …)
// ---------------------------------------------------------------------------

const EVENT_COLORS: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  seller:  { bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-200",   dot: "bg-amber-500"   },
  product: { bg: "bg-blue-50",    text: "text-blue-700",    ring: "ring-blue-200",    dot: "bg-blue-500"    },
  order:   { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", dot: "bg-emerald-500" },
  payment: { bg: "bg-purple-50",  text: "text-purple-700",  ring: "ring-purple-200",  dot: "bg-purple-500"  },
}

function eventStyle(key: string) {
  const prefix = key.split(".")[0]
  return EVENT_COLORS[prefix] ?? { bg: "bg-gray-50", text: "text-gray-600", ring: "ring-gray-200", dot: "bg-gray-400" }
}

// ---------------------------------------------------------------------------
// Grouped-by-email model
// ---------------------------------------------------------------------------

interface EmailGroup {
  /** Lowercased key used for grouping / matching. */
  key: string
  /** Display email (first-seen casing). */
  email: string
  /** First non-empty label across this email's subscriptions. */
  label: string
  /** All backend rows for this email — one per subscribed event type. */
  subscriptions: NotificationRecipient[]
  activeCount: number
  pausedCount: number
}

function groupByEmail(recipients: NotificationRecipient[]): EmailGroup[] {
  const map = new Map<string, EmailGroup>()
  for (const r of recipients) {
    const key = r.email.trim().toLowerCase()
    let g = map.get(key)
    if (!g) {
      g = { key, email: r.email, label: "", subscriptions: [], activeCount: 0, pausedCount: 0 }
      map.set(key, g)
    }
    g.subscriptions.push(r)
    if (!g.label && r.label) g.label = r.label
    if (r.active) g.activeCount++
    else g.pausedCount++
  }
  return Array.from(map.values()).sort((a, b) => a.email.localeCompare(b.email))
}

const col = createColumnHelper<EmailGroup>()

// ---------------------------------------------------------------------------
// Summary stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
}: {
  label: string
  value: number
  icon: React.ElementType
  iconColor: string
}) {
  return (
    <div className="rounded-xl border border-input bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compact chip for an event type
// ---------------------------------------------------------------------------

function AlertChip({ label, colorKey, paused }: { label: string; colorKey: string; paused?: boolean }) {
  const style = eventStyle(colorKey)
  return (
    <span
      className={`inline-flex max-w-[12rem] items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.bg} ${style.text} ${style.ring} ${
        paused ? "opacity-50" : ""
      }`}
      title={paused ? `${label} (paused)` : label}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${paused ? "bg-gray-400" : style.dot}`} />
      <span className="truncate">{label}</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NotificationRoutingPage() {
  const { status } = useSession()

  const [eventTypes, setEventTypes] = useState<EventTypeInfo[]>([])
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([])
  const [loading, setLoading] = useState(true)

  // Add / edit sheet
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editKey, setEditKey] = useState<string | null>(null) // null = add mode
  const [emailInput, setEmailInput] = useState("")
  const [labelInput, setLabelInput] = useState("")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [eventSearch, setEventSearch] = useState("")
  const [saving, setSaving] = useState(false)

  const labelFor = useCallback(
    (key: string) => eventTypes.find((et) => et.key === key)?.label ?? key,
    [eventTypes],
  )

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
    else if (status === "unauthenticated") setLoading(false)
  }, [status, loadData])

  const groups = useMemo(() => groupByEmail(recipients), [recipients])

  const summary = useMemo(() => {
    const activeSubs = recipients.filter((r) => r.active).length
    return {
      emails: groups.length,
      subscriptions: recipients.length,
      activeSubs,
      eventTypes: eventTypes.length,
    }
  }, [groups, recipients, eventTypes])

  // ── Sheet open helpers ────────────────────────────────────────────────
  const openAdd = () => {
    setEditKey(null)
    setEmailInput("")
    setLabelInput("")
    setSelectedKeys(new Set())
    setEventSearch("")
    setSheetOpen(true)
  }

  const openEdit = (g: EmailGroup) => {
    setEditKey(g.key)
    setEmailInput(g.email)
    setLabelInput(g.label)
    setSelectedKeys(new Set(g.subscriptions.map((s) => s.event_type)))
    setEventSearch("")
    setSheetOpen(true)
  }

  const closeSheet = () => {
    if (saving) return
    setSheetOpen(false)
  }

  // Existing backend rows for the email currently being edited/added, keyed by
  // event_type. In add mode this catches the case where the typed email already
  // has subscriptions, so we merge instead of duplicating.
  const existingRowsByKey = useMemo(() => {
    const target = emailInput.trim().toLowerCase()
    const m = new Map<string, NotificationRecipient>()
    if (!target) return m
    for (const r of recipients) {
      if (r.email.trim().toLowerCase() === target) m.set(r.event_type, r)
    }
    return m
  }, [emailInput, recipients])

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── Save (diff desired vs. existing → add / remove) ───────────────────
  const handleSave = async () => {
    const email = emailInput.trim()
    if (!email) {
      toast.error("Email address is required")
      return
    }
    // Simple sanity check on the email shape.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address")
      return
    }
    if (selectedKeys.size === 0) {
      toast.error("Select at least one alert to subscribe to")
      return
    }

    const desired = selectedKeys
    const toAdd = [...desired].filter((k) => !existingRowsByKey.has(k))
    const toRemove = [...existingRowsByKey.entries()]
      .filter(([k]) => !desired.has(k))
      .map(([, row]) => row)

    if (toAdd.length === 0 && toRemove.length === 0) {
      toast.info("No changes to save")
      setSheetOpen(false)
      return
    }

    setSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) return

      await Promise.all([
        ...toAdd.map((event_type) =>
          addNotificationRecipient(token, { event_type, email, label: labelInput.trim() }),
        ),
        ...toRemove.map((row) => removeNotificationRecipient(token, row.id)),
      ])

      const parts: string[] = []
      if (toAdd.length) parts.push(`added ${toAdd.length} alert${toAdd.length > 1 ? "s" : ""}`)
      if (toRemove.length) parts.push(`removed ${toRemove.length}`)
      toast.success(`${email}: ${parts.join(", ")}`)
      setSheetOpen(false)
      await loadData()
    } catch (e: unknown) {
      logError(e, "saving notification subscriptions")
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  // ── Immediate per-subscription active toggle (inside the edit sheet) ───
  const handleToggleActive = async (r: NotificationRecipient) => {
    try {
      const token = await getAccessToken()
      if (!token) return
      await toggleNotificationRecipient(token, r.id, !r.active)
      setRecipients((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: !r.active } : x)))
      toast.success(r.active ? "Alert paused" : "Alert activated")
    } catch (e: unknown) {
      logError(e, "toggling notification recipient")
      toast.error("Toggle failed")
    }
  }

  // ── Remove an entire email (all its subscriptions) ────────────────────
  const handleRemoveEmail = async (g: EmailGroup) => {
    if (
      !confirm(
        `Remove ${g.email} from all ${g.subscriptions.length} alert${
          g.subscriptions.length > 1 ? "s" : ""
        }? This cannot be undone.`,
      )
    )
      return
    try {
      const token = await getAccessToken()
      if (!token) return
      const results = await Promise.all(g.subscriptions.map((s) => removeNotificationRecipient(token, s.id)))
      if (results.some((r) => !r.ok)) throw new Error("One or more deletes failed")
      toast.success(`${g.email} removed`)
      await loadData()
    } catch (e: unknown) {
      logError(e, "removing email subscriptions")
      toast.error("Remove failed")
    }
  }

  // ── Grouped table columns ─────────────────────────────────────────────
  const columns = useMemo(
    () => [
      col.accessor("email", {
        header: "Recipient",
        cell: (info) => {
          const g = info.row.original
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-foreground">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{g.email}</p>
                {g.label ? (
                  <p className="truncate text-xs text-gray-500">{g.label}</p>
                ) : (
                  <p className="text-xs text-gray-300 italic">no label</p>
                )}
              </div>
            </div>
          )
        },
        filterFn: (row, _id, filterValue) => {
          const g = row.original
          const q = String(filterValue).toLowerCase()
          if (g.email.toLowerCase().includes(q) || g.label.toLowerCase().includes(q)) return true
          // Also match against subscribed event-type labels.
          return g.subscriptions.some((s) => labelFor(s.event_type).toLowerCase().includes(q))
        },
      }),
      col.display({
        id: "alerts",
        header: "Subscribed alerts",
        cell: (info) => {
          const g = info.row.original
          const shown = g.subscriptions.slice(0, 4)
          const extra = g.subscriptions.length - shown.length
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {shown.map((s) => (
                <AlertChip key={s.id} label={labelFor(s.event_type)} colorKey={s.event_type} paused={!s.active} />
              ))}
              {extra > 0 && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  +{extra} more
                </span>
              )}
            </div>
          )
        },
      }),
      col.accessor((g) => g.subscriptions.length, {
        id: "count",
        header: "Alerts",
        cell: (info) => {
          const g = info.row.original
          return (
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-bold text-foreground">
                {g.subscriptions.length}
              </span>
              {g.pausedCount > 0 && (
                <span className="text-xs text-gray-400">{g.pausedCount} paused</span>
              )}
            </div>
          )
        },
      }),
      col.display({
        id: "actions",
        header: "",
        size: 96,
        cell: (info) => {
          const g = info.row.original
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => openEdit(g)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Manage alerts"
                aria-label={`Manage alerts for ${g.email}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleRemoveEmail(g)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Remove recipient"
                aria-label={`Remove ${g.email}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [labelFor],
  )

  // Filtered event types for the searchable multi-select in the sheet.
  const filteredEventTypes = useMemo(() => {
    const q = eventSearch.trim().toLowerCase()
    if (!q) return eventTypes
    return eventTypes.filter(
      (et) =>
        et.label.toLowerCase().includes(q) ||
        et.key.toLowerCase().includes(q) ||
        (et.description ?? "").toLowerCase().includes(q),
    )
  }, [eventTypes, eventSearch])

  if (status === "unauthenticated") {
    return (
      <div className="py-20 text-center text-gray-500">Sign in as admin to manage alert routing.</div>
    )
  }

  const isEdit = editKey !== null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alert Routing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Subscribe email addresses to platform notifications. One recipient can receive many alerts.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-5 py-2 text-sm font-bold text-brand-gold-foreground transition-colors hover:bg-brand-gold-hover disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Add Recipient
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Recipients" value={summary.emails} icon={Users} iconColor="bg-gray-100 text-gray-700" />
        <StatCard label="Subscriptions" value={summary.subscriptions} icon={Bell} iconColor="bg-amber-50 text-amber-700" />
        <StatCard label="Active alerts" value={summary.activeSubs} icon={Zap} iconColor="bg-emerald-50 text-emerald-700" />
        <StatCard label="Event types" value={summary.eventTypes} icon={AtSign} iconColor="bg-blue-50 text-blue-700" />
      </div>

      {/* Grouped-by-email table */}
      <div className="rounded-2xl border border-input bg-white p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Recipients</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            One row per email. Click the pencil to add or remove alerts and pause individual notifications.
          </p>
        </div>
        <DataTable
          columns={columns}
          data={groups}
          loading={loading}
          searchPlaceholder="Search by email, label, or alert…"
          searchColumn="email"
          emptyMessage="No recipients yet. Click 'Add Recipient' to subscribe an email to alerts."
          pageSize={15}
        />
      </div>

      {/* Add / edit sheet */}
      <Sheet open={sheetOpen} onClose={closeSheet}>
        <SheetHeader onClose={closeSheet}>{isEdit ? "Manage Recipient" : "Add Recipient"}</SheetHeader>
        <SheetBody>
          <div className="space-y-6">
            {/* Email + label */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="route-email" className="text-sm font-medium text-foreground">
                  Email Address <span className="text-destructive">*</span>
                </label>
                <input
                  id="route-email"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  disabled={isEdit}
                  placeholder="alerts@afrotransact.com"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                />
                {isEdit && (
                  <p className="text-xs text-muted-foreground">
                    Email can't be changed. Remove this recipient and add a new one to re-key.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="route-label" className="text-sm font-medium text-foreground">
                  Label <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  id="route-label"
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="e.g. Seller Ops Team"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Applied to newly-added alerts to help you recognise this recipient.
                </p>
              </div>
            </div>

            {/* Multi-select event types */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Alerts <span className="text-destructive">*</span>
                </label>
                <span className="text-xs text-muted-foreground">
                  {selectedKeys.size} of {eventTypes.length} selected
                </span>
              </div>

              {/* Search within event types */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  placeholder="Search alerts…"
                  className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {/* Quick select-all / clear (respects the current search filter) */}
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedKeys((prev) => {
                      const next = new Set(prev)
                      filteredEventTypes.forEach((et) => next.add(et.key))
                      return next
                    })
                  }
                  className="font-medium text-foreground hover:underline"
                >
                  Select {eventSearch ? "filtered" : "all"}
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedKeys((prev) => {
                      const next = new Set(prev)
                      filteredEventTypes.forEach((et) => next.delete(et.key))
                      return next
                    })
                  }
                  className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  Clear {eventSearch ? "filtered" : "all"}
                </button>
              </div>

              {/* Checkbox list */}
              <div className="max-h-[22rem] overflow-y-auto rounded-xl border border-input">
                {filteredEventTypes.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No alerts match "{eventSearch}".
                  </div>
                ) : (
                  <ul className="divide-y divide-input">
                    {filteredEventTypes.map((et) => {
                      const checked = selectedKeys.has(et.key)
                      const existing = existingRowsByKey.get(et.key)
                      const style = eventStyle(et.key)
                      return (
                        <li key={et.key}>
                          <div className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={checked}
                              onClick={() => toggleKey(et.key)}
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                checked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-input bg-background hover:border-primary/50"
                              }`}
                            >
                              {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleKey(et.key)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                                <span className="text-sm font-medium text-foreground">{et.label}</span>
                              </div>
                              {et.description && (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{et.description}</p>
                              )}
                            </button>

                            {/* Per-subscription active toggle — only for rows that
                                already exist in the backend for this email. */}
                            {existing && (
                              <button
                                type="button"
                                onClick={() => handleToggleActive(existing)}
                                title={existing.active ? "Pause this alert" : "Activate this alert"}
                                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                  existing.active
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : "border-input bg-gray-50 text-gray-500 hover:bg-gray-100"
                                }`}
                              >
                                {existing.active ? (
                                  <>
                                    <Power className="h-3 w-3" /> Active
                                  </>
                                ) : (
                                  <>
                                    <PowerOff className="h-3 w-3" /> Paused
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              {loading && eventTypes.length === 0 && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                </div>
              )}
            </div>
          </div>
        </SheetBody>
        <SheetFooter>
          <button
            onClick={closeSheet}
            disabled={saving}
            className="rounded-lg border border-input bg-background px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !emailInput.trim() || selectedKeys.size === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-5 py-2 text-sm font-bold text-brand-gold-foreground transition-colors hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} /> : null}
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add recipient"}
          </button>
        </SheetFooter>
      </Sheet>
    </div>
  )
}
