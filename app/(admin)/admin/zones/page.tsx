"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Country, State, City } from "country-state-city"
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react"
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  createAdminZone,
  deleteAdminZone,
  listAdminZones,
  listZoneFeatures,
  updateAdminZone,
  upsertZoneFeature,
  type ServiceZone,
  type ZoneFeature,
  type ZoneInput,
  type ZoneLevel,
} from "@/lib/api"
import { friendlyMessage, logError } from "@/lib/errors"

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"

type ZoneNode = ServiceZone & { children: ZoneNode[]; depth: number }

const STATUS_CYCLE: Record<ServiceZone["status"], ServiceZone["status"]> = {
  enabled: "coming_soon",
  coming_soon: "disabled",
  disabled: "enabled",
}

const STATUS_LABEL: Record<ServiceZone["status"], string> = {
  enabled: "Enabled",
  coming_soon: "Coming soon",
  disabled: "Disabled",
}

const STATUS_TONE: Record<ServiceZone["status"], string> = {
  enabled: "bg-emerald-100 text-emerald-800 border-emerald-200",
  coming_soon: "bg-amber-100 text-amber-800 border-amber-200",
  disabled: "bg-zinc-100 text-zinc-700 border-zinc-200",
}

const LEVEL_LABEL: Record<ZoneLevel, string> = {
  country: "Country",
  subdivision: "State",
  locality: "Locality",
}

const LEVEL_TONE: Record<ZoneLevel, string> = {
  country: "bg-blue-100 text-blue-800 border-blue-200",
  subdivision: "bg-purple-100 text-purple-800 border-purple-200",
  locality: "bg-teal-100 text-teal-800 border-teal-200",
}

