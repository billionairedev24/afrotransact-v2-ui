"use client"

import { useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, MoveDown, MoveUp, Plus, Save, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { logError } from "@/lib/errors"
import { HeroCarousel } from "@/components/home/HeroCarousel"
import { getAccessToken } from "@/lib/auth-helpers"
import { useUploadThing } from "@/lib/uploadthing"
import {
  getAdminHeroSlides,
  upsertAdminHeroSlide,
  deleteAdminHeroSlide,
  type HeroSlideUpsertRequest,
  type HeroSlideConfig as BackendHeroSlideConfig,
} from "@/lib/api"

type EditableHeroSlide = Omit<BackendHeroSlideConfig, "createdAt" | "updatedAt">

const BLANK: EditableHeroSlide = {
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

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}){1,2}$/

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace("#", "")
  if (![3, 6].includes(normalized.length)) return null
  const full = normalized.length === 3
    ? normalized.split("").map((c) => c + c).join("")
    : normalized
  const n = Number.parseInt(full, 16)
  if (Number.isNaN(n)) return null
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  }
}

function rgbaFromHex(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  const a = Math.max(0, Math.min(1, alpha))
  if (!rgb) return `rgba(255,255,255,${a.toFixed(2)})`
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a.toFixed(2)})`
}

function SlideModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Partial<EditableHeroSlide>
  onClose: () => void
  onSave: (slide: EditableHeroSlide) => void
}) {
  const [form, setForm] = useState<EditableHeroSlide>({ ...BLANK, ...initial } as EditableHeroSlide)
  const isEdit = !!initial.id
  const { startUpload, isUploading } = useUploadThing("heroMedia")
  const [bgFrom, setBgFrom] = useState("#ecfdf5")
  const [bgVia, setBgVia] = useState("#ffffff")
  const [bgTo, setBgTo] = useState("#ffffff")
  const [overlayHex, setOverlayHex] = useState("#ffffff")
  const [overlayOpacity, setOverlayOpacity] = useState(0.35)

  useEffect(() => {
    const raw = String(form.bg ?? "")
    const match = raw.match(/linear-gradient\([^,]+,\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/i)
    if (match) {
      const a = match[1].trim()
      const b = match[2].trim()
      const c = match[3].trim()
      if (HEX_COLOR.test(a)) setBgFrom(a)
      if (HEX_COLOR.test(b)) setBgVia(b)
      if (HEX_COLOR.test(c)) setBgTo(c)
    }
  }, [form.bg])

  useEffect(() => {
    const raw = String(form.mediaOverlay ?? "").trim()
    if (HEX_COLOR.test(raw)) {
      setOverlayHex(raw)
      setOverlayOpacity(1)
      return
    }
    const rgba = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9]*\.?[0-9]+))?\s*\)$/i)
    if (!rgba) return
    const r = Math.max(0, Math.min(255, Number(rgba[1])))
    const g = Math.max(0, Math.min(255, Number(rgba[2])))
    const b = Math.max(0, Math.min(255, Number(rgba[3])))
    const a = rgba[4] == null ? 1 : Math.max(0, Math.min(1, Number(rgba[4])))
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase()
    setOverlayHex(hex)
    setOverlayOpacity(a)
  }, [form.mediaOverlay])

  const field = (label: string, key: keyof EditableHeroSlide, placeholder = "") => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        value={String(form[key] ?? "")}
        onChange={(e) => setForm({ ...form, [key]: e.target.value } as EditableHeroSlide)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors"
      />
    </div>
  )

  const textarea = (label: string, key: keyof EditableHeroSlide, placeholder = "") => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <textarea
        value={String(form[key] ?? "")}
        onChange={(e) => setForm({ ...form, [key]: e.target.value } as EditableHeroSlide)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors resize-none"
      />
      <p className="mt-1 text-[11px] text-gray-400">Tip: use line breaks to control layout.</p>
    </div>
  )

  async function handleMediaUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    try {
      const uploaded = await startUpload(Array.from(files))
      const url = uploaded?.[0]?.ufsUrl || uploaded?.[0]?.url
      if (!url) {
        toast.error("Upload finished but no file URL was returned")
        return
      }
      const mediaType = uploaded?.[0]?.type?.startsWith("video/") ? "video" : "image"
      setForm((prev) => ({ ...prev, mediaUrl: url, mediaType }))
      toast.success("Media uploaded")
    } catch {
      toast.error("Failed to upload media")
    }
  }

  function handleSave() {
    if (!form.id.trim() || !form.headline.trim() || !form.primaryCtaLabel.trim() || !form.primaryCtaHref.trim()) return
    onSave({
      ...form,
      bg: `linear-gradient(135deg, ${bgFrom}, ${bgVia}, ${bgTo})`,
      id: form.id.trim(),
      badgeText: form.badgeText?.trim() || undefined,
      badgeColor: form.badgeColor?.trim() || undefined,
      accentBlobs: form.accentBlobs?.trim() || undefined,
      mediaUrl: form.mediaUrl?.trim() || undefined,
      mediaOverlay: rgbaFromHex(overlayHex, overlayOpacity),
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Badge color (hex)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={HEX_COLOR.test(String(form.badgeColor ?? "")) ? String(form.badgeColor) : "#d4a853"}
                onChange={(e) => setForm({ ...form, badgeColor: e.target.value } as EditableHeroSlide)}
                className="h-[42px] w-14 rounded-lg border border-gray-200 bg-white p-1"
              />
              <input
                value={String(form.badgeColor ?? "")}
                onChange={(e) => setForm({ ...form, badgeColor: e.target.value } as EditableHeroSlide)}
                placeholder="#D4A853"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors"
              />
            </div>
          </div>
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

        <div className="space-y-2">
          <label className="block text-xs text-gray-500">Background gradient colors (hex)</label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="mb-1 text-[11px] text-gray-500">Start</p>
              <input type="color" value={bgFrom} onChange={(e) => setBgFrom(e.target.value)} className="h-[42px] w-full rounded-xl border border-gray-200 bg-white p-1" />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-gray-500">Middle</p>
              <input type="color" value={bgVia} onChange={(e) => setBgVia(e.target.value)} className="h-[42px] w-full rounded-xl border border-gray-200 bg-white p-1" />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-gray-500">End</p>
              <input type="color" value={bgTo} onChange={(e) => setBgTo(e.target.value)} className="h-[42px] w-full rounded-xl border border-gray-200 bg-white p-1" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">Stored as CSS gradient string in DB.</p>
        </div>
        {field("Accent blobs (CSS background)", "accentBlobs", "radial-gradient(...)")}

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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Media upload (UploadThing)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
              onChange={(e) => handleMediaUpload(e.target.files)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
              disabled={isUploading}
            />
            <p className="mt-1 text-[11px] text-gray-400">{isUploading ? "Uploading..." : "Upload sets media URL automatically."}</p>
          </div>
        </div>
        {field("Media URL", "mediaUrl", "https://... (auto-populated from upload)")}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Media overlay (hex)</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={overlayHex}
              onChange={(e) => {
                const hex = e.target.value
                setOverlayHex(hex)
                setForm({ ...form, mediaOverlay: rgbaFromHex(hex, overlayOpacity) } as EditableHeroSlide)
              }}
              className="h-[42px] w-14 rounded-lg border border-gray-200 bg-white p-1"
            />
            <input
              value={overlayHex}
              onChange={(e) => {
                const hex = e.target.value
                setOverlayHex(hex)
                if (HEX_COLOR.test(hex.trim())) {
                  setForm({ ...form, mediaOverlay: rgbaFromHex(hex.trim(), overlayOpacity) } as EditableHeroSlide)
                } else {
                  setForm({ ...form, mediaOverlay: hex } as EditableHeroSlide)
                }
              }}
              placeholder="#FFFFFF"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
              <span>Overlay opacity</span>
              <span>{Math.round(overlayOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(overlayOpacity * 100)}
              onChange={(e) => {
                const pct = Number(e.target.value)
                const alpha = Math.max(0, Math.min(1, pct / 100))
                setOverlayOpacity(alpha)
                setForm({ ...form, mediaOverlay: rgbaFromHex(overlayHex, alpha) } as EditableHeroSlide)
              }}
              className="w-full accent-primary"
            />
            <p className="mt-1 text-[11px] text-gray-400 font-mono">{rgbaFromHex(overlayHex, overlayOpacity)}</p>
          </div>
        </div>

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
  const [slides, setSlides] = useState<EditableHeroSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Partial<EditableHeroSlide> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Load from backend
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const data = await getAdminHeroSlides(token)
        if (!cancelled)
          setSlides(
            data.map(({ createdAt, updatedAt, ...rest }) => rest)
          )
      } catch (e) {
        logError(e, "loading hero slides")
        if (!cancelled) {
          toast.error("Failed to load hero slides")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function refresh() {
    try {
      const token = await getAccessToken()
      if (!token) return
      const data = await getAdminHeroSlides(token)
      setSlides(
        data.map(({ createdAt, updatedAt, ...rest }) => rest)
      )
    } catch {
      toast.error("Failed to refresh hero slides")
    }
  }

  async function persistSlide(s: EditableHeroSlide) {
    const token = await getAccessToken()
    if (!token) return
    const body: HeroSlideUpsertRequest = {
      id: s.id,
      enabled: s.enabled,
      order: s.order,
      badgeText: s.badgeText ?? null,
      badgeColor: s.badgeColor ?? null,
      headline: s.headline,
      subtext: s.subtext,
      primaryCtaLabel: s.primaryCtaLabel,
      primaryCtaHref: s.primaryCtaHref,
      secondaryCtaLabel: s.secondaryCtaLabel ?? null,
      secondaryCtaHref: s.secondaryCtaHref ?? null,
      bg: s.bg,
      accentBlobs: s.accentBlobs ?? null,
      mediaType: s.mediaType ?? "none",
      mediaUrl: s.mediaUrl ?? null,
      mediaOverlay: s.mediaOverlay ?? null,
    }
    await upsertAdminHeroSlide(token, body)
  }

  const ordered = useMemo(() => [...slides].sort((a, b) => a.order - b.order), [slides])
  const previewSlides = useMemo(
    () =>
      ordered
        .filter((s) => s.enabled)
        .map((s, idx) => ({
          id: s.id,
          type: "promo" as const,
          badge: s.badgeText
            ? {
                icon: idx % 3 === 0 ? <Eye className="h-3 w-3" /> : idx % 3 === 1 ? <EyeOff className="h-3 w-3" /> : undefined,
                text: s.badgeText,
                color: s.badgeColor || "border-primary/30 bg-primary/10 text-primary",
              }
            : undefined,
          headline: s.headline.split(/\r?\n|\\n/g).map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          )),
          subtext: s.subtext.split(/\r?\n|\\n/g).map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          )),
          stats: undefined,
          ctas: [
            {
              label: s.primaryCtaLabel,
              href: s.primaryCtaHref,
              primary: true,
            },
            ...(s.secondaryCtaLabel && s.secondaryCtaHref
              ? [
                  {
                    label: s.secondaryCtaLabel,
                    href: s.secondaryCtaHref,
                    primary: false as const,
                  },
                ]
              : []),
          ],
          bg: s.bg,
          accentBlobs: s.accentBlobs ?? undefined,
          media:
            s.mediaType && s.mediaType !== "none" && s.mediaUrl
              ? {
                  type: s.mediaType === "video" ? ("video" as const) : ("image" as const),
                  url: s.mediaUrl,
                  overlay: s.mediaOverlay ?? undefined,
                }
              : undefined,
        })),
    [ordered]
  )

  async function handleUpsert(slide: EditableHeroSlide) {
    try {
      await persistSlide(slide)
      toast.success("Hero slide saved")
      await refresh()
    } catch (e) {
      logError(e, "saving hero slide")
      toast.error("Failed to save hero slide")
    }
  }

  async function handleDelete(id: string) {
    try {
      const token = await getAccessToken()
      if (!token) return
      await deleteAdminHeroSlide(token, id)
      toast.success("Hero slide deleted")
      await refresh()
    } catch (e) {
      logError(e, "deleting hero slide")
      toast.error("Failed to delete hero slide")
    }
  }

  async function handleToggle(id: string) {
    const slide = slides.find((s) => s.id === id)
    if (!slide) return
    await handleUpsert({ ...slide, enabled: !slide.enabled })
  }

  async function handleMove(id: string, dir: "up" | "down") {
    const idx = ordered.findIndex((s) => s.id === id)
    if (idx < 0) return
    const swapWith = dir === "up" ? idx - 1 : idx + 1
    if (swapWith < 0 || swapWith >= ordered.length) return
    const a = ordered[idx]
    const b = ordered[swapWith]
    try {
      await Promise.all([
        persistSlide({ ...a, order: b.order }),
        persistSlide({ ...b, order: a.order }),
      ])
      await refresh()
    } catch (e) {
      logError(e, "reordering slides")
      toast.error("Failed to reorder slides")
    }
  }

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
        {loading ? (
          <div className="py-16 text-center text-gray-500 text-sm">Loading hero slides…</div>
        ) : previewSlides.length ? (
          <HeroCarousel slides={previewSlides} />
        ) : (
          <div className="py-16 text-center text-gray-500 text-sm">
            No enabled slides yet. Create one above to see the customer preview.
          </div>
        )}
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
                  onClick={() => handleMove(s.id, "up")}
                  className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50"
                  aria-label="Move up"
                >
                  <MoveUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleMove(s.id, "down")}
                  className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50"
                  aria-label="Move down"
                >
                  <MoveDown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleToggle(s.id)}
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
                    onClick={() => { handleDelete(s.id); setConfirmDelete(null) }}
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

      {modal && <SlideModal initial={modal} onClose={() => setModal(null)} onSave={handleUpsert} />}
    </div>
  )
}

