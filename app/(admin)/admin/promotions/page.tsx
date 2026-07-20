"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  Plus,
  Search,
  X,
  Upload,
  MoreVertical,
  Trash2,
  Copy,
  Pencil,
  MoveUp,
  MoveDown,
  CalendarClock,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Sheet } from "@/components/ui/Sheet"
import { useUploadThing } from "@/lib/uploadthing"
import { PromoSlot, type Promotion, type PromoPlacement } from "@/components/marketing/PromoSlot"

type PromoStatus = "live" | "scheduled" | "expired" | "draft"

const PLACEMENT_OPTIONS: { value: PromoPlacement; label: string; help: string }[] = [
  { value: "HERO", label: "Hero", help: "Big home page banner — primary marketing surface." },
  { value: "STRIP_TOP", label: "Top strip", help: "Slim banner above search results and category lists." },
  { value: "SIDEBAR", label: "Sidebar", help: "Vertical card on the product detail page." },
  { value: "FOOTER", label: "Footer", help: "Wide banner above the global footer." },
  { value: "POPUP", label: "Popup", help: "Auto-opening modal shown to shoppers within its schedule. Great for launches & limited-time offers." },
]

const PLACEMENT_LABEL: Record<PromoPlacement, string> = {
  HERO: "Hero",
  STRIP_TOP: "Top strip",
  SIDEBAR: "Sidebar",
  FOOTER: "Footer",
  POPUP: "Popup",
}

function classifyStatus(p: Promotion): PromoStatus {
  if (!p.active) return "draft"
  const now = Date.now()
  if (p.endsAt && new Date(p.endsAt).getTime() <= now) return "expired"
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return "scheduled"
  return "live"
}

function formatScheduleLine(p: Promotion): string {
  const status = classifyStatus(p)
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  switch (status) {
    case "live":
      return p.endsAt ? `Live · ends ${fmt(p.endsAt)}` : "Live now"
    case "scheduled":
      return p.startsAt ? `Starts ${fmt(p.startsAt)}` : "Scheduled"
    case "expired":
      return p.endsAt ? `Expired ${fmt(p.endsAt)}` : "Expired"
    case "draft":
      return "Draft"
  }
}

