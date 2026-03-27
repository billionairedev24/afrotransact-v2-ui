"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { toast } from "sonner"
import {
  MapPin, ToggleLeft, ToggleRight, Plus, ChevronDown, ChevronRight,
  Loader2, Pencil, Globe, Building2
} from "lucide-react"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog"
import { RowActions, type RowAction } from "@/components/ui/RowActions"
import {
  getAdminRegions,
  createRegion,
  updateRegion,
  type Region,
} from "@/lib/api"

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"

type RegionFormData = {
  code: string
  name: string
  country_code: string
  state_or_province: string
  city: string
  currency: string
  timezone: string
  tax_rate: number
  shipping_rate_cents_per_lb: number
  free_shipping_threshold_cents: number
  active: boolean
}

const DEFAULT_FORM: RegionFormData = {
  code: "",
  name: "",
  country_code: "US",
  state_or_province: "",
  city: "",
  currency: "USD",
  timezone: "America/Chicago",
  tax_rate: 8.25,
  shipping_rate_cents_per_lb: 75,
  free_shipping_threshold_cents: 7500,
  active: true,
}

function RegionForm({
  form,
  onChange,
  isEdit,
}: {
  form: RegionFormData
  onChange: (f: RegionFormData) => void
  isEdit: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Region Code</label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => onChange({ ...form, code: e.target.value })}
            placeholder="us-tx-austin"
            className={INPUT_CLASS}
            required
            disabled={isEdit}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Display Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="Austin, TX"
            className={INPUT_CLASS}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Country Code</label>
          <input
            type="text"
            value={form.country_code}
            onChange={(e) => onChange({ ...form, country_code: e.target.value })}
            className={INPUT_CLASS}
            placeholder="US"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">State / Province</label>
          <input
            type="text"
            value={form.state_or_province}
            onChange={(e) => onChange({ ...form, state_or_province: e.target.value })}
            className={INPUT_CLASS}
            placeholder="TX"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">City</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => onChange({ ...form, city: e.target.value })}
            className={INPUT_CLASS}
            placeholder="Austin"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Currency</label>
          <input
            type="text"
            value={form.currency}
            onChange={(e) => onChange({ ...form, currency: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Timezone</label>
          <input
            type="text"
            value={form.timezone}
            onChange={(e) => onChange({ ...form, timezone: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Tax Rate (%)</label>
          <input
            type="number"
            step={0.01}
            min={0}
            max={100}
            value={form.tax_rate}
            onChange={(e) => onChange({ ...form, tax_rate: Number(e.target.value) })}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Ship (cents/lb)</label>
          <input
            type="number"
            step={1}
            min={0}
            value={form.shipping_rate_cents_per_lb}
            onChange={(e) => onChange({ ...form, shipping_rate_cents_per_lb: Number(e.target.value) })}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Free Ship ($)</label>
          <input
            type="number"
            step={1}
            min={0}
            value={Math.round(form.free_shipping_threshold_cents / 100)}
            onChange={(e) => onChange({ ...form, free_shipping_threshold_cents: Number(e.target.value) * 100 })}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="region-active"
          checked={form.active}
          onChange={(e) => onChange({ ...form, active: e.target.checked })}
          className="rounded border-border bg-background text-primary focus:ring-primary"
        />
        <label htmlFor="region-active" className="text-sm text-foreground">Active</label>
      </div>
    </div>
  )
}

type GroupedRegions = {
  country: string
  states: {
    state: string
    regions: Region[]
  }[]
}[]

function groupRegions(regions: Region[]): GroupedRegions {
  const countryMap = new Map<string, Map<string, Region[]>>()

  for (const r of regions) {
    const country = r.countryCode || "Unknown"
    const state = r.stateOrProvince || "—"

    if (!countryMap.has(country)) countryMap.set(country, new Map())
    const stateMap = countryMap.get(country)!
    if (!stateMap.has(state)) stateMap.set(state, [])
    stateMap.get(state)!.push(r)
  }

  const result: GroupedRegions = []
  for (const [country, stateMap] of Array.from(countryMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const states: GroupedRegions[0]["states"] = []
    for (const [state, regs] of Array.from(stateMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      states.push({
        state,
        regions: regs.sort((a, b) => (a.city || "").localeCompare(b.city || "")),
      })
    }
    result.push({ country, states })
  }
  return result
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  NG: "Nigeria",
  GH: "Ghana",
  KE: "Kenya",
  ZA: "South Africa",
}

export default function RegionsPage() {
  const { status } = useSession()

  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRegion, setEditingRegion] = useState<Region | null>(null)
  const [form, setForm] = useState<RegionFormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const fetchRegions = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) return
    setLoading(true)
    try {
      const data = await getAdminRegions(token)
      setRegions(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load regions")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") fetchRegions()
    else setLoading(false)
  }, [status, fetchRegions])

  const grouped = useMemo(() => groupRegions(regions), [regions])

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function openCreate() {
    setEditingRegion(null)
    setForm(DEFAULT_FORM)
    setDialogOpen(true)
  }

  function openEdit(region: Region) {
    setEditingRegion(region)
    setForm({
      code: region.code,
      name: region.name,
      country_code: region.countryCode || "US",
      state_or_province: region.stateOrProvince || "",
      city: region.city || "",
      currency: region.currency || "USD",
      timezone: region.timezone || "America/Chicago",
      tax_rate: region.taxRate,
      shipping_rate_cents_per_lb: region.shippingRateCentsPerLb,
      free_shipping_threshold_cents: region.freeShippingThresholdCents,
      active: region.active,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    const token = await getAccessToken()
    if (!token) { toast.error("Not authenticated"); return }
    setSaving(true)
    try {
      if (editingRegion) {
        const updated = await updateRegion(token, editingRegion.id, {
          code: form.code || editingRegion.code,
          name: form.name,
          country_code: form.country_code,
          state_or_province: form.state_or_province || null,
          city: form.city || null,
          currency: form.currency,
          timezone: form.timezone,
          tax_rate: form.tax_rate,
          shipping_rate_cents_per_lb: form.shipping_rate_cents_per_lb,
          free_shipping_threshold_cents: form.free_shipping_threshold_cents,
          active: form.active,
        })
        setRegions((prev) => prev.map((r) => (r.id === editingRegion.id ? updated : r)))
        toast.success("Region updated")
      } else {
        const region = await createRegion(token, {
          code: form.code,
          name: form.name,
          country_code: form.country_code,
          state_or_province: form.state_or_province || null,
          city: form.city || null,
          currency: form.currency,
          timezone: form.timezone,
          tax_rate: form.tax_rate,
          shipping_rate_cents_per_lb: form.shipping_rate_cents_per_lb,
          free_shipping_threshold_cents: form.free_shipping_threshold_cents,
          active: form.active,
        })
        setRegions((prev) => [...prev, region])
        toast.success("Region created")
      }
      setDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (region: Region) => {
    const token = await getAccessToken()
    if (!token) return
    setSavingId(region.id)
    try {
      const updated = await updateRegion(token, region.id, { active: !region.active })
      setRegions((prev) => prev.map((r) => (r.id === region.id ? updated : r)))
      toast.success(updated.active ? "Region activated" : "Region deactivated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle")
    } finally {
      setSavingId(null)
    }
  }

  const totalActive = regions.filter((r) => r.active).length

  if (status !== "authenticated") {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Sign in to manage regions.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Regions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {regions.length} region{regions.length !== 1 ? "s" : ""} &middot; {totalActive} active
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Region
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading regions...</span>
        </div>
      )}

      {!loading && regions.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No regions yet. Add your first region to get started.</p>
        </div>
      )}

      {!loading && grouped.map((countryGroup) => {
        const countryKey = `country-${countryGroup.country}`
        const isCountryCollapsed = collapsed.has(countryKey)
        const countryRegionCount = countryGroup.states.reduce((s, st) => s + st.regions.length, 0)

        return (
          <div key={countryGroup.country} className="space-y-3">
            {/* Country header */}
            <button
              onClick={() => toggleCollapse(countryKey)}
              className="flex items-center gap-2 group w-full text-left"
            >
              {isCountryCollapsed
                ? <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              }
              <Globe className="h-4 w-4 text-primary" />
              <span className="text-base font-semibold text-foreground">
                {COUNTRY_NAMES[countryGroup.country] || countryGroup.country}
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                ({countryRegionCount} region{countryRegionCount !== 1 ? "s" : ""})
              </span>
            </button>

            {!isCountryCollapsed && countryGroup.states.map((stateGroup) => {
              const stateKey = `state-${countryGroup.country}-${stateGroup.state}`
              const isStateCollapsed = collapsed.has(stateKey)

              return (
                <div key={stateGroup.state} className="ml-6 space-y-2">
                  {/* State header */}
                  <button
                    onClick={() => toggleCollapse(stateKey)}
                    className="flex items-center gap-2 group w-full text-left"
                  >
                    {isStateCollapsed
                      ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    }
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {stateGroup.state}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({stateGroup.regions.length})
                    </span>
                  </button>

                  {!isStateCollapsed && (
                    <div className="ml-6 rounded-xl border border-border bg-card">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                            <th className="text-left px-4 py-2.5 font-medium">City / Region</th>
                            <th className="text-right px-4 py-2.5 font-medium">Tax %</th>
                            <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Ship ¢/lb</th>
                            <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Free Ship</th>
                            <th className="text-center px-4 py-2.5 font-medium w-[90px]">Status</th>
                            <th className="w-[50px]" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {stateGroup.regions.map((region) => {
                            const actions: RowAction[] = [
                              {
                                label: "Edit Region",
                                icon: <Pencil />,
                                onClick: () => openEdit(region),
                              },
                              {
                                label: region.active ? "Deactivate" : "Activate",
                                icon: region.active ? <ToggleLeft /> : <ToggleRight />,
                                onClick: () => toggleActive(region),
                                variant: region.active ? "danger" : "default",
                              },
                            ]

                            return (
                              <tr key={region.id} className="hover:bg-muted/40 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-foreground font-medium truncate">
                                        {region.city || region.name || <span className="text-muted-foreground italic">Unnamed Region</span>}
                                      </p>
                                      <p className="text-muted-foreground text-xs font-mono truncate">{region.code || "—"}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right text-foreground tabular-nums">{region.taxRate}%</td>
                                <td className="px-4 py-3 text-right text-foreground hidden sm:table-cell tabular-nums">{region.shippingRateCentsPerLb}¢</td>
                                <td className="px-4 py-3 text-right text-foreground hidden md:table-cell tabular-nums">
                                  ${(region.freeShippingThresholdCents / 100).toFixed(0)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {savingId === region.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />
                                  ) : (
                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${region.active ? "bg-green-500/20 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                                      {region.active ? "Active" : "Off"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-3">
                                  <RowActions actions={actions} />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} className="max-w-lg">
        <DialogHeader onClose={() => setDialogOpen(false)}>
          {editingRegion ? "Edit Region" : "Add Region"}
        </DialogHeader>
        <DialogBody>
          <RegionForm form={form} onChange={setForm} isEdit={!!editingRegion} />
        </DialogBody>
        <DialogFooter>
          <button
            onClick={() => setDialogOpen(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.code.trim() || !form.name.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-[#0f0f10] hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {editingRegion ? "Update" : "Create"}
          </button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