function buildTree(zones: ServiceZone[]): ZoneNode[] {
  const byId = new Map<string, ZoneNode>()
  zones.forEach((z) => byId.set(z.id, { ...z, children: [], depth: 0 }))
  const roots: ZoneNode[] = []
  byId.forEach((node) => {
    if (node.parentZoneId && byId.has(node.parentZoneId)) {
      byId.get(node.parentZoneId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  const setDepth = (n: ZoneNode, d: number) => {
    n.depth = d
    n.children.forEach((c) => setDepth(c, d + 1))
  }
  roots.forEach((r) => setDepth(r, 0))
  return roots
}

function flatten(nodes: ZoneNode[], expanded: Set<string>): ZoneNode[] {
  const out: ZoneNode[] = []
  const walk = (n: ZoneNode) => {
    out.push(n)
    if (expanded.has(n.id)) n.children.forEach(walk)
  }
  nodes.forEach(walk)
  return out
}

export default function AdminZonesPage() {
  const [zones, setZones] = useState<ServiceZone[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [featuresOpen, setFeaturesOpen] = useState<Set<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState<Set<string>>(new Set())
  const [featuresByZone, setFeaturesByZone] = useState<Record<string, ZoneFeature[]>>({})
  const [addChildOf, setAddChildOf] = useState<ServiceZone | null>(null)
  const [showRootModal, setShowRootModal] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      setZones(await listAdminZones(token))
    } catch (err) {
      logError(err, "AdminZones.reload")
      toast.error(friendlyMessage(err, "Could not load zones."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const tree = useMemo(() => buildTree(zones), [zones])
  const flat = useMemo(() => flatten(tree, expanded), [tree, expanded])
  const byId = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones])

  function ancestorsOf(id: string): ServiceZone[] {
    const out: ServiceZone[] = []
    let cur = byId.get(id)
    while (cur?.parentZoneId) {
      const parent = byId.get(cur.parentZoneId)
      if (!parent) break
      out.push(parent)
      cur = parent
    }
    return out
  }

  async function toggleStatus(zone: ServiceZone) {
    const next = STATUS_CYCLE[zone.status]
    setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, status: next } : z)))
    try {
      const token = await getAccessToken()
      if (!token) return
      await updateAdminZone(token, zone.id, { status: next })
    } catch (err) {
      setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, status: zone.status } : z)))
      logError(err, "AdminZones.toggleStatus")
      toast.error(friendlyMessage(err, "Could not update status."))
    }
  }

  async function loadFeatures(zoneId: string) {
    try {
      const token = await getAccessToken()
      if (!token) return
      const feats = await listZoneFeatures(token, zoneId)
      setFeaturesByZone((prev) => ({ ...prev, [zoneId]: feats }))
    } catch (err) {
      logError(err, "AdminZones.loadFeatures")
      toast.error(friendlyMessage(err, "Could not load features."))
    }
  }

  function toggleFeaturesPanel(zoneId: string) {
    setFeaturesOpen((prev) => {
      const next = new Set(prev)
      if (next.has(zoneId)) next.delete(zoneId)
      else {
        next.add(zoneId)
        if (!featuresByZone[zoneId]) void loadFeatures(zoneId)
      }
      return next
    })
  }

  function toggleSettingsPanel(zoneId: string) {
    setSettingsOpen((prev) => {
      const next = new Set(prev)
      if (next.has(zoneId)) next.delete(zoneId)
      else next.add(zoneId)
      return next
    })
  }

  async function setFeatureEnabled(zoneId: string, key: string, enabled: boolean) {
    setFeaturesByZone((prev) => ({
      ...prev,
      [zoneId]: (prev[zoneId] ?? []).map((f) =>
        f.featureKey === key ? { ...f, enabled } : f,
      ),
    }))
    try {
      const token = await getAccessToken()
      if (!token) return
      await upsertZoneFeature(token, zoneId, key, enabled)
    } catch (err) {
      logError(err, "AdminZones.setFeatureEnabled")
      toast.error(friendlyMessage(err, "Could not update feature."))
      await loadFeatures(zoneId)
    }
  }

  async function addFeature(zoneId: string, key: string) {
    if (!key.trim()) return
    try {
      const token = await getAccessToken()
      if (!token) return
      await upsertZoneFeature(token, zoneId, key.trim(), true)
      await loadFeatures(zoneId)
    } catch (err) {
      logError(err, "AdminZones.addFeature")
      toast.error(friendlyMessage(err, "Could not add feature."))
    }
  }

  async function handleDelete(zone: ServiceZone) {
    if (!confirm(`Delete zone "${zone.displayName}"? Children/features must be cleared first.`)) return
    try {
      const token = await getAccessToken()
      if (!token) return
      await deleteAdminZone(token, zone.id)
      toast.success("Zone deleted")
      await reload()
    } catch (err) {
      logError(err, "AdminZones.delete")
      toast.error(friendlyMessage(err, "Could not delete zone."))
    }
  }

  async function saveOperationalFields(zoneId: string, patch: Partial<ZoneInput>) {
    try {
      const token = await getAccessToken()
      if (!token) return
      const updated = await updateAdminZone(token, zoneId, patch)
      setZones((prev) => prev.map((z) => (z.id === zoneId ? updated : z)))
      toast.success("Zone updated")
    } catch (err) {
      logError(err, "AdminZones.saveOperationalFields")
      toast.error(friendlyMessage(err, "Could not update zone."))
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Service Zones</h1>
          <p className="text-sm text-muted-foreground">
            Hierarchical rollout tree: country → state → locality. Settings inherit; closest override wins.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRootModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={16} /> Add zone
        </button>
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={16} /> Loading zones…
        </div>
      )}

      {!loading && flat.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No zones yet. Add a root country to begin.
        </div>
      )}

      {!loading && flat.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {flat.map((node) => {
              const hasChildren = node.children.length > 0
              const isOpen = expanded.has(node.id)
              const featPanelOpen = featuresOpen.has(node.id)
              const settPanelOpen = settingsOpen.has(node.id)
              return (
                <li key={node.id} className="flex flex-col">
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ paddingLeft: `${16 + node.depth * 20}px` }}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev)
                          if (next.has(node.id)) next.delete(node.id)
                          else next.add(node.id)
                          return next
                        })
                      }
                      aria-label={isOpen ? "Collapse" : "Expand"}
                    >
                      {hasChildren ? (
                        isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                      ) : (
                        <span className="inline-block w-4" />
                      )}
                    </button>
                    <MapPin size={16} className="text-muted-foreground" />
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-medium text-foreground">
                        {node.displayName}{" "}
                        <span className="text-xs font-normal text-muted-foreground">({node.code})</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {node.countryCode}
                        {node.subdivisionCode ? ` · ${node.subdivisionCode}` : ""}
                        {node.cityName ? ` · ${node.cityName}` : ""}
                        {node.postalPattern ? ` · postal ${node.postalPattern}` : ""}
                      </span>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${LEVEL_TONE[node.level]}`}
                    >
                      {LEVEL_LABEL[node.level]}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleStatus(node)}
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[node.status]}`}
                      title="Click to cycle status"
                    >
                      {STATUS_LABEL[node.status]}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSettingsPanel(node.id)}
                      className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                    >
                      {settPanelOpen ? "Hide settings" : "Settings"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFeaturesPanel(node.id)}
                      className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                    >
                      {featPanelOpen ? "Hide features" : "Features"}
                    </button>
                    {node.level !== "locality" && (
                      <button
                        type="button"
                        onClick={() => setAddChildOf(node)}
                        className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        <Plus size={12} className="inline" /> Child
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(node)}
                      className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {settPanelOpen && (
                    <SettingsPanel
                      zone={node}
                      ancestors={ancestorsOf(node.id)}
                      onSave={(patch) => saveOperationalFields(node.id, patch)}
                    />
                  )}
                  {featPanelOpen && (
                    <FeaturesPanel
                      zone={node}
                      features={featuresByZone[node.id] ?? []}
                      onSetEnabled={(key, enabled) => setFeatureEnabled(node.id, key, enabled)}
                      onAdd={(key) => addFeature(node.id, key)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {(addChildOf || showRootModal) && (
        <AddZoneModal
          parent={addChildOf}
          existingZones={zones}
          onClose={() => {
            setAddChildOf(null)
            setShowRootModal(false)
          }}
          onCreate={async (input) => {
            try {
              const token = await getAccessToken()
              if (!token) return
              await createAdminZone(token, input)
              toast.success("Zone created")
              setAddChildOf(null)
              setShowRootModal(false)
              if (input.parent_zone_id) {
                setExpanded((prev) => new Set(prev).add(input.parent_zone_id!))
              }
              await reload()
            } catch (err) {
              logError(err, "AdminZones.create")
              toast.error(friendlyMessage(err, "Could not create zone."))
            }
          }}
        />
      )}
    </div>
  )
}

// ── Settings panel (operational fields with inheritance hint) ──

function SettingsPanel({
  zone,
  ancestors,
  onSave,
}: {
  zone: ServiceZone
  ancestors: ServiceZone[]
  onSave: (patch: Partial<ZoneInput>) => void | Promise<void>
}) {
  const [currency, setCurrency] = useState(zone.currency ?? "")
  const [timezone, setTimezone] = useState(zone.timezone ?? "")
  const [taxRate, setTaxRate] = useState(
    zone.taxRate !== null ? String(zone.taxRate) : "",
  )
  const [shippingRate, setShippingRate] = useState(
    zone.shippingRateCentsPerLb !== null ? String(zone.shippingRateCentsPerLb) : "",
  )
  const [freeThreshold, setFreeThreshold] = useState(
    zone.freeShippingThresholdCents !== null ? String(zone.freeShippingThresholdCents) : "",
  )
  const [saving, setSaving] = useState(false)

  // For each field find the closest ancestor that has it set.
  function inheritedFrom<K extends keyof ServiceZone>(key: K): ServiceZone | null {
    for (const a of ancestors) {
      if (a[key] !== null && a[key] !== undefined) return a
    }
    return null
  }

  function hint(key: keyof ServiceZone, ownVal: string): string | null {
    if (ownVal !== "") return null
    const src = inheritedFrom(key)
    if (!src) return null
    const v = src[key]
    return `(inherited from ${src.displayName}: ${String(v)})`
  }

  async function save() {
    setSaving(true)
    try {
      const patch: Partial<ZoneInput> = {
        currency: currency === "" ? null : currency,
        timezone: timezone === "" ? null : timezone,
        tax_rate: taxRate === "" ? null : Number(taxRate),
        shipping_rate_cents_per_lb:
          shippingRate === "" ? null : Number(shippingRate),
        free_shipping_threshold_cents:
          freeThreshold === "" ? null : Number(freeThreshold),
      }
      await onSave(patch)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t border-border bg-muted/30 px-6 py-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Operational settings
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SettingsField
          label="Currency"
          value={currency}
          onChange={setCurrency}
          placeholder="USD"
          hint={hint("currency", currency)}
        />
        <SettingsField
          label="Timezone"
          value={timezone}
          onChange={setTimezone}
          placeholder="America/Chicago"
          hint={hint("timezone", timezone)}
        />
        <SettingsField
          label="Tax rate (0.0825 = 8.25%)"
          value={taxRate}
          onChange={setTaxRate}
          placeholder="0.0825"
          hint={hint("taxRate", taxRate)}
        />
        <SettingsField
          label="Shipping rate (¢/lb)"
          value={shippingRate}
          onChange={setShippingRate}
          placeholder="50"
          hint={hint("shippingRateCentsPerLb", shippingRate)}
        />
        <SettingsField
          label="Free-shipping threshold (¢, -1 = none)"
          value={freeThreshold}
          onChange={setFreeThreshold}
          placeholder="5000"
          hint={hint("freeShippingThresholdCents", freeThreshold)}
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="animate-spin" size={12} />} Save overrides
        </button>
      </div>
    </div>
  )
}

function SettingsField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint: string | null
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        className={INPUT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <span className="mt-1 block text-[10px] text-muted-foreground/70">{hint}</span>}
    </label>
  )
}

