"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { Sheet, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/Sheet"
import {
  Loader2, AlertCircle, Plus, Sparkles, MoreHorizontal, Eye, Pencil,
  Trash2, ToggleLeft, ToggleRight, Clock, ExternalLink, Palette,
} from "lucide-react"
import { toast } from "sonner"
import {
  getAdminPlatformDeals, createPlatformDeal, updatePlatformDeal,
  deletePlatformDeal, togglePlatformDeal,
  type PlatformDealData, type PlatformDealCreateRequest,
} from "@/lib/api"

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const AUDIENCE_OPTIONS = [
  { value: "GENERAL", label: "General" },
  { value: "SELLERS", label: "Sellers" },
  { value: "SERVICE_PROVIDERS", label: "Service Providers" },
  { value: "CUSTOMERS", label: "Customers" },
]

function RowActionMenu({ onView, onEdit, onToggle, onDelete, enabled }: {
  onView: () => void; onEdit: () => void; onToggle: () => void; onDelete: () => void; enabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleScroll() { setOpen(false) }
    document.addEventListener("mousedown", handleClick)
    window.addEventListener("scroll", handleScroll, true)
    return () => { document.removeEventListener("mousedown", handleClick); window.removeEventListener("scroll", handleScroll, true) }
  }, [open])

  function toggle() {
    if (open) { setOpen(false); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.right - 192 })
    }
    setOpen(true)
  }

  return (
    <>
      <button ref={btnRef} onClick={toggle} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} className="fixed z-[9999] w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-xl" style={{ top: pos.top, left: pos.left }}>
          <button onClick={() => { onView(); setOpen(false) }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"><Eye className="h-3.5 w-3.5" /> Preview</button>
          <button onClick={() => { onEdit(); setOpen(false) }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"><Pencil className="h-3.5 w-3.5" /> Edit</button>
          <button onClick={() => { onToggle(); setOpen(false) }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900">
            {enabled ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />} {enabled ? "Disable" : "Enable"}
          </button>
          <button onClick={() => { onDelete(); setOpen(false) }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
        </div>,
        document.body
      )}
    </>
  )
}

const EMPTY_FORM: PlatformDealCreateRequest = {
  title: "", description: "", content: "", badgeText: "", bannerImageUrl: "",
  primaryColor: "#EAB308", secondaryColor: "#1a1a1a", textColor: "#ffffff",
  ctaText: "", ctaLink: "", targetAudience: "GENERAL", sortOrder: 0,
}

