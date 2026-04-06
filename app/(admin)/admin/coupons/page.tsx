"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  toggleAdminCoupon,
} from "@/lib/api"
import type { CouponData, CouponCreateRequest } from "@/lib/api"
import { logError } from "@/lib/errors"
import { toast } from "sonner"
import { Plus, Ticket, Pencil, ToggleLeft, ToggleRight, X } from "lucide-react"
import { DataTable } from "@/components/ui/DataTable"
import { RowActions } from "@/components/ui/RowActions"
import { createColumnHelper } from "@tanstack/react-table"

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtValue(type: string, value: number) {
  if (type === "percentage") return `${(value / 100).toFixed(0)}%`
  return `$${(value / 100).toFixed(2)}`
}

const col = createColumnHelper<CouponData>()

export default function AdminCouponsPage() {
  const { status: sessionStatus } = useSession()
  const [coupons, setCoupons] = useState<CouponData[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CouponData | null>(null)

  const loadCoupons = useCallback(async () => {
    try {
      setLoading(true)
      const token = await getAccessToken()
      if (!token) return
      const res = await getAdminCoupons(token, 0, 200)
      setCoupons(res.content)
    } catch (e) {
      logError(e, "loading coupons")
      toast.error("Failed to load coupons")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === "authenticated") loadCoupons()
  }, [sessionStatus, loadCoupons])

  async function handleCreate(data: CouponCreateRequest) {
    const token = await getAccessToken()
    if (!token) return
    await createAdminCoupon(token, data)
    toast.success("Coupon created")
    setShowForm(false)
    loadCoupons()
  }

  async function handleUpdate(id: string, data: Partial<CouponCreateRequest>) {
    const token = await getAccessToken()
    if (!token) return
    await updateAdminCoupon(token, id, data)
    toast.success("Coupon updated")
    setEditing(null)
    loadCoupons()
  }

  const handleToggle = useCallback(async (id: string) => {
    const token = await getAccessToken()
    if (!token) return
    await toggleAdminCoupon(token, id)
    toast.success("Coupon toggled")
    loadCoupons()
  }, [loadCoupons])

  const columns = useMemo(() => [
    col.accessor("code", {
      header: "Code",
      cell: info => <span className="font-mono font-semibold text-gray-900">{info.getValue()}</span>,
    }),
    col.accessor("type", {
      header: "Type",
      cell: info => <span className="capitalize text-gray-600">{info.getValue().replace("_", " ")}</span>,
    }),
    col.accessor("value", {
      header: "Value",
      cell: info => (
        <span className="font-semibold text-gray-900">{fmtValue(info.row.original.type, info.getValue())}</span>
      ),
    }),
    col.accessor("scope", {
      header: "Scope",
      cell: info => <span className="capitalize text-gray-600">{info.getValue().replace(/_/g, " ")}</span>,
    }),
    col.display({
      id: "owner",
      header: "Owner",
      cell: ({ row }) => {
        const c = row.original
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${c.sellerId ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
            {c.sellerId ? "Seller" : "Admin"}
          </span>
        )
      },
    }),
    col.accessor("usageCount", {
      header: "Usage",
      cell: info => {
        const c = info.row.original
        return <span className="tabular-nums text-gray-600">{c.usageCount}{c.usageLimit ? `/${c.usageLimit}` : ""}</span>
      },
    }),
    col.accessor("expiresAt", {
      header: "Expires",
      cell: info => <span className="whitespace-nowrap text-gray-600">{fmtDate(info.getValue())}</span>,
    }),
    col.accessor("active", {
      header: "Status",
      cell: info => {
        const c = info.row.original
        const label = c.active ? "Active" : c.enabled ? "Expired" : "Disabled"
        const cls = c.active
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
          : c.enabled
          ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
          : "bg-gray-100 text-gray-500"
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
            {label}
          </span>
        )
      },
    }),
    col.display({
      id: "actions",
      header: "",
      enableHiding: false,
      cell: ({ row }) => {
        const c = row.original
        return (
          <RowActions actions={[
            {
              label: "Edit",
              icon: <Pencil className="h-4 w-4" />,
              onClick: () => { setEditing(c); setShowForm(false) },
            },
            {
              label: c.enabled ? "Disable" : "Enable",
              icon: c.enabled
                ? <ToggleRight className="h-4 w-4 text-emerald-500" />
                : <ToggleLeft className="h-4 w-4" />,
              onClick: () => handleToggle(c.id),
            },
          ]} />
        )
      },
    }),
  ], [handleToggle])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupon Management</h1>
          <p className="text-sm text-gray-500 mt-1">Create site-wide coupons and manage all coupons across the platform.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Create Site-Wide Coupon
        </button>
      </div>

      {(showForm || editing) && (
        <CouponForm
          coupon={editing}
          isAdmin
          onSubmit={editing ? (d) => handleUpdate(editing.id, d) : handleCreate}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      {!loading && coupons.length === 0 && !showForm && !editing ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <Ticket className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">No coupons yet</p>
          <p className="mt-1 text-xs text-gray-500">Create your first site-wide coupon to start offering discounts.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={coupons}
          loading={loading}
          searchPlaceholder="Search coupons…"
          searchColumn="code"
          enableExport
          exportFilename="coupons"
          emptyMessage="No coupons match your search."
        />
      )}
    </div>
  )
}

function CouponForm({
  coupon,
  isAdmin,
  onSubmit,
  onCancel,
}: {
  coupon: CouponData | null
  isAdmin?: boolean
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
  const [scope, setScope] = useState(coupon?.scope || "site_wide")
  const [expiresAt, setExpiresAt] = useState(coupon?.expiresAt ? coupon.expiresAt.slice(0, 16) : "")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !value || !expiresAt) { toast.error("Fill in all required fields"); return }
    setSubmitting(true)
    try {
      await onSubmit({
        code: code.trim().toUpperCase(),
        type,
        value: Math.round(parseFloat(value) * 100),
        minOrderCents: minOrder ? Math.round(parseFloat(minOrder) * 100) : undefined,
        maxDiscountCents: maxDiscount ? Math.round(parseFloat(maxDiscount) * 100) : undefined,
        usageLimit: usageLimit ? parseInt(usageLimit) : undefined,
        perUserLimit: perUserLimit ? parseInt(perUserLimit) : 1,
        scope,
        expiresAt: new Date(expiresAt).toISOString(),
      })
    } catch (e) {
      logError(e, "saving coupon")
      toast.error("Failed to save coupon")
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/50"

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{coupon ? "Edit Coupon" : "Create Site-Wide Coupon"}</h3>
        <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Code *</label>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="LAUNCH50" className={inputCls} />
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
          <select value={scope} onChange={e => setScope(e.target.value as any)} className={inputCls}>
            <option value="site_wide">Site-Wide</option>
            <option value="product">Product</option>
            <option value="store">Store</option>
            <option value="category">Category</option>
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