function FeaturesPanel({
  zone,
  features,
  onSetEnabled,
  onAdd,
}: {
  zone: ServiceZone
  features: ZoneFeature[]
  onSetEnabled: (key: string, enabled: boolean) => void
  onAdd: (key: string) => void
}) {
  const [newKey, setNewKey] = useState("")
  return (
    <div className="border-t border-border bg-muted/30 px-6 py-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Features on {zone.displayName}
      </div>
      {features.length === 0 && (
        <div className="mb-3 text-xs text-muted-foreground">No features defined directly.</div>
      )}
      <ul className="mb-3 space-y-1.5">
        {features.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
            <code className="font-mono text-foreground">{f.featureKey}</code>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={f.enabled}
                onChange={(e) => onSetEnabled(f.featureKey, e.target.checked)}
              />
              <span className="text-xs text-muted-foreground">
                {f.enabled ? "enabled" : "disabled"}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="feature_key"
          className={INPUT_CLASS + " max-w-xs"}
        />
        <button
          type="button"
          onClick={() => {
            onAdd(newKey)
            setNewKey("")
          }}
          className="rounded-lg border border-border px-2 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ── Add Zone modal (cascading: country → state → city/postal) ──

type LocalityMode = "city" | "postal"

function AddZoneModal({
  parent,
  existingZones,
  onClose,
  onCreate,
}: {
  parent: ServiceZone | null
  existingZones: ServiceZone[]
  onClose: () => void
  onCreate: (input: ZoneInput) => void | Promise<void>
}) {
  // Determine the "step" from the parent: no parent → create country; country
  // parent → create subdivision; subdivision parent → create locality.
  const baseLevel: ZoneLevel = !parent
    ? "country"
    : parent.level === "country"
      ? "subdivision"
      : "locality"

  const lockedCountry = parent?.countryCode ?? ""
  const lockedSubdivision = parent?.subdivisionCode ?? ""

  const allCountries = useMemo(() => Country.getAllCountries(), [])

  const [countryISO, setCountryISO] = useState(lockedCountry || "")
  const [stateISO, setStateISO] = useState(lockedSubdivision || "")
  const [localityMode, setLocalityMode] = useState<LocalityMode>("city")
  const [cityName, setCityName] = useState("")
  const [postalPattern, setPostalPattern] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [saving, setSaving] = useState(false)

  const statesForCountry = useMemo(
    () => (countryISO ? State.getStatesOfCountry(countryISO) : []),
    [countryISO],
  )
  const citiesForState = useMemo(
    () => (countryISO && stateISO ? City.getCitiesOfState(countryISO, stateISO) : []),
    [countryISO, stateISO],
  )

  // Resolve parent zone IDs by ISO codes from the existing tree.
  const parentZoneID = useMemo(() => {
    if (baseLevel === "country") return null
    if (baseLevel === "subdivision") {
      const countryZone = existingZones.find(
        (z) => z.level === "country" && z.countryCode === countryISO,
      )
      return countryZone?.id ?? null
    }
    // locality → parent is subdivision matching country + state
    const subZone = existingZones.find(
      (z) =>
        z.level === "subdivision" &&
        z.countryCode === countryISO &&
        z.subdivisionCode === stateISO,
    )
    return subZone?.id ?? null
  }, [baseLevel, existingZones, countryISO, stateISO])

  const countryName = useMemo(
    () => allCountries.find((c) => c.isoCode === countryISO)?.name ?? "",
    [allCountries, countryISO],
  )
  const stateName = useMemo(
    () => statesForCountry.find((s) => s.isoCode === stateISO)?.name ?? "",
    [statesForCountry, stateISO],
  )

  // Auto-fill display name from selection when empty.
  useEffect(() => {
    if (displayName !== "") return
    if (baseLevel === "country" && countryName) setDisplayName(countryName)
    else if (baseLevel === "subdivision" && stateName) setDisplayName(stateName)
    else if (baseLevel === "locality") {
      if (localityMode === "city" && cityName) setDisplayName(cityName)
      else if (localityMode === "postal" && postalPattern) setDisplayName(`${stateName} ${postalPattern}`)
    }
  }, [baseLevel, countryName, stateName, cityName, postalPattern, localityMode, displayName])

  function code(): string {
    if (baseLevel === "country") return countryISO
    if (baseLevel === "subdivision") return `${countryISO}-${stateISO}`
    if (localityMode === "city") return `${countryISO}-${stateISO}-${cityName.replace(/\s+/g, "_")}`
    return `${countryISO}-${stateISO}-${postalPattern}`
  }

  function preview(): string {
    if (baseLevel === "country") return countryName || "(pick a country)"
    if (baseLevel === "subdivision") return `${countryName} → ${stateName || "(pick a state)"}`
    const last = localityMode === "city" ? cityName : postalPattern
    return `${countryName} → ${stateName} → ${last || "(pick city or postal)"}`
  }

  function canSubmit(): boolean {
    if (!countryISO) return false
    if (baseLevel === "subdivision" && !stateISO) return false
    if (baseLevel === "locality") {
      if (!stateISO) return false
      if (localityMode === "city" && !cityName) return false
      if (localityMode === "postal" && !postalPattern) return false
      if (!parentZoneID) return false
    }
    if (baseLevel === "subdivision" && !parentZoneID) return false
    return true
  }

  async function submit() {
    setSaving(true)
    try {
      const input: ZoneInput = {
        parent_zone_id: parentZoneID,
        code: code(),
        display_name: displayName || code(),
        country_code: countryISO,
        subdivision_code: baseLevel === "country" ? null : stateISO,
        postal_pattern:
          baseLevel === "locality" && localityMode === "postal" ? postalPattern : null,
        city_name: baseLevel === "locality" && localityMode === "city" ? cityName : null,
        level: baseLevel,
        status: "disabled",
      }
      await onCreate(input)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader>
        {parent ? `Add child under ${parent.displayName}` : "Add zone"}
      </DialogHeader>
      <DialogBody>
        <div className="space-y-3">
          {/* Step 1: country */}
          <Field label="Country" required>
            <select
              className={INPUT_CLASS}
              value={countryISO}
              onChange={(e) => {
                setCountryISO(e.target.value)
                setStateISO("")
                setCityName("")
              }}
              disabled={!!lockedCountry}
            >
              <option value="">— pick a country —</option>
              {allCountries.map((c) => (
                <option key={c.isoCode} value={c.isoCode}>
                  {c.name} ({c.isoCode})
                </option>
              ))}
            </select>
          </Field>

          {/* Step 2: state (subdivision / locality only) */}
          {baseLevel !== "country" && (
            <Field label="State / Subdivision" required>
              <select
                className={INPUT_CLASS}
                value={stateISO}
                onChange={(e) => {
                  setStateISO(e.target.value)
                  setCityName("")
                }}
                disabled={!!lockedSubdivision || !countryISO}
              >
                <option value="">— pick a state —</option>
                {statesForCountry.map((s) => (
                  <option key={s.isoCode} value={s.isoCode}>
                    {s.name} ({s.isoCode})
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Step 3: locality */}
          {baseLevel === "locality" && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="locality-mode"
                    checked={localityMode === "city"}
                    onChange={() => setLocalityMode("city")}
                  />
                  By city
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="locality-mode"
                    checked={localityMode === "postal"}
                    onChange={() => setLocalityMode("postal")}
                  />
                  By postal pattern
                </label>
              </div>
              {localityMode === "city" ? (
                <Field label="City" required>
                  <select
                    className={INPUT_CLASS}
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                    disabled={!stateISO}
                  >
                    <option value="">— pick a city —</option>
                    {citiesForState.map((c, i) => (
                      <option key={`${c.name}-${i}`} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Postal pattern (glob)" required>
                  <input
                    className={INPUT_CLASS + " font-mono"}
                    value={postalPattern}
                    onChange={(e) => setPostalPattern(e.target.value)}
                    placeholder="787*"
                  />
                </Field>
              )}
            </>
          )}

          <Field label="Display name">
            <input
              className={INPUT_CLASS}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="auto-filled from selection"
            />
          </Field>

          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
            <div className="text-muted-foreground">You are creating:</div>
            <div className="mt-1 font-medium text-foreground">{preview()}</div>
            <div className="mt-1 text-muted-foreground">
              Level: <span className="font-mono">{baseLevel}</span> · Code:{" "}
              <span className="font-mono">{code() || "—"}</span>
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || !canSubmit()}
          onClick={() => void submit()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="animate-spin" size={14} />} Create zone
        </button>
      </DialogFooter>
    </Dialog>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  )
}
