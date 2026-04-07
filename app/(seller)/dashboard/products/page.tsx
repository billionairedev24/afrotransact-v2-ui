"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  Plus, Package, Eye, Pencil, Trash2, Loader2, ImageIcon, Save, X,
  Upload, Star, AlertCircle, Send, FileSpreadsheet,
} from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/DataTable"
import { RowActions, type RowAction } from "@/components/ui/RowActions"
import { Sheet, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/Sheet"
import { ConfirmDialog } from "@/components/ui/Dialog"
import { createColumnHelper } from "@tanstack/react-table"
import { getAccessToken } from "@/lib/auth-helpers"
import { logError } from "@/lib/errors"
import {
  getCurrentSeller,
  getSellerStores,
  getStoreProducts,
  getProductById,
  getCategories,
  updateProduct,
  deleteProduct,
  addProductImage,
  deleteProductImage,
  updateVariant,
  deleteVariant,
  type Product,
  type CategoryRef,
} from "@/lib/api"
import { useUploadThing } from "@/lib/uploadthing"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:         { label: "Active",         className: "bg-emerald-50 text-emerald-700" },
  pending_review: { label: "Pending Review", className: "bg-yellow-50 text-yellow-700" },
  draft:          { label: "Draft",          className: "bg-gray-100 text-gray-600" },
  rejected:       { label: "Rejected",       className: "bg-red-50 text-red-700" },
  archived:       { label: "Archived",       className: "bg-gray-100 text-gray-600" },
}

interface FlatProduct {
  id: string
  title: string
  slug: string
  imageUrl: string | null
  category: string
  status: string
  price: number | null
  stock: number
  variantCount: number
}

const col = createColumnHelper<FlatProduct>()

