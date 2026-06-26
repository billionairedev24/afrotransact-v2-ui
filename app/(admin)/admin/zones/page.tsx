"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
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

function buildTree(zones: ServiceZone[]): ZoneNode[] {
  const byId = new Map<string, ZoneNode>()
  zones.forEach((z) => byId.set(z.id, { ...z, children: [], depth: 0 }))
  const roots: ZoneNode[] = []
  byId.forEach((node) => {
    if (node.parentZoneId && byId.has(node.parentZoneId)) {
      const parent = byId.get(node.parentZoneId)!
      parent.children.push(node)
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
  const [featuresByZone, setFeaturesByZone] = useState<Record<string, ZoneFeature[]>>({})
  const [showInherited, setShowInherited] = useState<Set<string>>(new Set())
  const [addChildOf, setAddChildOf] = useState<ServiceZone | null>(null)
  const [showRootModal, setShowRootModal] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const fetched = await listAdminZones(token)
      setZones(fetched)
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

  const byId = useMemo(() => {
    const m = new Map<string, ServiceZone>()
    zones.forEach((z) => m.set(z.id, z))
    return m
  }, [zones])

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
      // Revert
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
      if (next.has(zoneId)) {
        next.delete(zoneId)
      } else {
        next.add(zoneId)
        if (!featuresByZone[zoneId]) void loadFeatures(zoneId)
      }
      return next
    })
  }

  async function setFeatureEnabled(zoneId: string, key: string, enabled: boolean) {
    setFeaturesByZone((prev) => ({
      ...prev,
      [zoneId]: (prev[zoneId] ?? []).map((f) => (f.featureKey === key ? { ...f, enabled } : f)),
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

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Service Zones</h1>
          <p className="text-sm text-muted-foreground">
            Hierarchical rollout tree. Most-specific zone wins; feature flags inherit from parents.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRootModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={16} /> Add root zone
        </button>
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={16} /> Loading zones…
        </div>
      )}

      {!loading && flat.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No zones yet. Add a root (e.g. <code className="font-mono">USA</code>) to begin.
        </div>
      )}

      {!loading && flat.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {flat.map((node) => {
              const hasChildren = node.children.length > 0
              const isOpen = expanded.has(node.id)
              const featPanelOpen = featuresOpen.has(node.id)
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
                        {node.postalPattern ? ` · postal ${node.postalPattern}` : ""}
                      </span>
                    </div>
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
                      onClick={() => toggleFeaturesPanel(node.id)}
                      className="rounded-lg border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      {featPanelOpen ? "Hide features" : "Features"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddChildOf(node)}
                      className="rounded-lg border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      <Plus size={12} className="inline" /> Child
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(node)}
                      className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {featPanelOpen && (
                    <FeaturesPanel
                      zone={node}
                      features={featuresByZone[node.id] ?? []}
                      ancestors={ancestorsOf(node.id)}
                      featuresByZone={featuresByZone}
                      showInherited={showInherited.has(node.id)}
                      onToggleInherited={() =>
                        setShowInherited((prev) => {
                          const next = new Set(prev)
                          if (next.has(node.id)) next.delete(node.id)
                          else {
                            next.add(node.id)
                            ancestorsOf(node.id).forEach((a) => {
                              if (!featuresByZone[a.id]) void loadFeatures(a.id)
                            })
                          }
                          return next
                        })
                      }
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
        <ZoneModal
          parent={addChildOf}
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

function FeaturesPanel({
  zone,
  features,
  ancestors,
  featuresByZone,
  showInherited,
  onToggleInherited,
  onSetEnabled,
  onAdd,
}: {
  zone: ServiceZone
  features: ZoneFeature[]
  ancestors: ServiceZone[]
  featuresByZone: Record<string, ZoneFeature[]>
  showInherited: boolean
  onToggleInherited: () => void
  onSetEnabled: (key: string, enabled: boolean) => void
  onAdd: (key: string) => void
}) {
  const [newKey, setNewKey] = useState("")

  // Walk ancestors root→down to compute the inherited base (excluding zone's own).
  const inheritedRows = useMemo(() => {
    const map = new Map<string, { value: boolean; source: ServiceZone }>()
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const a = ancestors[i]
      const list = featuresByZone[a.id] ?? []
      list.forEach((f) => map.set(f.featureKey, { value: f.enabled, source: a }))
    }
    // Skip keys this zone overrides.
    const ownKeys = new Set(features.map((f) => f.featureKey))
    return Array.from(map.entries())
      .filter(([k]) => !ownKeys.has(k))
      .map(([k, v]) => ({ key: k, ...v }))
  }, [ancestors, featuresByZone, features])

  return (
    <div className="border-t border-border bg-muted/30 px-6 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Features on this zone
        </div>
        <button
          type="button"
          onClick={onToggleInherited}
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          {showInherited ? "Hide inherited" : "Show inherited"}
        </button>
      </div>
      {features.length === 0 && (
        <div className="mb-3 text-xs text-muted-foreground">
          No features defined directly on {zone.displayName}.
        </div>
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
      {showInherited && inheritedRows.length > 0 && (
        <div className="mb-3 rounded-md border border-dashed border-border bg-background/60 p-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Inherited (read-only)</div>
          <ul className="space-y-1">
            {inheritedRows.map((r) => (
              <li key={r.key} className="flex items-center justify-between text-xs text-muted-foreground">
                <code className="font-mono">{r.key}</code>
                <span>
                  {r.value ? "enabled" : "disabled"} via {r.source.displayName}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
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

function ZoneModal({
  parent,
  onClose,
  onCreate,
}: {
  parent: ServiceZone | null
  onClose: () => void
  onCreate: (input: ZoneInput) => void | Promise<void>
}) {
  const [code, setCode] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [countryCode, setCountryCode] = useState(parent?.countryCode ?? "US")
  const [subdivisionCode, setSubdivisionCode] = useState(parent?.subdivisionCode ?? "")
  const [postalPattern, setPostalPattern] = useState("")
  const [saving, setSaving] = useState(false)

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader>{parent ? `Add child zone under ${parent.displayName}` : "Add root zone"}</DialogHeader>
      <DialogBody>
        <div className="space-y-3">
          <Field label="Display name" required>
            <input
              className={INPUT_CLASS}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Austin"
            />
          </Field>
          <Field label="Code (unique)" required>
            <input
              className={INPUT_CLASS + " font-mono"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="USA-TX-Austin"
            />
          </Field>
          <Field label="Country code (ISO 3166-1 alpha-2)" required>
            <input
              className={INPUT_CLASS + " font-mono"}
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
              maxLength={2}
            />
          </Field>
          <Field label="Subdivision code (optional)">
            <input
              className={INPUT_CLASS + " font-mono"}
              value={subdivisionCode}
              onChange={(e) => setSubdivisionCode(e.target.value.toUpperCase())}
              placeholder="TX"
            />
          </Field>
          <Field label="Postal pattern (optional, glob)">
            <input
              className={INPUT_CLASS + " font-mono"}
              value={postalPattern}
              onChange={(e) => setPostalPattern(e.target.value)}
              placeholder="787*"
            />
          </Field>
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
          disabled={saving || !code || !displayName || !countryCode}
          onClick={async () => {
            setSaving(true)
            try {
              await onCreate({
                parent_zone_id: parent?.id ?? null,
                code: code.trim(),
                display_name: displayName.trim(),
                country_code: countryCode.trim().toUpperCase(),
                subdivision_code: subdivisionCode.trim() ? subdivisionCode.trim().toUpperCase() : null,
                postal_pattern: postalPattern.trim() ? postalPattern.trim() : null,
                status: "disabled",
              })
            } finally {
              setSaving(false)
            }
          }}
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
