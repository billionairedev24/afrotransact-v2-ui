"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { Sheet, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/Sheet"
import {
  Loader2, Plus, Tag, MoreHorizontal, Pencil,
  Trash2, ToggleLeft, ToggleRight, Store, Package,
} from "lucide-react"
import { toast } from "sonner"
import {
  getSellerDeals, createSellerDeal, updateSellerDeal,
  deleteSellerDeal, toggleSellerDeal, getSellerProducts,
  getCurrentSeller, getSellerStores,
  type DealData, type DealCreateRequest, type Product, type StoreDetail,
} from "@/lib/api"

function formatCents(cents: number | null) {
  if (!cents) return "—"
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function RowActionMenu({ onEdit, onToggle, onDelete, enabled }: {
  onEdit: () => void; onToggle: () => void; onDelete: () => void; enabled: boolean
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
      setPos({ top: r.bottom + 4, left: r.right - 176 })
    }
    setOpen(true)
  }

  return (
    <>
      <button ref={btnRef} onClick={toggle} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} className="fixed z-[9999] w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-xl" style={{ top: pos.top, left: pos.left }}>
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

type DealType = "store-wide" | "product"

interface FormState {
  dealType: DealType
  storeId: string
  productId: string
  title: string
  description: string
  badgeText: string
  discountPercent: number | undefined
  dealPriceCents: number | undefined
  startAt: string | undefined
  endAt: string | undefined
}

const EMPTY_FORM: FormState = {
  dealType: "product",
  storeId: "",
  productId: "",
  title: "",
  description: "",
  badgeText: "",
  discountPercent: undefined,
  dealPriceCents: undefined,
  startAt: undefined,
  endAt: undefined,
}

export default function SellerDealsPage() {
  const { status } = useSession()
  const [loading, setLoading] = useState(true)
  const [deals, setDeals] = useState<DealData[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<StoreDetail[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DealData | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function loadData() {
    const token = await getAccessToken()
    if (!token) return
    try {
      const seller = await getCurrentSeller(token)
      const [dealsRes, prodsRes, storesRes] = await Promise.all([
        getSellerDeals(token),
        getSellerProducts(token),
        getSellerStores(token, seller.id),
      ])
      setDeals(dealsRes.content || [])
      setProducts((prodsRes.content || []).filter(p => p.status === "ACTIVE"))
      setStores(storesRes || [])
    } catch { toast.error("Failed to load data") }
  }

  useEffect(() => {
    if (status !== "authenticated") return
    setLoading(true)
    loadData().finally(() => setLoading(false))
  }, [status])

  function openCreate() {
    setEditing(null)
    const defaultStoreId = stores.length > 0 ? stores[0].id : ""
    setForm({ ...EMPTY_FORM, storeId: defaultStoreId })
    setShowForm(true)
  }

  function openEdit(d: DealData) {
    setEditing(d)
    const isStoreWide = !d.productId
    setForm({
      dealType: isStoreWide ? "store-wide" : "product",
      storeId: d.storeId || "",
      productId: d.productId || "",
      title: d.title,
      description: d.description || "",
      badgeText: d.badgeText || "",
      discountPercent: d.discountPercent ?? undefined,
      dealPriceCents: d.dealPriceCents ?? undefined,
      startAt: d.startAt || undefined,
      endAt: d.endAt || undefined,
    })
    setShowForm(true)
  }

  async function handleSave() {
    const token = await getAccessToken()
    if (!token || !form.title) return

    if (form.dealType === "product" && !form.productId) {
      toast.error("Please select a product")
      return
    }
    if (form.dealType === "store-wide" && !form.storeId) {
      toast.error("Please select a store")
      return
    }

    const payload: DealCreateRequest = {
      title: form.title,
      description: form.description || undefined,
      badgeText: form.badgeText || undefined,
      discountPercent: form.discountPercent,
      dealPriceCents: form.dealPriceCents,
      startAt: form.startAt,
      endAt: form.endAt,
    }

    if (form.dealType === "product") {
      payload.productId = form.productId
    } else {
      payload.storeId = form.storeId
    }

    setSaving(true)
    try {
      if (editing) {
        await updateSellerDeal(token, editing.id, payload)
        toast.success("Deal updated")
      } else {
        await createSellerDeal(token, payload)
        toast.success("Deal created")
      }
      setShowForm(false)
      loadData()
    } catch { toast.error("Failed to save deal") }
    setSaving(false)
  }

  async function handleToggle(d: DealData) {
    const token = await getAccessToken()
    if (!token) return
    try {
      await toggleSellerDeal(token, d.id)
      toast.success(d.enabled ? "Deal disabled" : "Deal enabled")
      loadData()
    } catch { toast.error("Failed to toggle deal") }
  }

  async function handleDelete(d: DealData) {
    if (!confirm(`Delete "${d.title}"?`)) return
    const token = await getAccessToken()
    if (!token) return
    try {
      await deleteSellerDeal(token, d.id)
      toast.success("Deal deleted")
      loadData()
    } catch { toast.error("Failed to delete deal") }
  }

  const selectedProduct = products.find(p => p.id === form.productId)
  const originalPrice = selectedProduct?.variants?.[0]?.price

  const canSave = form.title.trim().length > 0 &&
    (form.dealType === "product" ? !!form.productId : !!form.storeId) &&
    !saving

  if (loading) return <div className="flex items-center justify-center min-h-[400px] gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading deals...</div>

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Deals</h1>
          <p className="text-sm text-gray-500 mt-1">Create store-wide promotions or product-specific deals.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-black hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Create Deal
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-[#EAB308]/20 bg-[#EAB308]/5 p-4">
        <Tag className="h-5 w-5 text-[#EAB308] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm text-gray-900 font-medium">How deals work</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            <strong>Store-wide deals</strong> apply across your entire store (e.g. "Free Shipping Weekend").{" "}
            <strong>Product deals</strong> target a specific product with a discount percentage or fixed price.
            Active deals appear on the homepage and deals page.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Your Deals</h2>
        </div>

        {deals.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-500 text-sm">
            No deals yet. Create your first deal to attract more customers!
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_100px_120px_100px_100px_90px_44px] gap-2 px-5 py-2.5 text-xs text-gray-500 font-medium uppercase tracking-wide border-b border-gray-100">
              <span>Deal</span><span>Type</span><span>Product</span><span>Price</span><span>Status</span><span className="text-right">Ends</span><span />
            </div>
            <div className="divide-y divide-gray-100">
              {deals.map((d) => {
                const isStoreWide = !d.productId
                return (
                  <div key={d.id} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_120px_100px_100px_90px_44px] gap-2 px-5 py-3 items-center hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{d.title}</p>
                      {d.badgeText && <span className="text-[10px] text-primary font-semibold">{d.badgeText}</span>}
                    </div>
                    <div>
                      {isStoreWide ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                          <Store className="h-3 w-3" /> Store
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                          <Package className="h-3 w-3" /> Product
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 truncate">
                      {isStoreWide ? "All products" : (d.productTitle || "—")}
                    </span>
                    <div className="text-sm">
                      {d.dealPriceCents ? (
                        <span className="flex items-center gap-1">
                          <span className="font-semibold text-gray-900">{formatCents(d.dealPriceCents)}</span>
                          {d.originalPriceCents && <span className="text-xs text-gray-400 line-through">{formatCents(d.originalPriceCents)}</span>}
                        </span>
                      ) : d.discountPercent ? (
                        <span className="font-semibold text-primary">{d.discountPercent}% OFF</span>
                      ) : "—"}
                    </div>
                    <div>
                      {d.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Active</span>
                      ) : d.enabled ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700"><span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />Scheduled</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500"><span className="h-1.5 w-1.5 rounded-full bg-gray-400" />Disabled</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 text-right">{d.endAt ? formatDate(d.endAt) : "Always"}</span>
                    <RowActionMenu
                      onEdit={() => openEdit(d)}
                      onToggle={() => handleToggle(d)}
                      onDelete={() => handleDelete(d)}
                      enabled={d.enabled ?? false}
                    />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Sheet */}
      <Sheet open={showForm} onClose={() => setShowForm(false)}>
        <SheetHeader onClose={() => setShowForm(false)}>{editing ? "Edit Deal" : "Create Deal"}</SheetHeader>
        <SheetBody>
          <div className="space-y-5">
            {/* Deal type toggle */}
            {!editing && (
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Deal Type</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, dealType: "store-wide", productId: "" })}
                    className={`flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      form.dealType === "store-wide"
                        ? "border-[#EAB308] bg-[#EAB308]/5 shadow-sm"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      form.dealType === "store-wide" ? "bg-[#EAB308]/10" : "bg-gray-100"
                    }`}>
                      <Store className={`h-4 w-4 ${form.dealType === "store-wide" ? "text-[#EAB308]" : "text-gray-400"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${form.dealType === "store-wide" ? "text-gray-900" : "text-gray-700"}`}>Store-wide</p>
                      <p className="text-[10px] text-gray-500">Applies to entire store</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, dealType: "product", storeId: "" })}
                    className={`flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      form.dealType === "product"
                        ? "border-[#EAB308] bg-[#EAB308]/5 shadow-sm"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      form.dealType === "product" ? "bg-[#EAB308]/10" : "bg-gray-100"
                    }`}>
                      <Package className={`h-4 w-4 ${form.dealType === "product" ? "text-[#EAB308]" : "text-gray-400"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${form.dealType === "product" ? "text-gray-900" : "text-gray-700"}`}>Product</p>
                      <p className="text-[10px] text-gray-500">Discount on one product</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Store selector (store-wide) */}
            {form.dealType === "store-wide" && (
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Store *</label>
                <select
                  value={form.storeId}
                  onChange={e => setForm({ ...form, storeId: e.target.value })}
                  disabled={!!editing}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary bg-white disabled:bg-gray-100"
                >
                  {stores.length === 0 && <option value="">No stores found</option>}
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Product selector (product deal) */}
            {form.dealType === "product" && (
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Product *</label>
                <select
                  value={form.productId}
                  onChange={e => setForm({ ...form, productId: e.target.value })}
                  disabled={!!editing}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary bg-white disabled:bg-gray-100"
                >
                  <option value="">Select a product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.title} — ${p.variants?.[0]?.price?.toFixed(2) || "0.00"}</option>
                  ))}
                </select>
                {products.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">No active products found. Only active products can have deals.</p>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Deal Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" placeholder={form.dealType === "store-wide" ? "e.g. Free Shipping Weekend" : "e.g. Spring Sale — 20% Off!"} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary resize-none" rows={2} placeholder="Short description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Badge Text</label>
                <input value={form.badgeText} onChange={e => setForm({ ...form, badgeText: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" placeholder="e.g. HOT, BOGO" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Discount %</label>
                <input type="number" min={0} max={100} value={form.discountPercent ?? ""} onChange={e => setForm({ ...form, discountPercent: e.target.value ? parseInt(e.target.value) : undefined })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" placeholder="e.g. 20" />
              </div>
            </div>
            {form.dealType === "product" && originalPrice && form.discountPercent && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <p className="text-sm text-green-700">
                  Deal price: <span className="font-bold">${(originalPrice * (1 - (form.discountPercent / 100))).toFixed(2)}</span>
                  <span className="text-xs text-green-600 ml-2">(was ${originalPrice.toFixed(2)})</span>
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Or Fixed Deal Price (cents)</label>
                <input type="number" value={form.dealPriceCents ?? ""} onChange={e => setForm({ ...form, dealPriceCents: e.target.value ? parseInt(e.target.value) : undefined })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" placeholder="e.g. 1999 = $19.99" />
              </div>
              <div />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Start Date</label>
                <input type="datetime-local" value={form.startAt ? new Date(form.startAt).toISOString().slice(0, 16) : ""} onChange={e => setForm({ ...form, startAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">End Date</label>
                <input type="datetime-local" value={form.endAt ? new Date(form.endAt).toISOString().slice(0, 16) : ""} onChange={e => setForm({ ...form, endAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
            </div>
          </div>
        </SheetBody>
        <SheetFooter>
          <button onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!canSave} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-black hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Update" : "Create"}
          </button>
        </SheetFooter>
      </Sheet>
    </div>
  )
}