export default function ProductsPage() {
  const { status } = useSession()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [_storeId, setStoreId] = useState<string | null>(null)

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view")
  const [deleteTarget, setDeleteTarget] = useState<FlatProduct | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loadProducts = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) return
    try {
      const seller = await getCurrentSeller(token)
      const stores = await getSellerStores(token, seller.id)
      if (stores.length === 0) return
      setStoreId(stores[0].id)
      const page = await getStoreProducts(stores[0].id, 0, 200)
      setProducts(page.content)
    } catch {
      toast.error("Failed to load products")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setLoading(false)
      return
    }
    loadProducts()
  }, [status, loadProducts])

  const flatProducts = useMemo<FlatProduct[]>(
    () =>
      products.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        imageUrl: p.images[0]?.url ?? null,
        category: p.categories[0]?.name || p.productType,
        status: p.status,
        price: p.variants[0]?.price ?? null,
        stock: p.variants.reduce((s, v) => s + v.stockQuantity, 0),
        variantCount: p.variants.length,
      })),
    [products],
  )

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      await deleteProduct(token, deleteTarget.id)
      toast.success("Product archived")
      setDeleteTarget(null)
      await loadProducts()
    } catch (e) {
      logError(e, "deleting product")
      toast.error("Failed to delete product")
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleQuickSubmitForReview = useCallback(async (productId: string) => {
    try {
      const token = await getAccessToken()
      if (!token) return
      await updateProduct(token, productId, { status: "pending_review" })
      toast.success("Product submitted for review")
      await loadProducts()
    } catch (e) {
      logError(e, "submitting product for review")
      toast.error("Failed to submit")
    }
  }, [loadProducts])

  const columns = useMemo(
    () => [
      col.accessor("title", {
        header: "Product",
        cell: (info) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-50 overflow-hidden">
              {info.row.original.imageUrl ? (
                <img src={info.row.original.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Package className="h-5 w-5 text-gray-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{info.getValue()}</p>
              <p className="text-xs text-gray-500">{info.row.original.category}</p>
            </div>
          </div>
        ),
      }),
      col.accessor("status", {
        header: "Status",
        cell: (info) => {
          const b = STATUS_BADGE[info.getValue()] ?? STATUS_BADGE.draft
          return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${b.className}`}>{b.label}</span>
        },
      }),
      col.accessor("price", {
        header: "Price",
        cell: (info) => {
          const v = info.getValue()
          return <span className="text-gray-900">{v != null ? `$${v.toFixed(2)}` : "—"}</span>
        },
      }),
      col.accessor("stock", {
        header: "Stock",
        cell: (info) => {
          const v = info.getValue()
          const color = v === 0 ? "text-red-600" : v < 20 ? "text-yellow-600" : "text-gray-600"
          return <span className={color}>{v}</span>
        },
      }),
      col.accessor("variantCount", {
        header: "Variants",
        cell: (info) => <span className="text-gray-500">{info.getValue()}</span>,
      }),
      col.display({
        id: "actions",
        header: "",
        cell: (info) => {
          const row = info.row.original
          const canSubmit = row.status === "draft" || row.status === "rejected"
          const actions: RowAction[] = [
            {
              label: "View Details",
              icon: <Eye />,
              onClick: () => {
                setDetailMode("view")
                setSelectedProductId(row.id)
              },
            },
            {
              label: "Submit for Review",
              icon: <Send />,
              onClick: () => handleQuickSubmitForReview(row.id),
              hidden: !canSubmit,
            },
            {
              label: "Edit",
              icon: <Pencil />,
              onClick: () => {
                setDetailMode("edit")
                setSelectedProductId(row.id)
              },
            },
            { label: "Delete", icon: <Trash2 />, variant: "danger" as const, onClick: () => setDeleteTarget(row) },
          ]
          return <RowActions actions={actions} />
        },
        enableSorting: false,
        enableHiding: false,
      }),
    ],
    [handleQuickSubmitForReview],
  )

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your product catalog</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/products/bulk-import"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Bulk Import
          </Link>
          <Link
            href="/dashboard/products/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-[#0f0f10] hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        </div>
      </div>


      <DataTable
        columns={columns}
        data={flatProducts}
        loading={loading}
        searchPlaceholder="Search products…"
        searchColumn="title"
        enableExport
        exportFilename="products"
        emptyMessage="No products yet. Add your first product to get started."
      />

      <ProductDetailSheet
        productId={selectedProductId}
        mode={detailMode}
        onClose={() => setSelectedProductId(null)}
        onUpdated={loadProducts}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This will archive the product.`}
        confirmLabel="Delete"
        loading={deleteLoading}
      />
    </div>
  )
}

/* ================================================================ */
/*  Product Detail / Edit Sheet                                      */
/* ================================================================ */

function ProductDetailSheet({
  productId,
  mode,
  onClose,
  onUpdated,
}: {
  productId: string | null
  mode: "view" | "edit"
  onClose: () => void
  onUpdated: () => void
}) {
  const [product, setProduct] = useState<Product | null>(null)
  const [_categories, setCategories] = useState<CategoryRef[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [variantDrafts, setVariantDrafts] = useState<Record<string, { sku: string; price: string; stock: string }>>({})

  const { startUpload } = useUploadThing("productImage")
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!productId) {
      setProduct(null)
      setEditing(false)
      return
    }
    setLoading(true)
    Promise.all([
      getProductById(productId),
      getCategories(),
    ])
      .then(([p, cats]) => {
        setProduct(p)
        setCategories(cats)
        setTitle(p.title)
        setDescription(p.description)
        setVariantDrafts(
          (p.variants ?? []).reduce(
            (acc, v) => ({
              ...acc,
              [v.id]: {
                sku: v.sku ?? "",
                price: String(v.price ?? ""),
                stock: String(v.stockQuantity ?? 0),
              },
            }),
            {} as Record<string, { sku: string; price: string; stock: string }>,
          ),
        )
        // Only auto-enable editing when explicitly opened in edit mode
        setEditing(mode === "edit")
      })
      .catch(() => toast.error("Failed to load product"))
      .finally(() => setLoading(false))
  }, [productId])

  async function handleSaveBasicInfo() {
    if (!product) return
    setSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const updated = await updateProduct(token, product.id, {
        title: title.trim(),
        description: description.trim(),
      })

      // Save variants (stock/price/sku) as part of Save Product
      for (const v of product.variants ?? []) {
        const draft = variantDrafts[v.id]
        if (!draft) continue
        await updateVariant(token, v.id, {
          sku: draft.sku,
          name: v.name,
          price: parseFloat(draft.price) || 0,
          stockQuantity: parseInt(draft.stock, 10) || 0,
        })
      }

      const refreshed = await getProductById(product.id)
      setProduct(refreshed)
      setEditing(false)
      toast.success("Product updated")
      onUpdated()
    } catch (e) {
      logError(e, "updating product")
      toast.error("Failed to update product")
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitForReview() {
    if (!product) return
    setSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const updated = await updateProduct(token, product.id, { status: "pending_review" })
      setProduct(updated)
      toast.success("Product submitted for review")
      onUpdated()
    } catch (e) {
      logError(e, "submitting product for review")
      toast.error("Failed to submit for review")
    } finally {
      setSaving(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!product || !e.target.files?.[0]) return
    const file = e.target.files[0]
    e.target.value = ""
    setUploading(true)
    try {
      const res = await startUpload([file])
      if (res?.[0]) {
        const uploaded = res[0] as unknown as Record<string, unknown>
        const url =
          (uploaded.serverData as Record<string, string> | undefined)?.url ||
          (uploaded as Record<string, string>).ufsUrl ||
          (uploaded as Record<string, string>).url ||
          (uploaded.key ? `https://utfs.io/f/${uploaded.key}` : "")
        if (!url) throw new Error("No URL returned")
        const token = await getAccessToken()
        if (!token) return
        await addProductImage(token, product.id, { url, altText: product.title, sortOrder: product.images.length })
        const refreshed = await getProductById(product.id)
        setProduct(refreshed)
        onUpdated()
        toast.success("Image added")
      }
    } catch (e) {
      logError(e, "uploading image")
      toast.error("Failed to upload image")
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!product) return
    try {
      const token = await getAccessToken()
      if (!token) return
      await deleteProductImage(token, imageId)
      const refreshed = await getProductById(product.id)
      setProduct(refreshed)
      onUpdated()
      toast.success("Image removed")
    } catch (e) {
      logError(e, "removing image")
      toast.error("Failed to remove image")
    }
  }

  async function handleUpdateVariant(
    variantId: string,
    data: { sku: string; name?: string; price: number; stockQuantity: number },
  ) {
    if (!product) return
    try {
      const token = await getAccessToken()
      if (!token) return
      await updateVariant(token, variantId, data)
      const refreshed = await getProductById(product.id)
      setProduct(refreshed)
      onUpdated()
      toast.success("Variant updated")
    } catch (e) {
      logError(e, "updating variant")
      toast.error("Failed to update variant")
    }
  }

  async function handleDeleteVariant(variantId: string) {
    if (!product || product.variants.length <= 1) {
      toast.error("Cannot delete the last variant")
      return
    }
    try {
      const token = await getAccessToken()
      if (!token) return
      await deleteVariant(token, variantId)
      const refreshed = await getProductById(product.id)
      setProduct(refreshed)
      onUpdated()
      toast.success("Variant deleted")
    } catch (e) {
      logError(e, "deleting variant")
      toast.error("Failed to delete variant")
    }
  }

  const statusBadge = product ? STATUS_BADGE[product.status] ?? STATUS_BADGE.draft : null

  return (
    <Sheet open={!!productId} onClose={onClose}>
      <SheetHeader onClose={onClose}>
        {loading ? "Loading…" : product ? product.title : "Product Details"}
      </SheetHeader>

      <SheetBody className="space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
          </div>
        )}

        {!loading && product && (
          <>
            {/* ─── Status badge ─── */}
            <div className="flex items-center justify-between">
              {statusBadge && (
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusBadge.className}`}>
                  {statusBadge.label}
                </span>
              )}
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>

            {/* ─── Status context ─── */}
            {product.status === "pending_review" && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
                <p className="text-sm text-yellow-700 font-medium">Awaiting admin approval</p>
                <p className="text-xs text-yellow-600 mt-0.5">Your product has been submitted and is being reviewed. You&apos;ll be notified once it&apos;s approved.</p>
              </div>
            )}
            {product.status === "rejected" && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700 font-medium">Product was rejected</p>
                <p className="text-xs text-red-600 mt-0.5">Please review the feedback, make necessary changes, and resubmit for approval.</p>
              </div>
            )}
            {product.status === "draft" && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm text-gray-500 font-medium">Draft — not submitted</p>
                <p className="text-xs text-gray-500 mt-0.5">This product is saved as a draft. Submit it for review when you&apos;re ready.</p>
              </div>
            )}

            {/* ─── Images ─── */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Images</p>
              <div className="flex flex-wrap gap-3">
                {product.images.map((img, idx) => (
                  <div key={img.id} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200">
                    <img src={img.url} alt={img.altText || ""} className="h-full w-full object-cover" />
                    {idx === 0 && (
                      <div className="absolute bottom-0.5 left-0.5">
                        <Star className="h-3 w-3 fill-[#EAB308] text-[#EAB308]" />
                      </div>
                    )}
                    {editing && (
                      <button
                        onClick={() => handleDeleteImage(img.id)}
                        className="absolute right-0.5 top-0.5 rounded bg-black/70 p-0.5 text-white/50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {product.images.length === 0 && (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-gray-200">
                    <ImageIcon className="h-6 w-6 text-gray-500" />
                  </div>
                )}
                {editing && (
                  <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-200 text-gray-500 hover:border-[#EAB308]/40 hover:text-[#EAB308] transition-colors">
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                )}
              </div>
            </div>

            {/* ─── Basic Info ─── */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Product Information</p>

              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Title</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 focus:border-[#EAB308] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-[#EAB308] focus:outline-none resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Title</p>
                      <p className="text-sm text-gray-900">{product.title}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Category</p>
                      <p className="text-sm text-gray-600">{product.categories[0]?.name || product.productType}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Type</p>
                      <p className="text-sm text-gray-600 capitalize">{product.productType}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Created</p>
                      <p className="text-sm text-gray-600">
                        {new Date(product.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  {product.description && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Description</p>
                      <p className="text-sm text-gray-600 whitespace-pre-line">{product.description}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ─── Variants ─── */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Variants ({product.variants.length})
              </p>
              <div className="space-y-3">
                {product.variants.map((v) => (
                  <VariantCard
                    key={v.id}
                    variant={v}
                    editing={editing}
                    canDelete={product.variants.length > 1}
                    draft={variantDrafts[v.id] ?? { sku: v.sku, price: String(v.price), stock: String(v.stockQuantity) }}
                    onDraftChange={(next) =>
                      setVariantDrafts((prev) => ({ ...prev, [v.id]: { ...prev[v.id], ...next } }))
                    }
                    onDelete={() => handleDeleteVariant(v.id)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </SheetBody>

      {product && (
        <SheetFooter>
          {editing ? (
            <>
              <button
                onClick={() => {
                  setEditing(false)
                  setTitle(product.title)
                  setDescription(product.description)
                  setVariantDrafts(
                    (product.variants ?? []).reduce(
                      (acc, v) => ({
                        ...acc,
                        [v.id]: { sku: v.sku ?? "", price: String(v.price ?? ""), stock: String(v.stockQuantity ?? 0) },
                      }),
                      {} as Record<string, { sku: string; price: string; stock: string }>,
                    ),
                  )
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBasicInfo}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#EAB308] px-4 py-2 text-sm font-semibold text-black hover:bg-[#CA8A04] disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Changes
              </button>
            </>
          ) : (
            <>
              {(product.status === "draft" || product.status === "rejected") && (
                <button
                  onClick={handleSubmitForReview}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#EAB308] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#CA8A04] disabled:opacity-50 transition-colors"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Submit for Review
                </button>
              )}
              {product.status === "pending_review" && (
                <span className="inline-flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-2.5 text-sm font-medium text-yellow-700">
                  <AlertCircle className="h-4 w-4" />
                  Awaiting Admin Approval
                </span>
              )}
              {product.status === "active" && (
                <span className="inline-flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm font-medium text-green-700">
                  <Star className="h-4 w-4" />
                  Approved &amp; Live
                </span>
              )}
            </>
          )}
        </SheetFooter>
      )}
    </Sheet>
  )
}

/* ================================================================ */
/*  Variant Card (inline editing)                                    */
/* ================================================================ */

function VariantCard({
  variant,
  editing,
  canDelete,
  draft,
  onDraftChange,
  onDelete,
}: {
  variant: { id: string; sku: string; name: string; price: number; compareAtPrice: number | null; stockQuantity: number; currency: string; options: string | null }
  editing: boolean
  canDelete: boolean
  draft: { sku: string; price: string; stock: string }
  onDraftChange: (next: Partial<{ sku: string; price: string; stock: string }>) => void
  onDelete: () => void
}) {
  const stockColor =
    variant.stockQuantity === 0 ? "text-red-600" : variant.stockQuantity < 20 ? "text-yellow-600" : "text-gray-600"

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{variant.name || "Default"}</span>
          <span className="text-xs text-gray-500 font-mono">{variant.sku}</span>
        </div>
        {editing && canDelete && (
          <button onClick={onDelete} className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="mb-0.5 block text-[10px] text-gray-500">SKU</label>
            <input
              value={draft.sku}
              onChange={(e) => onDraftChange({ sku: e.target.value })}
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-900 focus:border-[#EAB308] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-gray-500">Price ($)</label>
            <input
              type="number"
              step="0.01"
              value={draft.price}
              onChange={(e) => onDraftChange({ price: e.target.value })}
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-900 focus:border-[#EAB308] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-gray-500">Stock</label>
            <input
              type="number"
              value={draft.stock}
              onChange={(e) => onDraftChange({ stock: e.target.value })}
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-900 focus:border-[#EAB308] focus:outline-none"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-900 font-medium">${variant.price.toFixed(2)}</span>
          {variant.compareAtPrice != null && variant.compareAtPrice > variant.price && (
            <span className="text-gray-500 line-through text-xs">${variant.compareAtPrice.toFixed(2)}</span>
          )}
          <span className={stockColor}>{variant.stockQuantity} in stock</span>
          <span className="text-gray-500">{variant.currency}</span>
        </div>
      )}
    </div>
  )
}
