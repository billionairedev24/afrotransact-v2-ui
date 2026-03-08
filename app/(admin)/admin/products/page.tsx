"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { DataTable } from "@/components/ui/DataTable"
import { RowActions, type RowAction } from "@/components/ui/RowActions"
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@/components/ui/Dialog"
import { Sheet, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/Sheet"
import { createColumnHelper } from "@tanstack/react-table"
import { toast } from "sonner"
import {
  Loader2,
  Package,
  Eye,
  CheckCircle,
  XCircle,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  Tag,
  Weight,
  Hash,
  DollarSign,
  BoxesIcon,
} from "lucide-react"
import {
  getAdminProducts,
  approveProduct,
  rejectProduct,
  ApiError,
  type Product,
} from "@/lib/api"

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending_review", label: "Pending Review" },
  { value: "active", label: "Active" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
]

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending_review: { label: "Pending Review", className: "bg-yellow-500/20 text-yellow-400" },
  active:         { label: "Active",         className: "bg-green-500/20 text-green-400" },
  approved:       { label: "Approved",       className: "bg-green-500/20 text-green-400" },
  rejected:       { label: "Rejected",       className: "bg-red-500/20 text-red-400" },
  draft:          { label: "Draft",          className: "bg-white/10 text-gray-400" },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatPrice(dollars: number) {
  return `$${dollars.toFixed(2)}`
}

function totalStock(product: Product): number {
  return product.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
}

function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase()
  const b = STATUS_BADGE[key] ?? { label: status, className: "bg-white/10 text-gray-400" }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${b.className}`}>
      {b.label}
    </span>
  )
}

const col = createColumnHelper<Product>()

export default function AdminProductsPage() {
  const { status: sessionStatus } = useSession()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [apiNotReady, setApiNotReady] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [viewProduct, setViewProduct] = useState<Product | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)

  const [rejectModal, setRejectModal] = useState<{
    open: boolean
    productId: string
    productName: string
  }>({ open: false, productId: "", productName: "" })
  const [rejectReason, setRejectReason] = useState("")

  const loadProducts = useCallback(async (filterStatus: string) => {
    try {
      setApiNotReady(false)
      setLoading(true)
      const token = await getAccessToken()
      if (!token) return
      const res = await getAdminProducts(token, filterStatus, 0, 200)
      setProducts(res.content)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setApiNotReady(true)
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to load products")
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === "authenticated") loadProducts(statusFilter)
    else setLoading(false)
  }, [sessionStatus, statusFilter, loadProducts])

  const handleApprove = useCallback(async (product: Product) => {
    const token = await getAccessToken()
    if (!token) return
    setActionLoading(product.id)
    try {
      await approveProduct(token, product.id)
      toast.success(`"${product.title}" has been approved`)
      if (viewProduct?.id === product.id) setViewProduct(null)
      await loadProducts(statusFilter)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve product")
    } finally {
      setActionLoading(null)
    }
  }, [viewProduct, statusFilter, loadProducts])

  function openRejectModal(product: Product) {
    setRejectReason("")
    setRejectModal({ open: true, productId: product.id, productName: product.title })
  }

  function closeRejectModal() {
    setRejectModal({ open: false, productId: "", productName: "" })
  }

  async function handleReject() {
    if (!rejectReason.trim()) return
    const token = await getAccessToken()
    if (!token) return
    setActionLoading(rejectModal.productId)
    try {
      await rejectProduct(token, rejectModal.productId, rejectReason.trim())
      toast.success(`"${rejectModal.productName}" has been rejected`)
      closeRejectModal()
      if (viewProduct?.id === rejectModal.productId) setViewProduct(null)
      await loadProducts(statusFilter)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject product")
    } finally {
      setActionLoading(null)
    }
  }

  const columns = useMemo(
    () => [
      col.accessor("images", {
        header: "Image",
        cell: (info) => {
          const imgs = info.getValue()
          return imgs?.[0] ? (
            <img
              src={imgs[0].url}
              alt={imgs[0].altText ?? ""}
              className="h-10 w-10 rounded-lg object-cover border border-white/10"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 border border-white/10">
              <ImageOff className="h-4 w-4 text-gray-600" />
            </div>
          )
        },
        enableSorting: false,
        size: 60,
      }),
      col.accessor("title", {
        header: "Product Name",
        cell: (info) => (
          <span className="font-medium text-white">{info.getValue()}</span>
        ),
      }),
      col.accessor("categories", {
        header: "Category",
        cell: (info) => {
          const cats = info.getValue()
          return (
            <span className="text-gray-400">
              {cats?.[0]?.name ?? "—"}
            </span>
          )
        },
        enableSorting: false,
      }),
      col.accessor("variants", {
        id: "price",
        header: "Price",
        cell: (info) => {
          const variants = info.getValue()
          const price = variants?.[0]?.price
          return (
            <span className="text-gray-300">
              {price != null ? formatPrice(price) : "—"}
            </span>
          )
        },
        enableSorting: false,
      }),
      col.display({
        id: "stock",
        header: "Stock",
        cell: (info) => {
          const qty = totalStock(info.row.original)
          return (
            <span
              className={
                qty === 0
                  ? "text-red-400"
                  : qty <= 5
                    ? "text-yellow-400"
                    : "text-gray-300"
              }
            >
              {qty}
            </span>
          )
        },
      }),
      col.accessor("status", {
        header: "Status",
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      col.accessor("createdAt", {
        header: "Created",
        cell: (info) => (
          <span className="text-gray-400">{formatDate(info.getValue())}</span>
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        cell: (info) => {
          const product = info.row.original
          const st = product.status.toLowerCase()
          const busy = actionLoading === product.id

          const actions: RowAction[] = [
            {
              label: "View Details",
              icon: <Eye />,
              onClick: () => {
                setGalleryIndex(0)
                setViewProduct(product)
              },
            },
            {
              label: "Approve",
              icon: <CheckCircle />,
              onClick: () => handleApprove(product),
              hidden: st !== "pending_review",
              disabled: busy,
            },
            {
              label: "Reject",
              icon: <XCircle />,
              onClick: () => openRejectModal(product),
              variant: "danger",
              hidden: st !== "pending_review",
              disabled: busy,
            },
          ]

          return <RowActions actions={actions} />
        },
        enableSorting: false,
        enableHiding: false,
        size: 50,
      }),
    ],
    [actionLoading, statusFilter, handleApprove]
  )

  if (sessionStatus !== "authenticated" && !loading) {
    return (
      <div className="py-20 text-center text-gray-400">
        Sign in as admin to manage products.
      </div>
    )
  }

  if (apiNotReady) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-sm text-gray-400 mt-1">
            Review and approve product listings from sellers.
          </p>
        </div>
        <div
          className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 p-12"
          style={{ background: "hsl(0 0% 11%)" }}
        >
          <Package className="h-12 w-12 text-gray-600" />
          <div className="text-center">
            <p className="text-white font-medium">
              Product approval API not connected yet
            </p>
            <p className="text-sm text-gray-400 mt-1">
              The admin products endpoint is not available. Ensure the backend
              service is running and the endpoint is deployed.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const _panelOpen = viewProduct !== null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-sm text-gray-400 mt-1">
            Review and approve product listings from sellers.
          </p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-gray-300 outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          style={{ background: "hsl(0 0% 11%)" }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-[hsl(0_0%_11%)] text-gray-300"
            >
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={products}
        loading={loading}
        searchPlaceholder="Search products…"
        searchColumn="title"
        enableExport
        exportFilename="admin-products"
        emptyMessage="No products found for this filter."
      />

      {/* ── Detail Slide-Over Panel ─────────────────────────────────── */}
      <ProductDetailPanel
        product={viewProduct}
        galleryIndex={galleryIndex}
        setGalleryIndex={setGalleryIndex}
        actionLoading={actionLoading}
        onClose={() => setViewProduct(null)}
        onApprove={handleApprove}
        onReject={openRejectModal}
      />

      {/* ── Reject Reason Dialog ───────────────────────────────────── */}
      <Dialog open={rejectModal.open} onClose={closeRejectModal}>
        <DialogHeader onClose={closeRejectModal}>Reject Product</DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-400 mb-4">
            Provide a reason for rejecting{" "}
            <span className="text-white font-medium">
              {rejectModal.productName}
            </span>
            . This will be visible to the seller.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection…"
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/30 resize-none"
          />
        </DialogBody>
        <DialogFooter>
          <button
            onClick={closeRejectModal}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={
              !rejectReason.trim() || actionLoading === rejectModal.productId
            }
            className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === rejectModal.productId && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            Reject Product
          </button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

/* ─── Product Detail Slide-Over Panel ─────────────────────────────────────── */

function ProductDetailPanel({
  product,
  galleryIndex,
  setGalleryIndex,
  actionLoading,
  onClose,
  onApprove,
  onReject,
}: {
  product: Product | null
  galleryIndex: number
  setGalleryIndex: (i: number | ((prev: number) => number)) => void
  actionLoading: string | null
  onClose: () => void
  onApprove: (p: Product) => void
  onReject: (p: Product) => void
}) {
  const st = product?.status.toLowerCase()
  const canAct = st === "pending_review"
  const busy = product ? actionLoading === product.id : false

  return (
    <Sheet open={product !== null} onClose={onClose}>
      <SheetHeader onClose={onClose}>Product Details</SheetHeader>
      <SheetBody className="space-y-6">
        {product && (
          <>
            {product.images.length > 0 ? (
              <div className="space-y-3">
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/20">
                  <img
                    src={product.images[galleryIndex]?.url}
                    alt={product.images[galleryIndex]?.altText ?? product.title}
                    className="h-full w-full object-contain"
                  />
                  {product.images.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setGalleryIndex((i: number) =>
                            i === 0 ? product.images.length - 1 : i - 1
                          )
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white/80 hover:bg-black/70 hover:text-white transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          setGalleryIndex((i: number) =>
                            i === product.images.length - 1 ? 0 : i + 1
                          )
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white/80 hover:bg-black/70 hover:text-white transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                {product.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {product.images.map((img, i) => (
                      <button
                        key={img.id}
                        onClick={() => setGalleryIndex(i)}
                        className={`shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition-colors ${
                          i === galleryIndex
                            ? "border-primary"
                            : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <img
                          src={img.url}
                          alt={img.altText ?? ""}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <ImageOff className="h-10 w-10 text-gray-600" />
              </div>
            )}

            <Section title="Product Information">
              <InfoTable>
                <InfoRow label="Title" value={product.title} />
                <InfoRow label="Slug" value={product.slug} mono />
                <InfoRow label="Type" value={product.productType || "—"} />
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-400">Status</span>
                  <StatusBadge status={product.status} />
                </div>
                <InfoRow label="Created" value={formatDate(product.createdAt)} />
                {product.publishedAt && (
                  <InfoRow label="Published" value={formatDate(product.publishedAt)} />
                )}
              </InfoTable>
              {product.description && (
                <div
                  className="mt-3 rounded-xl border border-white/5 px-4 py-3"
                  style={{ background: "hsl(0 0% 11%)" }}
                >
                  <p className="text-xs text-gray-500 mb-1">Description</p>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {product.description}
                  </p>
                </div>
              )}
            </Section>

            <Section title={`Variants (${product.variants.length})`}>
              {product.variants.length === 0 ? (
                <p className="text-sm text-gray-500">No variants.</p>
              ) : (
                <div className="space-y-2">
                  {product.variants.map((v) => (
                    <div
                      key={v.id}
                      className="rounded-xl border border-white/5 px-4 py-3"
                      style={{ background: "hsl(0 0% 11%)" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-white">{v.name || "Default"}</p>
                        <span className="text-sm font-semibold text-emerald-400">{formatPrice(v.price)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Hash className="h-3 w-3" />
                          SKU: <span className="text-gray-300 font-mono">{v.sku}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <BoxesIcon className="h-3 w-3" />
                          Stock:{" "}
                          <span
                            className={
                              v.stockQuantity === 0
                                ? "text-red-400"
                                : v.stockQuantity <= 5
                                  ? "text-yellow-400"
                                  : "text-gray-300"
                            }
                          >
                            {v.stockQuantity}
                          </span>
                        </div>
                        {v.compareAtPrice != null && (
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <DollarSign className="h-3 w-3" />
                            Compare: <span className="text-gray-300 line-through">{formatPrice(v.compareAtPrice)}</span>
                          </div>
                        )}
                        {v.weightKg != null && (
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <Weight className="h-3 w-3" />
                            Weight: <span className="text-gray-300">{v.weightKg} kg</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {product.categories.length > 0 && (
              <Section title="Categories">
                <div className="flex flex-wrap gap-2">
                  {product.categories.map((cat) => (
                    <span
                      key={cat.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300"
                    >
                      <Tag className="h-3 w-3 text-gray-500" />
                      {cat.name}
                    </span>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </SheetBody>
      {product && canAct && (
        <SheetFooter>
          <button
            onClick={() => onReject(product)}
            disabled={busy}
            className="rounded-xl bg-red-600/20 px-5 py-2.5 text-sm font-medium text-red-400 hover:bg-red-600/30 disabled:opacity-50 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={() => onApprove(product)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Approve
          </button>
        </SheetFooter>
      )}
    </Sheet>
  )
}

/* ─── Shared micro-components ─────────────────────────────────────────────── */

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </section>
  )
}

function InfoTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border border-white/5 divide-y divide-white/5"
      style={{ background: "hsl(0 0% 11%)" }}
    >
      {children}
    </div>
  )
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-400">{label}</span>
      <span
        className={`text-sm text-right max-w-[60%] truncate text-gray-200 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </span>
    </div>
  )
}