export default function AdminDealsPage() {
  const { status } = useSession()
  const [loading, setLoading] = useState(true)
  const [deals, setDeals] = useState<PlatformDealData[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PlatformDealData | null>(null)
  const [form, setForm] = useState<PlatformDealCreateRequest>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<PlatformDealData | null>(null)

  async function loadDeals() {
    const token = await getAccessToken()
    if (!token) return
    try {
      const res = await getAdminPlatformDeals(token)
      setDeals(res.content || [])
    } catch { toast.error("Failed to load deals") }
  }

  useEffect(() => {
    if (status !== "authenticated") return
    setLoading(true)
    loadDeals().finally(() => setLoading(false))
  }, [status])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(d: PlatformDealData) {
    setEditing(d)
    setForm({
      title: d.title, description: d.description || "", content: d.content || "",
      badgeText: d.badgeText || "", bannerImageUrl: d.bannerImageUrl || "",
      primaryColor: d.primaryColor, secondaryColor: d.secondaryColor, textColor: d.textColor,
      ctaText: d.ctaText || "", ctaLink: d.ctaLink || "",
      targetAudience: d.targetAudience, startAt: d.startAt || undefined, endAt: d.endAt || undefined,
      sortOrder: d.sortOrder,
    })
    setShowForm(true)
  }

  async function handleSave() {
    const token = await getAccessToken()
    if (!token || !form.title) return
    setSaving(true)
    try {
      if (editing) {
        await updatePlatformDeal(token, editing.id, form)
        toast.success("Deal updated")
      } else {
        await createPlatformDeal(token, form)
        toast.success("Deal created")
      }
      setShowForm(false)
      loadDeals()
    } catch { toast.error("Failed to save deal") }
    setSaving(false)
  }

  async function handleToggle(d: PlatformDealData) {
    const token = await getAccessToken()
    if (!token) return
    try {
      await togglePlatformDeal(token, d.id)
      toast.success(d.enabled ? "Deal disabled" : "Deal enabled")
      loadDeals()
    } catch { toast.error("Failed to toggle deal") }
  }

  async function handleDelete(d: PlatformDealData) {
    if (!confirm(`Delete "${d.title}"?`)) return
    const token = await getAccessToken()
    if (!token) return
    try {
      await deletePlatformDeal(token, d.id)
      toast.success("Deal deleted")
      loadDeals()
    } catch { toast.error("Failed to delete deal") }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[400px] gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading deals...</div>

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Deals</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage promotional banners and campaigns to attract sellers and customers.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-black hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> New Deal
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">All Platform Deals</h2>
        </div>

        {deals.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-500 text-sm">No platform deals yet. Create your first promotion.</div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_120px_100px_100px_80px_44px] gap-2 px-5 py-2.5 text-xs text-gray-500 font-medium uppercase tracking-wide border-b border-gray-100">
              <span>Title</span><span>Audience</span><span>Status</span><span>Dates</span><span className="text-center">Order</span><span />
            </div>
            <div className="divide-y divide-gray-100">
              {deals.map((d) => (
                <div key={d.id} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_100px_100px_80px_44px] gap-2 px-5 py-3 items-center hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: d.primaryColor + "20" }}>
                      <Sparkles className="h-4 w-4" style={{ color: d.primaryColor }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{d.title}</p>
                      {d.badgeText && <p className="text-[11px] text-gray-400 truncate">{d.badgeText}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{AUDIENCE_OPTIONS.find(a => a.value === d.targetAudience)?.label || d.targetAudience}</span>
                  <div>
                    {d.active ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Active</span>
                    ) : d.enabled ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700"><span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />Scheduled</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500"><span className="h-1.5 w-1.5 rounded-full bg-gray-400" />Disabled</span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {d.startAt ? formatDate(d.startAt) : "Always"}
                    {d.endAt ? ` → ${formatDate(d.endAt)}` : ""}
                  </div>
                  <span className="text-xs text-gray-400 text-center">{d.sortOrder}</span>
                  <RowActionMenu
                    onView={() => setPreview(d)}
                    onEdit={() => openEdit(d)}
                    onToggle={() => handleToggle(d)}
                    onDelete={() => handleDelete(d)}
                    enabled={d.enabled}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Sheet */}
      <Sheet open={showForm} onClose={() => setShowForm(false)}>
        <SheetHeader onClose={() => setShowForm(false)}>{editing ? "Edit Deal" : "Create Deal"}</SheetHeader>
        <SheetBody>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" placeholder="e.g. Become a Seller — First Month Free!" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Description</label>
              <textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary resize-none" rows={2} placeholder="Short description for the banner" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Content</label>
              <textarea value={form.content || ""} onChange={e => setForm({ ...form, content: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary resize-none" rows={3} placeholder="Extended content / details" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Badge Text</label>
                <input value={form.badgeText || ""} onChange={e => setForm({ ...form, badgeText: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" placeholder="e.g. NEW, HOT, FREE" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Target Audience</label>
                <select value={form.targetAudience || "GENERAL"} onChange={e => setForm({ ...form, targetAudience: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary bg-white">
                  {AUDIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Banner Image URL</label>
              <input value={form.bannerImageUrl || ""} onChange={e => setForm({ ...form, bannerImageUrl: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" placeholder="https://... (optional)" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center gap-1"><Palette className="h-3.5 w-3.5" /> Colors</label>
              <div className="grid grid-cols-3 gap-3 mt-1">
                <div>
                  <span className="text-[10px] text-gray-500">Primary</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input type="color" value={form.primaryColor || "#EAB308"} onChange={e => setForm({ ...form, primaryColor: e.target.value })} className="h-8 w-8 rounded border border-gray-300 cursor-pointer" />
                    <input value={form.primaryColor || "#EAB308"} onChange={e => setForm({ ...form, primaryColor: e.target.value })} className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none" />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500">Background</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input type="color" value={form.secondaryColor || "#1a1a1a"} onChange={e => setForm({ ...form, secondaryColor: e.target.value })} className="h-8 w-8 rounded border border-gray-300 cursor-pointer" />
                    <input value={form.secondaryColor || "#1a1a1a"} onChange={e => setForm({ ...form, secondaryColor: e.target.value })} className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none" />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500">Text</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input type="color" value={form.textColor || "#ffffff"} onChange={e => setForm({ ...form, textColor: e.target.value })} className="h-8 w-8 rounded border border-gray-300 cursor-pointer" />
                    <input value={form.textColor || "#ffffff"} onChange={e => setForm({ ...form, textColor: e.target.value })} className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Banner Preview */}
            {form.title && (
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Preview</label>
                <div className="mt-1 rounded-xl overflow-hidden border border-gray-200" style={{
                  background: form.bannerImageUrl ? `url(${form.bannerImageUrl}) center/cover no-repeat` : `linear-gradient(135deg, ${form.secondaryColor}, ${form.primaryColor}40)`,
                }}>
                  <div className="p-5 min-h-[120px] flex flex-col justify-between" style={{ background: form.bannerImageUrl ? "rgba(0,0,0,0.45)" : undefined }}>
                    <div>
                      {form.badgeText && <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold mb-2" style={{ backgroundColor: form.primaryColor, color: form.secondaryColor }}>{form.badgeText}</span>}
                      <h3 className="text-lg font-bold" style={{ color: form.textColor }}>{form.title}</h3>
                      {form.description && <p className="text-xs opacity-75 mt-1" style={{ color: form.textColor }}>{form.description}</p>}
                    </div>
                    {form.ctaText && (
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold rounded-lg px-3 py-1.5 self-start" style={{ backgroundColor: form.primaryColor, color: form.secondaryColor }}>
                        {form.ctaText}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">CTA Button Text</label>
                <input value={form.ctaText || ""} onChange={e => setForm({ ...form, ctaText: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" placeholder="e.g. Start Selling" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">CTA Link</label>
                <input value={form.ctaLink || ""} onChange={e => setForm({ ...form, ctaLink: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" placeholder="/sell or https://..." />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Start Date</label>
                <input type="datetime-local" value={form.startAt ? new Date(form.startAt).toISOString().slice(0, 16) : ""} onChange={e => setForm({ ...form, startAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">End Date</label>
                <input type="datetime-local" value={form.endAt ? new Date(form.endAt).toISOString().slice(0, 16) : ""} onChange={e => setForm({ ...form, endAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Sort Order</label>
                <input type="number" value={form.sortOrder ?? 0} onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
            </div>
          </div>
        </SheetBody>
        <SheetFooter>
          <button onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-black hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Update" : "Create"}
          </button>
        </SheetFooter>
      </Sheet>

      {/* Preview Sheet */}
      <Sheet open={!!preview} onClose={() => setPreview(null)}>
        <SheetHeader onClose={() => setPreview(null)}>Deal Preview</SheetHeader>
        <SheetBody>
          {preview && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-gray-200" style={{
                background: preview.bannerImageUrl ? `url(${preview.bannerImageUrl}) center/cover no-repeat` : `linear-gradient(135deg, ${preview.secondaryColor}, ${preview.primaryColor}40)`,
              }}>
                <div className="p-6 min-h-[160px] flex flex-col justify-between" style={{ background: preview.bannerImageUrl ? "rgba(0,0,0,0.45)" : undefined }}>
                  <div>
                    {preview.badgeText && <span className="inline-block rounded-full px-3 py-0.5 text-xs font-bold mb-2" style={{ backgroundColor: preview.primaryColor, color: preview.secondaryColor }}>{preview.badgeText}</span>}
                    <h3 className="text-xl font-bold" style={{ color: preview.textColor }}>{preview.title}</h3>
                    {preview.description && <p className="text-sm opacity-80 mt-1" style={{ color: preview.textColor }}>{preview.description}</p>}
                  </div>
                  {preview.ctaText && (
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold rounded-lg px-4 py-2 self-start" style={{ backgroundColor: preview.primaryColor, color: preview.secondaryColor }}>
                      {preview.ctaText} <ExternalLink className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>
              {preview.content && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{preview.content}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-[11px] text-gray-500 uppercase font-medium">Target</p>
                  <p className="text-gray-900 font-medium">{AUDIENCE_OPTIONS.find(a => a.value === preview.targetAudience)?.label}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-[11px] text-gray-500 uppercase font-medium">Status</p>
                  <p className="text-gray-900 font-medium">{preview.active ? "Active" : preview.enabled ? "Scheduled" : "Disabled"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-[11px] text-gray-500 uppercase font-medium">CTA Link</p>
                  <p className="text-gray-900 font-medium truncate">{preview.ctaLink || "—"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-[11px] text-gray-500 uppercase font-medium">Created</p>
                  <p className="text-gray-900 font-medium">{formatDate(preview.createdAt)}</p>
                </div>
              </div>
            </div>
          )}
        </SheetBody>
        <SheetFooter>
          <button onClick={() => setPreview(null)} className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">Close</button>
        </SheetFooter>
      </Sheet>
    </div>
  )
}
