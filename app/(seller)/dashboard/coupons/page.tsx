"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getSellerCoupons,
  createSellerCoupon,
  updateSellerCoupon,
  deleteSellerCoupon,
} from "@/lib/api"
import type { CouponData, CouponCreateRequest } from "@/lib/api"
import { toast } from "sonner"
import {
  Plus,
  Ticket,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
} from "lucide-react"

const PAGE_SIZE = 10

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  })
}

function fmtValue(type: string, value: number) {
  if (type === "percentage") return `${(value / 100).toFixed(0)}%`
  return `$${(value / 100).toFixed(2)}`
}

export default function SellerCouponsPage() {
  const { status: sessionStatus } = useSession()
  const [coupons, setCoupons] = useState<CouponData[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CouponData | null>(null)

  const loadCoupons = useCallback(async (pg: number) => {
    try {
      setLoading(true)
      const token = await getAccessToken()
      if (!token) return
      const res = await getSellerCoupons(token, pg, PAGE_SIZE)
      setCoupons(res.content)
      setTotalPages(res.totalPages)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load coupons")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === "authenticated") loadCoupons(page)
  }, [sessionStatus, page, loadCoupons])

  async function handleCreate(data: CouponCreateRequest) {
    const token = await getAccessToken()
    if (!token) return
    await createSellerCoupon(token, data)
    toast.success("Coupon created")
    setShowForm(false)
    loadCoupons(page)
  }

  async function handleUpdate(id: string, data: Partial<CouponCreateRequest>) {
    const token = await getAccessToken()
    if (!token) return
    await updateSellerCoupon(token, id, data)
    toast.success("Coupon updated")
    setEditing(null)
    loadCoupons(page)
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this coupon?")) return
    const token = await getAccessToken()
    if (!token) return
    await deleteSellerCoupon(token, id)
    toast.success("Coupon deleted")
    loadCoupons(page)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage discount coupons for your products.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Coupon
        </button>
      </div>

      {(showForm || editing) && (
        <CouponForm
          coupon={editing}
          onSubmit={editing
            ? (d) => handleUpdate(editing.id, d)
            : handleCreate
          }
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {["Code", "Type", "Value", "Scope", "Usage", "Expires", "Status", ""].map(h => (
                  <th key={h || "actions"} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" /></td></tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Ticket className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No coupons yet. Create your first coupon to get started.</p>
                  </td>
                </tr>
              ) : (
                coupons.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><span className="text-sm font-mono font-medium text-gray-900">{c.code}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{c.type.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{fmtValue(c.type, c.value)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{c.scope.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.usageCount}{c.usageLimit ? `/${c.usageLimit}` : ""}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDate(c.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${c.active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>
                        {c.active ? "Active" : c.enabled ? "Expired" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditing(c)} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">Page {page + 1} of {totalPages}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 0} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 transition-colors"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CouponForm({
  coupon,
  onSubmit,
  onCancel,
}: {
  coupon: CouponData | null
  onSubmit: (data: CouponCreateRequest) => Promise<void>
  onCancel: () => void
}) {
  const [code, setCode] = useState(coupon?.code || "")
  const [type, setType] = useState<"percentage" | "fixed_amount">(coupon?.type || "percentage")
  const [value, setValue] = useState(coupon ? String(coupon.value / 100) : "")
  const [minOrder, setMinOrder] = useState(coupon?.minOrderCents ? String(coupon.minOrderCents / 100) : "")
  const [maxDiscount, setMaxDiscount] = useState(coupon?.maxDiscountCents ? String(coupon.maxDiscountCents / 100) : "")
  const [usageLimit, setUsageLimit] = useState(coupon?.usageLimit ? String(coupon.usageLimit) : "")
  const [perUserLimit, setPerUserLimit] = useState(coupon?.perUserLimit ? String(coupon.perUserLimit) : "1")
  const [scope, setScope] = useState(coupon?.scope || "product")
  const [expiresAt, setExpiresAt] = useState(coupon?.expiresAt ? coupon.expiresAt.slice(0, 16) : "")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !value || !expiresAt) { toast.error("Fill in all required fields"); return }
    setSubmitting(true)
    try {
      const multiplier = 100
      await onSubmit({
        code: code.trim().toUpperCase(),
        type,
        value: Math.round(parseFloat(value) * multiplier),
        minOrderCents: minOrder ? Math.round(parseFloat(minOrder) * 100) : undefined,
        maxDiscountCents: maxDiscount ? Math.round(parseFloat(maxDiscount) * 100) : undefined,
        usageLimit: usageLimit ? parseInt(usageLimit) : undefined,
        perUserLimit: perUserLimit ? parseInt(perUserLimit) : 1,
        scope,
        expiresAt: new Date(expiresAt).toISOString(),
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save coupon")
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/50"

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{coupon ? "Edit Coupon" : "Create Coupon"}</h3>
        <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Code *</label>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="SUMMER25" className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Type *</label>
          <select value={type} onChange={e => setType(e.target.value as any)} className={inputCls}>
            <option value="percentage">Percentage</option>
            <option value="fixed_amount">Fixed Amount</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Value * ({type === "percentage" ? "%" : "$"})</label>
          <input type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder={type === "percentage" ? "25" : "5.00"} className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Scope</label>
          <select value={scope} onChange={e => setScope(e.target.value)} className={inputCls}>
            <option value="product">Product</option>
            <option value="store">Store</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Min Order ($)</label>
          <input type="number" step="0.01" value={minOrder} onChange={e => setMinOrder(e.target.value)} placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Max Discount ($)</label>
          <input type="number" step="0.01" value={maxDiscount} onChange={e => setMaxDiscount(e.target.value)} placeholder="No limit" className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Usage Limit</label>
          <input type="number" value={usageLimit} onChange={e => setUsageLimit(e.target.value)} placeholder="Unlimited" className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Per-User Limit</label>
          <input type="number" value={perUserLimit} onChange={e => setPerUserLimit(e.target.value)} placeholder="1" className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Expires At *</label>
          <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
        <button type="submit" disabled={submitting} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {submitting ? "Saving…" : coupon ? "Update" : "Create"}
        </button>
      </div>
    </form>
  )
}
