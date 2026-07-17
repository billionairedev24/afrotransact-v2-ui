"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, Trash2, Pencil, MapPin, X, Search } from "lucide-react"
import {
  listOverrideGroups,
  createOverrideGroup,
  updateOverrideGroup,
  deleteOverrideGroup,
  setOverrideGroupMembers,
  listAdminZones,
  type ZoneOverrideGroup,
  type ZoneOverrideGroupInput,
  type ServiceZone,
} from "@/lib/api"
import { getAccessToken } from "@/lib/auth-helpers"
import { friendlyMessage, logError } from "@/lib/errors"

// Dollars <-> cents helpers. Inputs are in dollars; blank means "don't override".
const centsToDollars = (c: number | null) => (c == null ? "" : (c / 100).toString())
const dollarsToCents = (s: string) => (s.trim() === "" ? null : Math.round(Number(s) * 100))
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s))

interface FormState {
  name: string
  taxRate: string
  shippingMode: string
  shippingRate: string
  flatShipping: string
  freeThreshold: string
}

const EMPTY_FORM: FormState = {
  name: "",
  taxRate: "",
  shippingMode: "",
  shippingRate: "",
  flatShipping: "",
  freeThreshold: "",
}

function toInput(f: FormState): ZoneOverrideGroupInput {
  return {
    name: f.name.trim(),
    tax_rate: numOrNull(f.taxRate),
    shipping_mode: f.shippingMode === "" ? null : f.shippingMode,
    shipping_rate_cents_per_lb: dollarsToCents(f.shippingRate),
    flat_shipping_cents: dollarsToCents(f.flatShipping),
    free_shipping_threshold_cents: dollarsToCents(f.freeThreshold),
  }
}

function fromGroup(g: ZoneOverrideGroup): FormState {
  return {
    name: g.name,
    taxRate: g.taxRate == null ? "" : g.taxRate.toString(),
    shippingMode: g.shippingMode ?? "",
    shippingRate: centsToDollars(g.shippingRateCentsPerLb),
    flatShipping: centsToDollars(g.flatShippingCents),
    freeThreshold: centsToDollars(g.freeShippingThresholdCents),
  }
}

/** Short human summary of what a group overrides, for the list. */
function overrideSummary(g: ZoneOverrideGroup): string[] {
  const out: string[] = []
  if (g.taxRate != null) out.push(`Tax ${(g.taxRate * 100).toFixed(2)}%`)
  if (g.shippingMode) out.push(`Shipping: ${g.shippingMode === "flat" ? "flat" : "per lb"}`)
  if (g.flatShippingCents != null) out.push(`Flat $${(g.flatShippingCents / 100).toFixed(2)}`)
  if (g.shippingRateCentsPerLb != null) out.push(`$${(g.shippingRateCentsPerLb / 100).toFixed(2)}/lb`)
  if (g.freeShippingThresholdCents != null) out.push(`Free over $${(g.freeShippingThresholdCents / 100).toFixed(2)}`)
  return out.length ? out : ["No fields set (inherits)"]
}

