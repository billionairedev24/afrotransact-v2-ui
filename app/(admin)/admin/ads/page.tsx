"use client"

import { useState } from "react"
import {
  Eye,
  EyeOff,
  Megaphone,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react"
import { useAdsStore } from "@/stores/useAdsStore"
import type { AdConfig, AdType } from "@/lib/ads"

const TYPE_OPTIONS: AdType[] = ["banner", "strip", "card"]

const GRADIENT_PRESETS = [
  { label: "Emerald",   value: "from-emerald-950 via-emerald-900/60 to-transparent" },
  { label: "Amber/Gold",value: "from-primary/20 via-primary/10 to-transparent"      },
  { label: "Violet",    value: "from-violet-950 to-violet-900/40"                   },
  { label: "Sky",       value: "from-sky-950 via-sky-900/60 to-transparent"         },
  { label: "Orange",    value: "from-orange-950 via-orange-900/60 to-transparent"   },
  { label: "Red",       value: "from-red-950 via-red-900/60 to-transparent"         },
]

const ACCENT_PRESETS = [
  { label: "Gold (primary)", value: "text-primary"     },
  { label: "Emerald",        value: "text-emerald-400" },
  { label: "Violet",         value: "text-violet-300"  },
  { label: "Sky",            value: "text-sky-400"     },
  { label: "Orange",         value: "text-orange-400"  },
  { label: "White",          value: "text-white"       },
]

const BLANK_AD: Omit<AdConfig, "createdAt" | "updatedAt"> = {
  id:          "",
  type:        "banner",
  enabled:     true,
  title:       "",
  body:        "",
  ctaLabel:    "",
  ctaHref:     "",
  badgeText:   "",
  sponsor:     "",
  gradient:    GRADIENT_PRESETS[0].value,
  accentColor: ACCENT_PRESETS[0].value,
  dismissible: true,
}

// ── Modal ────────────────────────────────────────────────────────────────────

function AdModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Partial<AdConfig>
  onClose: () => void
  onSave: (ad: AdConfig) => void
}) {
  const [form, setForm] = useState({ ...BLANK_AD, ...initial })
  const isEdit = !!initial.id

  function field(
    label: string,
    key: keyof typeof form,
    props: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <input
          value={String(form[key] ?? "")}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors"
          {...props}
        />
      </div>
    )
  }

  function select(label: string, key: keyof typeof form, options: { label: string; value: string }[]) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <select
          value={String(form[key])}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-primary/60 transition-colors"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    )
  }

  function handleSave() {
    if (!form.id.trim() || !form.title.trim()) return
    onSave({
      ...form,
      createdAt: (initial as AdConfig).createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative rounded-2xl border border-gray-200 w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4 bg-white"
      >
        <div className="flex items-center justify-between sticky top-0 pb-2 bg-white">
          <h3 className="text-lg font-bold text-gray-900">{isEdit ? "Edit Ad" : "New Ad"}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Slot ID */}
        {field("Slot ID (must match <AdSlot slotId=\"…\" /> in code)", "id", {
          placeholder: "e.g. mid-page-1",
          disabled: isEdit,
          className: isEdit
            ? "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 outline-none cursor-not-allowed"
            : undefined,
        })}

        <div className="grid grid-cols-2 gap-3">
          {select("Type", "type", TYPE_OPTIONS.map((t) => ({ label: t, value: t })))}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Enabled</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, enabled: !form.enabled })}
                className={`w-full flex items-center justify-center gap-2 h-[42px] rounded-xl border text-sm font-medium transition-colors ${
                  form.enabled
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-gray-200 bg-gray-50 text-gray-500"
                }`}
              >
                {form.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {form.enabled ? "Visible" : "Hidden"}
              </button>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Dismissible</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, dismissible: !form.dismissible })}
                className={`w-full flex items-center justify-center gap-2 h-[42px] rounded-xl border text-sm font-medium transition-colors ${
                  form.dismissible
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-gray-200 bg-gray-50 text-gray-500"
                }`}
              >
                {form.dismissible ? "Yes" : "No"}
              </button>
            </div>
          </div>
        </div>

        {field("Title *", "title", { placeholder: "Main headline of the ad" })}
        {field("Body text (optional)", "body", { placeholder: "Supporting copy" })}

        <div className="grid grid-cols-2 gap-3">
          {field("CTA label", "ctaLabel", { placeholder: "e.g. Shop Now" })}
          {field("CTA link", "ctaHref", { placeholder: "/search" })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("Badge text", "badgeText", { placeholder: "e.g. Sponsored" })}
          {field("Sponsor name", "sponsor", { placeholder: "e.g. AfroTransact" })}
        </div>

        {select("Background gradient", "gradient", GRADIENT_PRESETS)}
        {select("Accent color", "accentColor", ACCENT_PRESETS)}

        {/* Preview strip */}
        <div>
          <p className="text-xs text-gray-500 mb-2">Preview</p>
          <div
            className={`rounded-xl border border-gray-200 px-4 py-3 bg-gradient-to-r ${form.gradient}`}
          >
            {form.badgeText && (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 border border-gray-300 rounded px-1.5 py-0.5 mr-2">
                {form.badgeText}
              </span>
            )}
            <p className={`text-sm font-bold ${form.accentColor} inline`}>{form.title || "Ad title preview"}</p>
            {form.body && <p className="text-xs text-gray-500 mt-0.5">{form.body}</p>}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.id.trim() || !form.title.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-header hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {isEdit ? "Save Changes" : "Create Ad"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAdsPage() {
  const { ads, upsertAd, deleteAd, toggleAd } = useAdsStore()
  const [modalAd, setModalAd] = useState<Partial<AdConfig> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Ad Slots
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage promotional banners and strips across the marketplace.
            Changes take effect immediately — no deploy needed.
          </p>
        </div>
        <button
          onClick={() => setModalAd({})}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-header hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Ad
        </button>
      </div>

      {ads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <Megaphone className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No ads configured yet.</p>
          <button onClick={() => setModalAd({})} className="mt-4 text-sm font-semibold text-primary hover:text-primary/80">
            + Create your first ad
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <div
              key={ad.id}
              className={`rounded-2xl border transition-colors ${
                ad.enabled ? "border-gray-200 bg-gray-50" : "border-gray-100 bg-gray-50 opacity-50"
              }`}
            >
              {/* Preview strip */}
              <div className={`rounded-t-2xl px-4 py-2.5 bg-gradient-to-r ${ad.gradient} flex items-center gap-2`}>
                {ad.badgeText && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 border border-gray-300 rounded px-1.5 py-0.5">
                    {ad.badgeText}
                  </span>
                )}
                <p className={`text-sm font-bold truncate ${ad.accentColor}`}>{ad.title}</p>
                <span className="ml-auto text-[10px] text-gray-400 shrink-0 capitalize">{ad.type}</span>
              </div>

              {/* Controls */}
              <div className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-mono">slotId: <span className="text-gray-900">{ad.id}</span></p>
                  {ad.body && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{ad.body}</p>}
                  <p className="text-[10px] text-gray-600 mt-1">
                    Updated {new Date(ad.updatedAt).toLocaleDateString()}
                    {ad.dismissible && " · Dismissible"}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleAd(ad.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                      ad.enabled
                        ? "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    }`}
                  >
                    {ad.enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {ad.enabled ? "Disable" : "Enable"}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => setModalAd(ad)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>

                  {/* Delete */}
                  {confirmDelete === ad.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600">Delete?</span>
                      <button onClick={() => { deleteAd(ad.id); setConfirmDelete(null) }} className="text-xs font-bold text-red-600 hover:text-red-700">Yes</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 hover:text-gray-900">No</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(ad.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/15 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-xs text-gray-500 space-y-1 bg-gray-50">
        <p className="font-semibold text-gray-500">How ad slots work</p>
        <p>Each ad has a <span className="font-mono text-gray-900/60">slotId</span> that must match the <span className="font-mono text-gray-900/60">&lt;AdSlot slotId=&quot;…&quot; /&gt;</span> placement in the page code.</p>
        <p>Current placement IDs in use: <span className="font-mono text-gray-900/60">mid-page-1</span>, <span className="font-mono text-gray-900/60">mid-page-2</span>, <span className="font-mono text-gray-900/60">bottom-strip</span>.</p>
        <p>Disabling an ad hides it immediately. Deleting removes it permanently from this admin (the slot in the page renders nothing).</p>
      </div>

      {/* Modal */}
      {modalAd !== null && (
        <AdModal
          initial={modalAd}
          onClose={() => setModalAd(null)}
          onSave={(ad) => upsertAd(ad)}
        />
      )}
    </div>
  )
}
