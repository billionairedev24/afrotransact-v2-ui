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
import { friendlyMessage, logError } from "@/lib/errors"
import { toast } from "sonner"
import { Plus, Ticket, Pencil, X } from "lucide-react"
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

type StatusFilter = "all" | "active" | "paused" | "expired"

function couponStatus(c: CouponData): "active" | "paused" | "expired" {
  if (c.active) return "active"
  if (c.enabled) return "expired"
  return "paused"
}

/** Small inline pill switch for per-coupon active toggle. */
function InlineSwitch({
  on,
  busy,
  onClick,
  ariaLabel,
}: {
  on: boolean
  busy?: boolean
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={busy}
      onClick={onClick}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-emerald-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}

export default function AdminCouponsPage() {
  const { status: sessionStatus } = useSession()
  const [coupons, setCoupons] = useState<CouponData[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CouponData | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>("all")

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
    if (sessionStatus === "authenticated") {
      loadCoupons()
    }
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

  const handleToggle = useCallback(async (c: CouponData) => {
    const token = await getAccessToken()
    if (!token) return
    const prevEnabled = c.enabled
    const prevActive = c.active
    // Optimistic: flip enabled; active flips iff not expired (i.e. expiry not in past)
    const expired = new Date(c.expiresAt).getTime() <= Date.now()
    setCoupons((list) =>
      list.map((x) =>
        x.id === c.id
          ? { ...x, enabled: !prevEnabled, active: !prevEnabled && !expired }
          : x,
      ),
    )
    setTogglingId(c.id)
    try {
      await toggleAdminCoupon(token, c.id)
      toast.success(prevEnabled ? "Coupon paused" : "Coupon activated")
    } catch (err) {
      // Revert
      setCoupons((list) =>
        list.map((x) =>
          x.id === c.id ? { ...x, enabled: prevEnabled, active: prevActive } : x,
        ),
      )
      logError(err, "coupons.toggle")
      toast.error(friendlyMessage(err, "Couldn't update coupon. Please try again."))
    } finally {
      setTogglingId(null)
    }
  }, [])

  const filteredCoupons = useMemo(() => {
    if (filter === "all") return coupons
    return coupons.filter((c) => couponStatus(c) === filter)
  }, [coupons, filter])

  const counts = useMemo(() => {
    let active = 0, paused = 0, expired = 0
    for (const c of coupons) {
      const s = couponStatus(c)
      if (s === "active") active++
      else if (s === "paused") paused++
      else expired++
    }
    return { all: coupons.length, active, paused, expired }
  }, [coupons])

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
        const s = couponStatus(c)
        if (s === "expired") {
          return (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
              Expired
            </span>
          )
        }
        const on = s === "active"
        // Seller-owned coupons are view-only for admins: surface status as a
        // static pill rather than a toggle. Admins create + manage site-wide
        // coupons (sellerId == null) — those still get the inline switch.
        if (c.sellerId) {
          return (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  on
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                    : "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-200"
                }`}
              >
                {on ? "Active" : "Paused"}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-gray-400">
                seller-owned
              </span>
            </div>
          )
        }
        return (
          <div className="flex items-center gap-2">
            <InlineSwitch
              on={on}
              busy={togglingId === c.id}
              onClick={() => handleToggle(c)}
              ariaLabel={on ? `Pause coupon ${c.code}` : `Activate coupon ${c.code}`}
            />
            <span className={`text-xs font-medium ${on ? "text-emerald-700" : "text-gray-500"}`}>
              {on ? "Active" : "Paused"}
            </span>
          </div>
        )
      },
    }),
    col.display({
      id: "actions",
      header: "",
      enableHiding: false,
      cell: ({ row }) => {
        const c = row.original
        // Seller-owned coupons are read-only for admin — only "View" is offered.
        // Site-wide (admin-created) coupons keep the full Edit action.
        if (c.sellerId) {
          return (
            <RowActions actions={[
              {
                label: "View",
                icon: <Pencil className="h-4 w-4" />,
                onClick: () => { setEditing(c); setShowForm(false) },
              },
            ]} />
          )
        }
        return (
          <RowActions actions={[
            {
              label: "Edit",
              icon: <Pencil className="h-4 w-4" />,
              onClick: () => { setEditing(c); setShowForm(false) },
            },
          ]} />
        )
      },
    }),
  ], [handleToggle, togglingId])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupon Management</h1>
          <p className="text-sm text-gray-500 mt-1">Create site-wide coupons and manage all coupons across the platform.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-bold text-brand-gold-foreground transition-colors hover:bg-brand-gold-hover"
        >
          <Plus className="h-4 w-4" /> Create Site-Wide Coupon
        </button>
      </div>

      {/* Enablement per Service Location is configured on the Settings page
          (Settings → Service Locations → per-zone feature toggles). This
          page is coupon CRUD only, so operators aren't editing the same
          flag in two places. */}

      {(showForm || editing) && (
        <CouponForm
          coupon={editing}
          isAdmin
          // Seller-owned coupons open in view-only mode; site-wide stay editable.
          readOnly={!!editing?.sellerId}
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
        <>
          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: "all", label: "All", count: counts.all },
              { key: "active", label: "Active", count: counts.active },
              { key: "paused", label: "Paused", count: counts.paused },
              { key: "expired", label: "Expired", count: counts.expired },
            ] as { key: StatusFilter; label: string; count: number }[]).map((chip) => {
              const selected = filter === chip.key
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setFilter(chip.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selected
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {chip.label}
                  <span className={`tabular-nums ${selected ? "text-gray-200" : "text-gray-400"}`}>
                    {chip.count}
                  </span>
                </button>
              )
            })}
          </div>

          <DataTable
            columns={columns}
            data={filteredCoupons}
            loading={loading}
            searchPlaceholder="Search coupons…"
            searchColumn="code"
            enableExport
            exportFilename="coupons"
            emptyMessage="No coupons match your search."
          />
        </>
      )}
    </div>
  )
}

function CouponForm({
  coupon,
  isAdmin,
  readOnly = false,
  onSubmit,
  onCancel,
}: {
  coupon: CouponData | null
  isAdmin?: boolean
  readOnly?: boolean
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
  const [discountTarget, setDiscountTarget] = useState<"items" | "shipping">(
    (coupon?.discountTarget as "items" | "shipping" | undefined) || "items",
  )
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
        discountTarget,
        expiresAt: new Date(expiresAt).toISOString(),
      })
    } catch (e) {
      logError(e, "saving coupon")
      toast.error("Failed to save coupon")
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = "w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/50"

  const inputAttrs = readOnly ? { readOnly: true, disabled: true } : {}
  const selectAttrs = readOnly ? { disabled: true } : {}

  return (
    <form onSubmit={readOnly ? (e) => e.preventDefault() : handleSubmit} className="rounded-xl border border-input bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {readOnly ? "View Coupon (seller-owned, read-only)" : coupon ? "Edit Coupon" : "Create Site-Wide Coupon"}
        </h3>
        <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Code *</label>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="LAUNCH50" className={inputCls} {...inputAttrs} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Type *</label>
          <select value={type} onChange={e => setType(e.target.value as "percentage" | "fixed_amount")} className={inputCls} {...selectAttrs}>
            <option value="percentage">Percentage</option>
            <option value="fixed_amount">Fixed Amount</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Value * ({type === "percentage" ? "%" : "$"})</label>
          <input type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder={type === "percentage" ? "25" : "5.00"} className={inputCls} {...inputAttrs} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Scope</label>
          <select value={scope} onChange={e => setScope(e.target.value as typeof scope)} className={inputCls} {...selectAttrs}>
            <option value="site_wide">Site-Wide</option>
            <option value="product">Product</option>
            <option value="store">Store</option>
            <option value="category">Category</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Applies to</label>
          <select value={discountTarget} onChange={e => setDiscountTarget(e.target.value as "items" | "shipping")} className={inputCls} {...selectAttrs}>
            <option value="items">Order items</option>
            <option value="shipping">Shipping fee</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Min Order ($)</label>
          <input type="number" step="0.01" value={minOrder} onChange={e => setMinOrder(e.target.value)} placeholder="0" className={inputCls} {...inputAttrs} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Max Discount ($)</label>
          <input type="number" step="0.01" value={maxDiscount} onChange={e => setMaxDiscount(e.target.value)} placeholder="No limit" className={inputCls} {...inputAttrs} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Usage Limit</label>
          <input type="number" value={usageLimit} onChange={e => setUsageLimit(e.target.value)} placeholder="Unlimited" className={inputCls} {...inputAttrs} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Per-User Limit</label>
          <input type="number" value={perUserLimit} onChange={e => setPerUserLimit(e.target.value)} placeholder="1" className={inputCls} {...inputAttrs} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Expires At *</label>
          <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={inputCls} {...inputAttrs} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">{readOnly ? "Close" : "Cancel"}</button>
        {!readOnly && (
        <button type="submit" disabled={submitting} className="rounded-lg bg-brand-gold px-5 py-2 text-sm font-bold text-brand-gold-foreground hover:bg-brand-gold-hover disabled:opacity-50 transition-colors">
          {submitting ? "Saving…" : coupon ? "Update" : "Create"}
        </button>
        )}
      </div>
    </form>
  )
}