export default function ZoneOverridesPage() {
  const [groups, setGroups] = useState<ZoneOverrideGroup[]>([])
  const [zones, setZones] = useState<ServiceZone[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ZoneOverrideGroup | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [membersOf, setMembersOf] = useState<ZoneOverrideGroup | null>(null)

  const reload = useCallback(async () => {
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      const [g, z] = await Promise.all([listOverrideGroups(token), listAdminZones(token)])
      setGroups(g)
      setZones(z)
    } catch (err) {
      logError(err, "ZoneOverrides.reload")
      toast.error(friendlyMessage(err, "Could not load override groups."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }
  function openEdit(g: ZoneOverrideGroup) {
    setEditing(g)
    setForm(fromGroup(g))
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Give the group a name."); return }
    if (form.taxRate.trim() && (Number(form.taxRate) < 0 || Number(form.taxRate) > 1)) {
      toast.error("Tax rate is a decimal between 0 and 1 (e.g. 0.0825 = 8.25%).")
      return
    }
    setSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      if (editing) {
        await updateOverrideGroup(token, editing.id, toInput(form))
      } else {
        await createOverrideGroup(token, toInput(form))
      }
      setShowForm(false)
      await reload()
      toast.success(editing ? "Override group updated." : "Override group created.")
    } catch (err) {
      logError(err, "ZoneOverrides.save")
      toast.error(friendlyMessage(err, "Could not save the override group."))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(g: ZoneOverrideGroup) {
    if (!confirm(`Delete "${g.name}"? Its zones fall back to the normal hierarchy.`)) return
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      await deleteOverrideGroup(token, g.id)
      await reload()
      toast.success("Override group deleted.")
    } catch (err) {
      logError(err, "ZoneOverrides.delete")
      toast.error(friendlyMessage(err, "Could not delete the override group."))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Override groups</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            A named tax/shipping override you attach to a set of cities, states, or countries.
            A group&apos;s values are <strong>binding</strong> — they take precedence over the normal
            city → state → country inheritance. A zone belongs to at most one group; if no group
            applies, the hierarchy is used.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-dark px-3 py-2 text-sm font-semibold text-brand-gold hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New group
        </button>
      </div>

      {loading && <p className="py-10 text-center text-sm text-gray-500">Loading…</p>}

      {!loading && groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
          No override groups yet. Create one to bind a tax/shipping override to a set of zones.
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-gray-900">{g.name}</h2>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(g)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(g)} className="rounded p-1.5 text-red-500 hover:bg-red-50" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {overrideSummary(g).map((s) => (
                  <span key={s} className="rounded-full bg-brand-green-soft px-2 py-0.5 text-xs font-medium text-brand-green">{s}</span>
                ))}
              </div>
              <div className="mt-3 border-t border-gray-100 pt-3">
                <button
                  onClick={() => setMembersOf(g)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {g.zoneIds.length} {g.zoneIds.length === 1 ? "zone" : "zones"} — manage
                </button>
                {g.zoneIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {g.zoneIds.slice(0, 6).map((zid) => (
                      <span key={zid} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                        {zoneById.get(zid)?.displayName ?? "—"}
                      </span>
                    ))}
                    {g.zoneIds.length > 6 && (
                      <span className="text-[11px] text-gray-400">+{g.zoneIds.length - 6} more</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <GroupFormModal
          editing={!!editing}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}

      {membersOf && (
        <MembersModal
          group={membersOf}
          zones={zones}
          onClose={() => setMembersOf(null)}
          onSaved={async () => { setMembersOf(null); await reload() }}
        />
      )}
    </div>
  )
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  )
}

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-green focus:outline-none"

function GroupFormModal({
  editing, form, setForm, saving, onClose, onSave,
}: {
  editing: boolean
  form: FormState
  setForm: (f: FormState) => void
  saving: boolean
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">{editing ? "Edit override group" : "New override group"}</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <Labeled label="Name">
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tax-free metros" />
          </Labeled>
          <p className="text-[11px] text-gray-400">Leave a field blank to NOT override it — those fall through to the normal hierarchy.</p>
          <Labeled label="Tax rate" hint="Decimal, e.g. 0.0825 = 8.25%. 0 = no tax.">
            <input className={inputCls} value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} placeholder="blank = inherit" inputMode="decimal" />
          </Labeled>
          <Labeled label="Shipping mode">
            <select className={inputCls} value={form.shippingMode} onChange={(e) => setForm({ ...form, shippingMode: e.target.value })}>
              <option value="">Inherit</option>
              <option value="per_lb">Per pound</option>
              <option value="flat">Flat</option>
            </select>
          </Labeled>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Rate $/lb" hint="For per-pound mode.">
              <input className={inputCls} value={form.shippingRate} onChange={(e) => setForm({ ...form, shippingRate: e.target.value })} placeholder="blank = inherit" inputMode="decimal" />
            </Labeled>
            <Labeled label="Flat fee $" hint="For flat mode.">
              <input className={inputCls} value={form.flatShipping} onChange={(e) => setForm({ ...form, flatShipping: e.target.value })} placeholder="blank = inherit" inputMode="decimal" />
            </Labeled>
          </div>
          <Labeled label="Free shipping over $" hint="Order subtotal above this ships free.">
            <input className={inputCls} value={form.freeThreshold} onChange={(e) => setForm({ ...form, freeThreshold: e.target.value })} placeholder="blank = inherit" inputMode="decimal" />
          </Labeled>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={onSave} disabled={saving} className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-semibold text-brand-gold hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : editing ? "Save changes" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  )
}

function MembersModal({
  group, zones, onClose, onSaved,
}: {
  group: ZoneOverrideGroup
  zones: ServiceZone[]
  onClose: () => void
  onSaved: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(group.zoneIds))
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return zones
      .filter((z) => !q || z.displayName.toLowerCase().includes(q) || z.code.toLowerCase().includes(q))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [zones, query])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("No token")
      await setOverrideGroupMembers(token, group.id, Array.from(selected))
      toast.success("Zones updated.")
      onSaved()
    } catch (err) {
      logError(err, "ZoneOverrides.setMembers")
      toast.error(friendlyMessage(err, "Could not update zones."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">Zones in “{group.name}”</h2>
            <p className="text-xs text-gray-500">A zone moves here from any other group it was in.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="border-b border-gray-100 px-5 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input className="flex-1 text-sm outline-none" placeholder="Search zones…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filtered.map((z) => (
            <label key={z.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50">
              <input type="checkbox" checked={selected.has(z.id)} onChange={() => toggle(z.id)} className="h-4 w-4 accent-brand-green" />
              <span className="flex-1 text-sm text-gray-800">{z.displayName}</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">{z.level}</span>
            </label>
          ))}
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No zones match.</p>}
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
          <span className="text-xs text-gray-500">{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
            <button onClick={save} disabled={saving} className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-semibold text-brand-gold hover:opacity-90 disabled:opacity-50">
              {saving ? "Saving…" : "Save zones"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
