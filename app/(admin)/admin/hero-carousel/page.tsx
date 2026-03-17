"use client"

import { useMemo, useState } from "react"
import { Eye, EyeOff, MoveDown, MoveUp, Plus, Save, Trash2, X } from "lucide-react"
import { HeroCarousel } from "@/components/home/HeroCarousel"
import { useHeroCarouselStore, type HeroCarouselSlideConfig } from "@/stores/useHeroCarouselStore"

const BLANK: HeroCarouselSlideConfig = {
  id: "",
  enabled: true,
  order: 0,
  badgeText: "",
  badgeColor: "border-primary/30 bg-primary/10 text-primary",
  headline: "",
  subtext: "",
  primaryCtaLabel: "",
  primaryCtaHref: "",
  secondaryCtaLabel: "",
  secondaryCtaHref: "",
  bg: "from-emerald-50 via-white to-white",
  accentBlobs: "",
  mediaType: "none",
  mediaUrl: "",
  mediaOverlay: "rgba(255,255,255,0.35)",
}

function SlideModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Partial<HeroCarouselSlideConfig>
  onClose: () => void
  onSave: (slide: HeroCarouselSlideConfig) => void
}) {
  const [form, setForm] = useState<HeroCarouselSlideConfig>({ ...BLANK, ...initial } as HeroCarouselSlideConfig)
  const isEdit = !!initial.id

  const field = (label: string, key: keyof HeroCarouselSlideConfig, placeholder = "") => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        value={String(form[key] ?? "")}
        onChange={(e) => setForm({ ...form, [key]: e.target.value } as HeroCarouselSlideConfig)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors"
      />
    </div>
  )

  const textarea = (label: string, key: keyof HeroCarouselSlideConfig, placeholder = "") => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <textarea
        value={String(form[key] ?? "")}
        onChange={(e) => setForm({ ...form, [key]: e.target.value } as HeroCarouselSlideConfig)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors resize-none"
      />
      <p className="mt-1 text-[11px] text-gray-400">Tip: use line breaks to control layout.</p>
    </div>
  )

  function handleSave() {
    if (!form.id.trim() || !form.headline.trim() || !form.primaryCtaLabel.trim() || !form.primaryCtaHref.trim()) return
    onSave({
      ...form,
      id: form.id.trim(),
      badgeText: form.badgeText?.trim() || undefined,
      badgeColor: form.badgeColor?.trim() || undefined,
      accentBlobs: form.accentBlobs?.trim() || undefined,
      mediaUrl: form.mediaUrl?.trim() || undefined,
      mediaOverlay: form.mediaOverlay?.trim() || undefined,
      secondaryCtaLabel: form.secondaryCtaLabel?.trim() || undefined,
      secondaryCtaHref: form.secondaryCtaHref?.trim() || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative rounded-2xl border border-gray-200 bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between sticky top-0 pb-2 bg-white">
          <h3 className="text-lg font-bold text-gray-900">{isEdit ? "Edit Slide" : "New Slide"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {field("Slide ID (unique)", "id", "e.g. spring-sale")}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Enabled</label>
            <button
              type="button"
              onClick={() => setForm({ ...form, enabled: !form.enabled })}
              className={`w-full flex items-center justify-center gap-2 h-[42px] rounded-xl border text-sm font-medium transition-colors ${
                form.enabled
                  ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-gray-50 text-gray-500"
              }`}
            >
              {form.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {form.enabled ? "Visible" : "Hidden"}
            </button>
          </div>
          {field("Order", "order", "0")}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {field("Badge text (optional)", "badgeText", "e.g. New · Limited")}
          {field("Badge style (tailwind classes)", "badgeColor", "border-primary/30 bg-primary/10 text-primary")}
        </div>

        {textarea("Headline *", "headline", "Big headline. Use line breaks.")}
        {textarea("Subtext", "subtext", "Supporting copy. Use line breaks.")}

        <div className="grid grid-cols-2 gap-3">
          {field("Primary CTA label *", "primaryCtaLabel", "Shop now")}
          {field("Primary CTA href *", "primaryCtaHref", "/search")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("Secondary CTA label", "secondaryCtaLabel", "Browse stores")}
          {field("Secondary CTA href", "secondaryCtaHref", "/stores")}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {field("BG gradient (tailwind)", "bg", "from-emerald-50 via-white to-white")}
          {field("Accent blobs (CSS background)", "accentBlobs", "radial-gradient(...)")}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Media type</label>
            <select
              value={form.mediaType || "none"}
              onChange={(e) => setForm({ ...form, mediaType: e.target.value as any })}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-primary/60 transition-colors"
            >
              <option value="none">None</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
          {field("Media URL", "mediaUrl", "https://...")}
        </div>
        {field("Media overlay (CSS color)", "mediaOverlay", "rgba(255,255,255,0.35)")}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.id.trim() || !form.headline.trim() || !form.primaryCtaLabel.trim() || !form.primaryCtaHref.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-header hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {isEdit ? "Save Changes" : "Create Slide"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminHeroCarouselPage() {
  const { slides, upsertSlide, deleteSlide, toggleSlide, moveSlide } = useHeroCarouselStore()
  const [modal, setModal] = useState<Partial<HeroCarouselSlideConfig> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const ordered = useMemo(() => [...slides].sort((a, b) => a.order - b.order), [slides])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hero Carousel</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage the home page hero carousel slides (banners, colors, images/videos). Changes take effect immediately.
          </p>
        </div>
        <button
          onClick={() => setModal({ order: ordered.length })}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-header hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Slide
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <HeroCarousel />
      </div>

      <div className="space-y-3">
        {ordered.map((s) => (
          <div key={s.id} className={`rounded-2xl border ${s.enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
            <div className="p-4 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-500">{s.id}</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-400">order {s.order}</span>
                </div>
                <p className="mt-1 font-semibold text-gray-900 truncate">{s.headline}</p>
                <p className="text-sm text-gray-500 truncate">{s.subtext}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => moveSlide(s.id, "up")}
                  className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50"
                  aria-label="Move up"
                >
                  <MoveUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => moveSlide(s.id, "down")}
                  className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50"
                  aria-label="Move down"
                >
                  <MoveDown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleSlide(s.id)}
                  className={`h-9 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                    s.enabled ? "border-emerald-500/30 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                >
                  {s.enabled ? "Visible" : "Hidden"}
                </button>
                <button
                  onClick={() => setModal(s)}
                  className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDelete(s.id)}
                  className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-red-600 hover:bg-red-50"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {confirmDelete === s.id && (
              <div className="px-4 pb-4 flex items-center justify-between gap-3">
                <p className="text-sm text-gray-600">Delete slide <span className="font-mono">{s.id}</span>?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(null)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    onClick={() => { deleteSlide(s.id); setConfirmDelete(null) }}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <SlideModal
          initial={modal}
          onClose={() => setModal(null)}
          onSave={(slide) => upsertSlide(slide)}
        />
      )}
    </div>
  )
}