function statusChip(status: PromoStatus) {
  const cls: Record<PromoStatus, string> = {
    live: "bg-emerald-50 text-emerald-700 border-emerald-200",
    scheduled: "bg-blue-50 text-blue-700 border-blue-200",
    expired: "bg-gray-100 text-gray-500 border-gray-200",
    draft: "bg-amber-50 text-amber-700 border-amber-200",
  }
  const label: Record<PromoStatus, string> = {
    live: "Live",
    scheduled: "Scheduled",
    expired: "Expired",
    draft: "Draft",
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls[status]}`}
    >
      {label[status]}
    </span>
  )
}

function toLocalInput(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  // YYYY-MM-DDTHH:mm with local offset compensated
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

interface EditorState {
  id?: string
  title: string
  subtitle: string
  imageUrl: string
  ctaUrl: string
  ctaLabel: string
  placement: PromoPlacement
  startsAt: string
  endsAt: string
  active: boolean
}

const BLANK: EditorState = {
  title: "",
  subtitle: "",
  imageUrl: "",
  ctaUrl: "",
  ctaLabel: "",
  placement: "HERO",
  startsAt: "",
  endsAt: "",
  active: true,
}

function toEditor(p: Promotion): EditorState {
  return {
    id: p.id,
    title: p.title,
    subtitle: p.subtitle ?? "",
    imageUrl: p.imageUrl,
    ctaUrl: p.ctaUrl ?? "",
    ctaLabel: p.ctaLabel ?? "",
    placement: p.placement,
    startsAt: toLocalInput(p.startsAt),
    endsAt: toLocalInput(p.endsAt),
    active: p.active,
  }
}

function toPromotion(e: EditorState): Promotion {
  return {
    id: e.id ?? "preview",
    title: e.title || "Your promotion title",
    subtitle: e.subtitle || null,
    imageUrl: e.imageUrl,
    ctaUrl: e.ctaUrl || null,
    ctaLabel: e.ctaLabel || null,
    placement: e.placement,
    startsAt: fromLocalInput(e.startsAt),
    endsAt: fromLocalInput(e.endsAt),
    sortOrder: 0,
    active: e.active,
  }
}

export default function AdminPromotionsPage() {
  const [promos, setPromos] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [placementFilter, setPlacementFilter] = useState<PromoPlacement | "ALL">("ALL")
  const [statusFilter, setStatusFilter] = useState<PromoStatus | "ALL">("ALL")
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/promotions", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { promotions?: Promotion[] }
      setPromos(Array.isArray(data.promotions) ? data.promotions : [])
    } catch (err) {
      console.error(err)
      toast.error("Failed to load promotions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    return promos.filter((p) => {
      if (placementFilter !== "ALL" && p.placement !== placementFilter) return false
      if (statusFilter !== "ALL" && classifyStatus(p) !== statusFilter) return false
      return true
    })
  }, [promos, placementFilter, statusFilter])

  function openNew() {
    setEditor({ ...BLANK })
  }

  function openEdit(p: Promotion) {
    setEditor(toEditor(p))
  }

  function openDuplicate(p: Promotion) {
    const e = toEditor(p)
    delete e.id
    e.title = `${e.title} (copy)`
    setEditor(e)
  }

  async function handleSave(e: EditorState) {
    if (!e.title.trim() || !e.imageUrl.trim()) {
      toast.error("Title and image are required")
      return
    }
    const body = {
      title: e.title.trim(),
      subtitle: e.subtitle.trim() || null,
      imageUrl: e.imageUrl.trim(),
      ctaUrl: e.ctaUrl.trim() || null,
      ctaLabel: e.ctaLabel.trim() || null,
      placement: e.placement,
      startsAt: fromLocalInput(e.startsAt),
      endsAt: fromLocalInput(e.endsAt),
      active: e.active,
    }
    try {
      const url = e.id ? `/api/admin/promotions/${e.id}` : "/api/admin/promotions"
      const method = e.id ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(e.id ? "Promotion updated" : "Promotion created")
      setEditor(null)
      await load()
    } catch (err) {
      console.error(err)
      toast.error("Failed to save promotion")
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success("Promotion deleted")
      setConfirmDelete(null)
      await load()
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete promotion")
    }
  }

  async function toggleActive(p: Promotion) {
    try {
      const res = await fetch(`/api/admin/promotions/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !p.active }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (err) {
      console.error(err)
      toast.error("Failed to update promotion")
    }
  }

  async function move(p: Promotion, dir: "up" | "down") {
    const sameGroup = promos
      .filter((x) => x.placement === p.placement)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = sameGroup.findIndex((x) => x.id === p.id)
    if (idx < 0) return
    const swap = dir === "up" ? idx - 1 : idx + 1
    if (swap < 0 || swap >= sameGroup.length) return
    const reordered = [...sameGroup]
    ;[reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]]
    try {
      const res = await fetch(`/api/admin/promotions/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((x) => x.id) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (err) {
      console.error(err)
      toast.error("Failed to reorder")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
          <p className="text-gray-500 text-sm mt-1">
            Upload marketing flyers and banners. Changes appear across the storefront within a minute.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-xl bg-brand-gold px-4 py-2 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors shrink-0 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add promotion
        </button>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border border-input bg-white p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">Placement</label>
          <select
            value={placementFilter}
            onChange={(e) => setPlacementFilter(e.target.value as PromoPlacement | "ALL")}
            className="rounded-lg border border-input bg-white px-3 py-1.5 text-sm focus:border-primary/60 outline-none"
          >
            <option value="ALL">All</option>
            {PLACEMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PromoStatus | "ALL")}
            className="rounded-lg border border-input bg-white px-3 py-1.5 text-sm focus:border-primary/60 outline-none"
          >
            <option value="ALL">All</option>
            <option value="live">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <div className="ml-auto text-xs text-gray-400 flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5" /> {filtered.length} of {promos.length}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">Loading promotions…</div>
      ) : promos.length === 0 ? (
        <EmptyState onCreate={openNew} />
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-500 rounded-2xl border border-dashed border-input bg-white">
          No promotions match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <PromoCard
              key={p.id}
              promo={p}
              onEdit={() => openEdit(p)}
              onDuplicate={() => openDuplicate(p)}
              onDelete={() => setConfirmDelete(p.id)}
              onToggle={() => toggleActive(p)}
              onMoveUp={() => move(p, "up")}
              onMoveDown={() => move(p, "down")}
            />
          ))}
        </div>
      )}

      {/* Editor */}
      <PromoEditorSheet
        editor={editor}
        onChange={setEditor}
        onClose={() => setEditor(null)}
        onSave={(e) => handleSave(e)}
      />

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDelete(null)} />
          <div className="relative rounded-2xl bg-white p-6 max-w-sm w-full space-y-4 border border-input shadow-xl">
            <h3 className="font-bold text-gray-900">Delete this promotion?</h3>
            <p className="text-sm text-gray-500">This cannot be undone. The banner will disappear from the storefront immediately.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-input py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cards & empty state ─────────────────────────────────────────────────────

function PromoCard({
  promo,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  promo: Promotion
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = classifyStatus(promo)

  return (
    <div className="rounded-2xl border border-input bg-white overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative aspect-[16/9] bg-gray-100">
        {promo.imageUrl ? (
          <Image src={promo.imageUrl} alt={promo.title} fill sizes="(max-width:1024px) 100vw, 400px" className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-300">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          {statusChip(status)}
          <span className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/85 backdrop-blur px-2 py-0.5 text-[10px] font-semibold text-gray-700">
            {PLACEMENT_LABEL[promo.placement]}
          </span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{promo.title}</p>
            {promo.subtitle ? <p className="text-xs text-gray-500 truncate">{promo.subtitle}</p> : null}
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Open menu"
              className="h-8 w-8 rounded-lg border border-input bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-50 w-44 rounded-xl border border-input bg-white shadow-lg py-1 text-sm">
                  <button onClick={() => { setMenuOpen(false); onEdit() }} className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  <button onClick={() => { setMenuOpen(false); onDuplicate() }} className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
                  <button onClick={() => { setMenuOpen(false); onDelete() }} className="w-full px-3 py-2 text-left hover:bg-gray-50 text-red-600 flex items-center gap-2"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <CalendarClock className="h-3.5 w-3.5" />
          {formatScheduleLine(promo)}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <button onClick={onMoveUp} aria-label="Move up" className="h-7 w-7 rounded-lg border border-input bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50">
              <MoveUp className="h-3.5 w-3.5" />
            </button>
            <button onClick={onMoveDown} aria-label="Move down" className="h-7 w-7 rounded-lg border border-input bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50">
              <MoveDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={onToggle}
            aria-pressed={promo.active}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${promo.active ? "bg-brand-gold" : "bg-gray-200"}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${promo.active ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-input bg-white p-12 text-center">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-gold/10 flex items-center justify-center mb-4">
        <Sparkles className="h-8 w-8 text-brand-gold" />
      </div>
      <h2 className="text-lg font-bold text-gray-900">No promotions yet</h2>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
        Promotions show across the storefront — hero, search strip, product sidebar, footer. Upload your first flyer to get started.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-brand-gold px-4 py-2 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover transition-colors"
      >
        <Plus className="h-4 w-4" />
        Create your first promotion
      </button>
    </div>
  )
}

// ── Editor sheet ────────────────────────────────────────────────────────────

function PromoEditorSheet({
  editor,
  onChange,
  onClose,
  onSave,
}: {
  editor: EditorState | null
  onChange: (e: EditorState) => void
  onClose: () => void
  onSave: (e: EditorState) => void
}) {
  const open = !!editor
  const value = editor ?? BLANK
  const { startUpload, isUploading } = useUploadThing("heroMedia")

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !editor) return
    try {
      const uploaded = await startUpload(Array.from(files))
      const url = uploaded?.[0]?.ufsUrl || uploaded?.[0]?.url
      if (!url) {
        toast.error("Upload returned no URL")
        return
      }
      onChange({ ...editor, imageUrl: url })
      toast.success("Image uploaded")
    } catch {
      toast.error("Upload failed")
    }
  }

  const placementInfo = PLACEMENT_OPTIONS.find((o) => o.value === value.placement)
  const previewPromos: Promotion[] = value.imageUrl ? [toPromotion(value)] : []

  return (
    <Sheet open={open} onClose={onClose}>
      {editor && (
        <div className="flex flex-col h-full min-h-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">
              {editor.id ? "Edit promotion" : "New promotion"}
            </h2>
            <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Image upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Image</label>
              {editor.imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-input bg-gray-100 aspect-[16/9]">
                  <Image src={editor.imageUrl} alt="Preview" fill sizes="600px" className="object-cover" />
                  <button
                    type="button"
                    onClick={() => onChange({ ...editor, imageUrl: "" })}
                    className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 text-gray-700 hover:bg-white shadow"
                    aria-label="Remove image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="block relative rounded-xl border-2 border-dashed border-input bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleUpload(e.target.files)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  <div className="py-10 flex flex-col items-center justify-center gap-2 text-center">
                    <div className="h-10 w-10 rounded-full bg-white border border-input flex items-center justify-center text-gray-500">
                      <Upload className="h-5 w-5" />
                    </div>
                    <p className="text-sm text-gray-700 font-semibold">
                      {isUploading ? "Uploading…" : "Drop image or click to upload"}
                    </p>
                    <p className="text-[11px] text-gray-400">PNG, JPG, WebP · Use placement-recommended ratios for best results</p>
                  </div>
                </label>
              )}
            </div>

            <Field label="Title">
              <input
                value={editor.title}
                onChange={(e) => onChange({ ...editor, title: e.target.value })}
                placeholder="e.g. Summer Restock"
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary/60"
              />
            </Field>

            <Field label="Subtitle">
              <input
                value={editor.subtitle}
                onChange={(e) => onChange({ ...editor, subtitle: e.target.value })}
                placeholder="One-line supporting copy"
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary/60"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="CTA label">
                <input
                  value={editor.ctaLabel}
                  onChange={(e) => onChange({ ...editor, ctaLabel: e.target.value })}
                  placeholder="Shop now"
                  className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </Field>
              <Field label="CTA URL">
                <input
                  value={editor.ctaUrl}
                  onChange={(e) => onChange({ ...editor, ctaUrl: e.target.value })}
                  placeholder="/search?category=..."
                  className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </Field>
            </div>

            <Field label="Placement">
              <select
                value={editor.placement}
                onChange={(e) => onChange({ ...editor, placement: e.target.value as PromoPlacement })}
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary/60"
              >
                {PLACEMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {placementInfo ? (
                <p className="mt-1 text-[11px] text-gray-500">{placementInfo.help}</p>
              ) : null}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts at (optional)">
                <input
                  type="datetime-local"
                  value={editor.startsAt}
                  onChange={(e) => onChange({ ...editor, startsAt: e.target.value })}
                  className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </Field>
              <Field label="Ends at (optional)">
                <input
                  type="datetime-local"
                  value={editor.endsAt}
                  onChange={(e) => onChange({ ...editor, endsAt: e.target.value })}
                  className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-input bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Active</p>
                <p className="text-xs text-gray-500">Inactive promos are saved as drafts and not shown to shoppers.</p>
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...editor, active: !editor.active })}
                aria-pressed={editor.active}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editor.active ? "bg-brand-gold" : "bg-gray-300"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${editor.active ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {/* Live preview */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Live preview</p>
              <div className="rounded-xl border border-input bg-gray-50 p-3">
                {previewPromos.length > 0 ? (
                  editor.placement === "POPUP" ? (
                    <div className="mx-auto max-w-[280px] bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewPromos[0].imageUrl} alt="" className="w-full aspect-[16/9] object-cover" />
                      <div className="px-4 pt-4 pb-5 text-center">
                        <h3 className="text-base font-bold text-gray-900 leading-tight">{previewPromos[0].title}</h3>
                        {previewPromos[0].subtitle && (
                          <p className="text-xs text-gray-600 mt-1.5">{previewPromos[0].subtitle}</p>
                        )}
                        {previewPromos[0].ctaUrl && (
                          <div className="mt-3 inline-flex items-center justify-center h-9 px-5 rounded-full bg-[#F5C518] text-gray-900 font-bold text-xs">
                            {previewPromos[0].ctaLabel || "Shop now"}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <PromoSlot placement={editor.placement} promotions={previewPromos} />
                  )
                ) : (
                  <div className="text-center text-xs text-gray-400 py-10">
                    Upload an image to see the preview.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border px-6 py-4 flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-input py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(value)}
              disabled={!value.title.trim() || !value.imageUrl.trim()}
              className="flex-1 rounded-xl bg-brand-gold py-2 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {editor.id ? "Save changes" : "Create promotion"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
