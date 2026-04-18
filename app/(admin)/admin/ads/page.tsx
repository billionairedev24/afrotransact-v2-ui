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
  ArrowRight,
  Zap,
  LayoutTemplate,
  Minus,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { useAdsStore } from "@/stores/useAdsStore"
import { upsertAdminAd, deleteAdminAd } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-helpers"
import type { AdConfig, AdType } from "@/lib/ads"

// ── helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(color: string, alpha = 1): string {
  if (!color.startsWith("#")) return color
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  return alpha === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`
}

const TYPE_OPTIONS: { value: AdType; label: string; desc: string }[] = [
  { value: "banner", label: "Banner", desc: "Full-width promotional card with headline, body & CTA" },
  { value: "strip",  label: "Strip",  desc: "Compact single-line bar — great for quick announcements" },
]

const BLANK_AD: Omit<AdConfig, "createdAt" | "updatedAt"> = {
  id:           "",
  type:         "banner",
  enabled:      true,
  title:        "",
  body:         "",
  ctaLabel:     "",
  ctaHref:      "",
  badgeText:    "",
  imageUrl:     "",
  bgColor:      "#064e3b",
  bgColorEnd:   "#022c22",
  titleColor:   "#6ee7b7",
  bodyColor:    "#a7f3d0",
  ctaBgColor:   "#10b981",
  ctaTextColor: "#022c22",
  dismissible:  true,
}

// ── Live Preview ─────────────────────────────────────────────────────────────

function AdPreview({ form }: { form: typeof BLANK_AD }) {
  const gradient = `linear-gradient(135deg, ${form.bgColor} 0%, ${form.bgColorEnd} 100%)`

  if (form.type === "strip") {
    return (
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: gradient, borderColor: hexToRgba(form.bgColorEnd, 0.4) }}
      >
        <div className="px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {form.badgeText && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ backgroundColor: hexToRgba(form.titleColor, 0.15), color: form.titleColor }}
              >
                {form.badgeText}
              </span>
            )}
            <span className="text-sm font-semibold" style={{ color: form.titleColor }}>
              {form.title || "Your strip headline here"}
            </span>
          </div>
          {form.ctaLabel && (
            <span className="text-sm font-bold underline" style={{ color: form.ctaBgColor || form.titleColor }}>
              {form.ctaLabel} →
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border overflow-hidden relative"
      style={{ background: gradient, borderColor: hexToRgba(form.bgColorEnd, 0.4) }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 10% 50%, ${hexToRgba(form.titleColor, 0.08)} 0%, transparent 60%)` }}
      />
      <div className="relative px-5 py-5 flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {form.badgeText && (
            <span
              className="shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: hexToRgba(form.titleColor, 0.15),
                color: form.titleColor,
                border: `1px solid ${hexToRgba(form.titleColor, 0.3)}`,
              }}
            >
              <Zap className="h-2.5 w-2.5" />
              {form.badgeText}
            </span>
          )}
          <div>
            <p className="text-base font-black leading-snug" style={{ color: form.titleColor }}>
              {form.title || "Your ad headline here"}
            </p>
            {form.body && (
              <p className="text-sm mt-1 opacity-80" style={{ color: form.bodyColor || form.titleColor }}>
                {form.body}
              </p>
            )}
          </div>
        </div>
        {form.ctaLabel && (
          <span
            className="shrink-0 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-lg"
            style={{
              backgroundColor: form.ctaBgColor,
              color: form.ctaTextColor,
              boxShadow: `0 4px 14px ${hexToRgba(form.ctaBgColor, 0.35)}`,
            }}
          >
            {form.ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </div>
  )
}

// ── Color Picker Row ─────────────────────────────────────────────────────────

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-10 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
          />
        </div>
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v)
          }}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 font-mono outline-none focus:border-primary/60 transition-colors"
          placeholder="#000000"
        />
        <div
          className="h-10 w-10 shrink-0 rounded-lg border border-gray-200"
          style={{ backgroundColor: value }}
        />
      </div>
    </div>
  )
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
  const [form, setForm] = useState<typeof BLANK_AD>({ ...BLANK_AD, ...initial })
  const [activeTab, setActiveTab] = useState<"content" | "colors">("content")
  const isEdit = !!initial.id

  function set(patch: Partial<typeof BLANK_AD>) {
    setForm((f) => ({ ...f, ...patch }))
  }

  function textField(label: string, key: keyof typeof form, placeholder = "", mono = false) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <input
          value={String(form[key] ?? "")}
          onChange={(e) => set({ [key]: e.target.value })}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-primary/60 transition-colors ${mono ? "font-mono" : ""}`}
        />
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
      <div className="relative rounded-2xl border border-gray-200 bg-white w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">{isEdit ? "Edit Ad" : "New Ad"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Type + toggle row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Ad Type</label>
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                {TYPE_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set({ type: t.value })}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                      form.type === t.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {TYPE_OPTIONS.find((t) => t.value === form.type)?.desc}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Visible</label>
                <button
                  type="button"
                  onClick={() => set({ enabled: !form.enabled })}
                  className={`w-full flex items-center justify-center gap-2 h-[42px] rounded-xl border text-sm font-medium transition-colors ${
                    form.enabled
                      ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-gray-50 text-gray-500"
                  }`}
                >
                  {form.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {form.enabled ? "On" : "Off"}
                </button>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Dismissible</label>
                <button
                  type="button"
                  onClick={() => set({ dismissible: !form.dismissible })}
                  className={`w-full flex items-center justify-center gap-2 h-[42px] rounded-xl border text-sm font-medium transition-colors ${
                    form.dismissible
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-gray-200 bg-gray-50 text-gray-500"
                  }`}
                >
                  {form.dismissible ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {form.dismissible ? "Yes" : "No"}
                </button>
              </div>
            </div>
          </div>

          {/* Slot ID */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Slot ID <span className="text-gray-400">(must match &lt;AdSlot slotId="…" /&gt; in code)</span>
            </label>
            <input
              value={form.id}
              onChange={(e) => !isEdit && set({ id: e.target.value })}
              disabled={isEdit}
              placeholder="e.g. mid-page-1"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm font-mono outline-none transition-colors ${
                isEdit
                  ? "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                  : "border-gray-200 bg-white text-gray-900 focus:border-primary/60"
              }`}
            />
          </div>

          {/* Tabs: Content / Colors */}
          <div>
            <div className="flex gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1 mb-4">
              {(["content", "colors"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${
                    activeTab === tab
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "content" ? "Content" : "Colors"}
                </button>
              ))}
            </div>

            {activeTab === "content" ? (
              <div className="space-y-4">
                {textField("Headline *", "title", "Main message of your ad")}
                {form.type === "banner" && textField("Body text", "body", "Supporting copy (optional)")}
                {textField("Badge label", "badgeText", "e.g. This Weekend Only")}
                <div className="grid grid-cols-2 gap-3">
                  {textField("CTA button label", "ctaLabel", "e.g. Shop Now")}
                  {textField("CTA link", "ctaHref", "/search")}
                </div>
                {form.type === "banner" && textField("Background image URL", "imageUrl", "https://… (optional overlay image)", true)}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ColorField label="Background (start)" value={form.bgColor} onChange={(v) => set({ bgColor: v })} />
                  <ColorField label="Background (end)" value={form.bgColorEnd} onChange={(v) => set({ bgColorEnd: v })} />
                  <ColorField label="Headline color" value={form.titleColor} onChange={(v) => set({ titleColor: v })} />
                  {form.type === "banner" && (
                    <ColorField label="Body text color" value={form.bodyColor || "#ffffff"} onChange={(v) => set({ bodyColor: v })} />
                  )}
                  <ColorField label="CTA button background" value={form.ctaBgColor} onChange={(v) => set({ ctaBgColor: v })} />
                  <ColorField label="CTA button text" value={form.ctaTextColor} onChange={(v) => set({ ctaTextColor: v })} />
                </div>
              </div>
            )}
          </div>

          {/* Live preview */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Live Preview</p>
            <AdPreview form={form} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.id.trim() || !form.title.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-header hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              {isEdit ? "Save Changes" : "Create Ad"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Ad Card (list item) ───────────────────────────────────────────────────────

function AdCard({
  ad,
  onEdit,
  onToggle,
  onDelete,
  saving,
}: {
  ad: AdConfig
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  saving?: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const gradient = `linear-gradient(135deg, ${ad.bgColor} 0%, ${ad.bgColorEnd} 100%)`

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all ${
        ad.enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-50"
      }`}
    >
      {/* Preview */}
      <div
        className="relative px-5 py-4 flex items-center gap-3 min-h-[64px]"
        style={{ background: gradient }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 5% 50%, ${hexToRgba(ad.titleColor, 0.1)} 0%, transparent 60%)`,
          }}
        />
        {ad.badgeText && (
          <span
            className="relative shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: hexToRgba(ad.titleColor, 0.15),
              color: ad.titleColor,
              border: `1px solid ${hexToRgba(ad.titleColor, 0.25)}`,
            }}
          >
            <Zap className="h-2 w-2" />
            {ad.badgeText}
          </span>
        )}
        <div className="relative min-w-0 flex-1">
          <p className="font-bold text-sm truncate" style={{ color: ad.titleColor }}>
            {ad.title}
          </p>
          {ad.body && (
            <p className="text-xs truncate opacity-70 mt-0.5" style={{ color: ad.bodyColor || ad.titleColor }}>
              {ad.body}
            </p>
          )}
        </div>
        {ad.ctaLabel && (
          <span
            className="relative shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{ backgroundColor: ad.ctaBgColor, color: ad.ctaTextColor }}
          >
            {ad.ctaLabel}
            <ArrowRight className="h-3 w-3" />
          </span>
        )}
        {/* Type badge */}
        <span
          className="absolute top-2 right-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest opacity-50"
          style={{ backgroundColor: hexToRgba(ad.titleColor, 0.15), color: ad.titleColor }}
        >
          {ad.type}
        </span>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">
            Slot: <span className="font-mono text-gray-800">{ad.id}</span>
            {ad.dismissible && <span className="ml-2 text-gray-400">· Dismissible</span>}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Updated {new Date(ad.updatedAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggle}
            disabled={saving}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors disabled:opacity-50 ${
              ad.enabled
                ? "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                : "border-emerald-500/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : ad.enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {ad.enabled ? "Disable" : "Enable"}
          </button>

          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">Delete?</span>
              <button
                onClick={() => { onDelete(); setConfirmDelete(false) }}
                className="text-xs font-bold text-red-600 hover:text-red-500"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500 hover:text-gray-900"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAdsPage() {
  const { ads, upsertAd, deleteAd, toggleAd, loadFromApi } = useAdsStore()
  const [modalAd, setModalAd] = useState<Partial<AdConfig> | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function handleSave(ad: AdConfig) {
    // Optimistic local update
    upsertAd(ad)
    setSavingId(ad.id)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      await upsertAdminAd(token, ad)
      toast.success(ad.id ? "Ad saved" : "Ad created")
    } catch {
      toast.error("Failed to save — changes kept locally")
    } finally {
      setSavingId(null)
    }
  }

  async function handleToggle(ad: AdConfig) {
    const updated = { ...ad, enabled: !ad.enabled, updatedAt: new Date().toISOString() }
    toggleAd(ad.id)
    setSavingId(ad.id)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      await upsertAdminAd(token, updated)
    } catch {
      // Revert optimistic toggle
      toggleAd(ad.id)
      toast.error("Failed to update visibility")
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(id: string) {
    deleteAd(id)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      await deleteAdminAd(token, id)
      toast.success("Ad deleted")
    } catch {
      // Reload from API to restore state
      await loadFromApi()
      toast.error("Failed to delete — refreshed from server")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Ad Slots
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage promotional banners and strips across the marketplace.
            Changes are live immediately — no deploy needed.
          </p>
        </div>
        <button
          onClick={() => setModalAd({})}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-header hover:bg-primary/90 transition-colors shrink-0 shadow-md shadow-primary/20"
        >
          <Plus className="h-4 w-4" />
          New Ad
        </button>
      </div>

      {ads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 border border-gray-200 mx-auto mb-4">
            <LayoutTemplate className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-gray-500 text-sm font-medium">No ads configured yet</p>
          <p className="text-gray-400 text-xs mt-1 mb-5">Create your first ad and it will appear on the marketplace immediately.</p>
          <button
            onClick={() => setModalAd({})}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-header hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Ad
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <AdCard
              key={ad.id}
              ad={ad}
              saving={savingId === ad.id}
              onEdit={() => setModalAd(ad)}
              onToggle={() => handleToggle(ad)}
              onDelete={() => handleDelete(ad.id)}
            />
          ))}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-xs text-gray-500 space-y-1.5">
        <p className="font-semibold text-gray-600">How ad slots work</p>
        <p>
          Each ad has a <span className="font-mono text-gray-700">Slot ID</span> that must match an{" "}
          <span className="font-mono text-gray-700">&lt;AdSlot slotId="…" /&gt;</span> placement in the page code.
        </p>
        <p>
          Active slot IDs:{" "}
          {["mid-page-1", "mid-page-2", "bottom-strip"].map((id) => (
            <span key={id} className="font-mono text-gray-700 mr-2">{id}</span>
          ))}
        </p>
        <p>Disabling hides the ad instantly. Deleting removes it permanently (the slot renders nothing).</p>
      </div>

      {modalAd !== null && (
        <AdModal
          initial={modalAd}
          onClose={() => setModalAd(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
