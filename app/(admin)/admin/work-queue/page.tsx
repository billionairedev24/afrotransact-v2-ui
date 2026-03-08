"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { toast } from "sonner"
import {
  Loader2,
  Package,
  Store,
  CheckCircle,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Tag,
  Hash,
  BoxesIcon,
  FileText,
  ExternalLink,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  CreditCard,
  AlertCircle,
  Info,
} from "lucide-react"
import {
  getAdminProducts,
  getAdminSellers,
  getAdminSellerDetail,
  approveProduct,
  rejectProduct,
  reviewAdminSeller,
  type Product,
  type SellerInfo,
  type AdminSellerDetail,
} from "@/lib/api"
import { Sheet, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/Sheet"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog"
import { cn } from "@/lib/utils"

type TabKey = "all" | "products" | "sellers"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending_review: { label: "Pending Review", className: "bg-yellow-500/20 text-yellow-400" },
  active:         { label: "Active",         className: "bg-green-500/20 text-green-400" },
  approved:       { label: "Approved",       className: "bg-green-500/20 text-green-400" },
  rejected:       { label: "Rejected",       className: "bg-red-500/20 text-red-400" },
  submitted:      { label: "Submitted",      className: "bg-blue-500/20 text-blue-400" },
  under_review:   { label: "Under Review",   className: "bg-purple-500/20 text-purple-400" },
  needs_action:   { label: "Needs Info",     className: "bg-orange-500/20 text-orange-400" },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatPrice(dollars: number) {
  return `$${dollars.toFixed(2)}`
}

export default function WorkQueuePage() {
  const { status: sessionStatus } = useSession()
  const [tab, setTab] = useState<TabKey>("all")
  const [pendingProducts, setPendingProducts] = useState<Product[]>([])
  const [pendingSellers, setPendingSellers] = useState<SellerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)

  const [selectedSeller, setSelectedSeller] = useState<AdminSellerDetail | null>(null)
  const [_sellerLoading, setSellerLoading] = useState<string | null>(null)

  const [rejectModal, setRejectModal] = useState<{
    open: boolean
    type: "product" | "seller"
    id: string
    name: string
  }>({ open: false, type: "product", id: "", name: "" })
  const [rejectReason, setRejectReason] = useState("")

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true)
      const token = await getAccessToken()
      if (!token) return

      const [productsRes, sellersRes] = await Promise.all([
        getAdminProducts(token, "pending_review", 0, 100).catch(() => ({ content: [] as Product[], totalElements: 0, totalPages: 0, number: 0, size: 0 })),
        getAdminSellers(token, undefined, 0, 100, "submitted").catch(() => ({ content: [] as SellerInfo[], totalElements: 0, totalPages: 0, number: 0, size: 0 })),
      ])

      setPendingProducts(productsRes.content)
      setPendingSellers(sellersRes.content)
    } catch {
      toast.error("Failed to load work queue")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === "authenticated") loadQueue()
    else setLoading(false)
  }, [sessionStatus, loadQueue])

  async function handleApproveProduct(product: Product) {
    const token = await getAccessToken()
    if (!token) return
    setActionLoading(product.id)
    try {
      await approveProduct(token, product.id)
      toast.success(`"${product.title}" approved`)
      if (selectedProduct?.id === product.id) setSelectedProduct(null)
      await loadQueue()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleApproveSeller(seller: SellerInfo) {
    const token = await getAccessToken()
    if (!token) return
    setActionLoading(seller.id)
    try {
      await reviewAdminSeller(token, seller.id, "approve")
      toast.success(`"${seller.businessName}" approved`)
      await loadQueue()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve")
    } finally {
      setActionLoading(null)
    }
  }

  async function openSellerReview(seller: SellerInfo) {
    const token = await getAccessToken()
    if (!token) return
    setSellerLoading(seller.id)
    try {
      const detail = await getAdminSellerDetail(token, seller.id)
      setSelectedSeller(detail)
    } catch {
      toast.error("Failed to load seller details")
    } finally {
      setSellerLoading(null)
    }
  }

  function openRejectModal(type: "product" | "seller", id: string, name: string) {
    setRejectReason("")
    setRejectModal({ open: true, type, id, name })
  }

  async function handleReject() {
    if (!rejectReason.trim()) return
    const token = await getAccessToken()
    if (!token) return
    setActionLoading(rejectModal.id)
    try {
      if (rejectModal.type === "product") {
        await rejectProduct(token, rejectModal.id, rejectReason.trim())
      } else {
        await reviewAdminSeller(token, rejectModal.id, "reject", rejectReason.trim())
      }
      toast.success(`"${rejectModal.name}" rejected`)
      setRejectModal({ open: false, type: "product", id: "", name: "" })
      if (selectedProduct?.id === rejectModal.id) setSelectedProduct(null)
      await loadQueue()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject")
    } finally {
      setActionLoading(null)
    }
  }

  const productCount = pendingProducts.length
  const sellerCount = pendingSellers.length
  const totalCount = productCount + sellerCount

  const filteredProducts = tab === "sellers" ? [] : pendingProducts
  const filteredSellers = tab === "products" ? [] : pendingSellers

  if (sessionStatus !== "authenticated" && !loading) {
    return <div className="py-20 text-center text-gray-400">Sign in as admin.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          Work Queue
          {totalCount > 0 && (
            <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white animate-pulse">
              {totalCount}
            </span>
          )}
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Items requiring your review and approval
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total Pending"
          value={totalCount}
          icon={<ClipboardList className="h-5 w-5" />}
          color="text-yellow-400"
          bg="bg-yellow-500/10"
        />
        <StatCard
          label="Product Approvals"
          value={productCount}
          icon={<Package className="h-5 w-5" />}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <StatCard
          label="Seller Applications"
          value={sellerCount}
          icon={<Store className="h-5 w-5" />}
          color="text-purple-400"
          bg="bg-purple-500/10"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-white/10 p-1" style={{ background: "hsl(0 0% 9%)" }}>
        {([
          { key: "all" as const, label: "All", count: totalCount },
          { key: "products" as const, label: "Products", count: productCount },
          { key: "sellers" as const, label: "Sellers", count: sellerCount },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/20 px-1.5 text-[10px] font-bold text-primary">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : totalCount === 0 ? (
        <div
          className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 p-12"
          style={{ background: "hsl(0 0% 11%)" }}
        >
          <CheckCircle className="h-12 w-12 text-emerald-500/50" />
          <div className="text-center">
            <p className="text-white font-medium">All caught up!</p>
            <p className="text-sm text-gray-400 mt-1">No items require your attention right now.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Product items */}
          {filteredProducts.map((product) => {
            const busy = actionLoading === product.id
            return (
              <div
                key={`product-${product.id}`}
                className="rounded-xl border border-white/10 p-4 flex items-center gap-4 cursor-pointer hover:border-white/20 transition-colors"
                style={{ background: "hsl(0 0% 11%)" }}
                onClick={() => { setGalleryIndex(0); setSelectedProduct(product) }}
              >
                <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                  {product.images?.[0]?.url ? (
                    <img src={product.images[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageOff className="h-5 w-5 text-gray-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                      <Package className="h-2.5 w-2.5" /> Product
                    </span>
                    <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium bg-yellow-500/20 text-yellow-400">
                      Pending Review
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white mt-1 truncate">{product.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {product.variants?.[0]?.price != null ? formatPrice(product.variants[0].price) : "—"} &middot; {formatDate(product.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleApproveProduct(product)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                  >
                    {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                    Approve
                  </button>
                  <button
                    onClick={() => openRejectModal("product", product.id, product.title)}
                    disabled={busy}
                    className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}

          {/* Seller items */}
          {filteredSellers.map((seller) => {
            const busy = actionLoading === seller.id
            const status = (seller.onboardingStatus ?? "submitted").toLowerCase()
            const badge = STATUS_BADGE[status] ?? STATUS_BADGE.submitted
            return (
              <div
                key={`seller-${seller.id}`}
                className="rounded-xl border border-white/10 p-4 flex items-center gap-4 cursor-pointer hover:border-white/20 transition-colors"
                style={{ background: "hsl(0 0% 11%)" }}
                onClick={() => openSellerReview(seller)}
              >
                <div className="h-14 w-14 shrink-0 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Store className="h-6 w-6 text-purple-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-400">
                      <Store className="h-2.5 w-2.5" /> Seller
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white mt-1 truncate">{seller.businessName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {seller.contactEmail ?? "—"} &middot; Applied {seller.createdAt ? formatDate(seller.createdAt) : "—"}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleApproveSeller(seller)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                  >
                    {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                    Approve
                  </button>
                  <button
                    onClick={() => openRejectModal("seller", seller.id, seller.businessName)}
                    disabled={busy}
                    className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Product detail sheet */}
      <ProductReviewSheet
        product={selectedProduct}
        galleryIndex={galleryIndex}
        setGalleryIndex={setGalleryIndex}
        actionLoading={actionLoading}
        onClose={() => setSelectedProduct(null)}
        onApprove={handleApproveProduct}
        onReject={(p) => openRejectModal("product", p.id, p.title)}
      />

      {/* Seller application review sheet */}
      <SellerReviewSheet
        seller={selectedSeller}
        actionLoading={actionLoading}
        onClose={() => setSelectedSeller(null)}
        onApprove={async () => {
          if (!selectedSeller) return
          const token = await getAccessToken()
          if (!token) return
          setActionLoading(selectedSeller.id)
          try {
            await reviewAdminSeller(token, selectedSeller.id, "approve")
            toast.success(`"${selectedSeller.businessName}" approved`)
            setSelectedSeller(null)
            await loadQueue()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to approve")
          } finally {
            setActionLoading(null)
          }
        }}
        onReject={() => {
          if (selectedSeller) openRejectModal("seller", selectedSeller.id, selectedSeller.businessName)
        }}
        onRequestInfo={async (notes) => {
          if (!selectedSeller) return
          const token = await getAccessToken()
          if (!token) return
          setActionLoading(selectedSeller.id)
          try {
            await reviewAdminSeller(token, selectedSeller.id, "request_info", undefined, notes)
            toast.success("Information requested from seller")
            setSelectedSeller(null)
            await loadQueue()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed")
          } finally {
            setActionLoading(null)
          }
        }}
      />

      {/* Reject reason dialog */}
      <Dialog open={rejectModal.open} onClose={() => setRejectModal({ ...rejectModal, open: false })}>
        <DialogHeader onClose={() => setRejectModal({ ...rejectModal, open: false })}>
          Reject {rejectModal.type === "product" ? "Product" : "Seller"}
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-400 mb-4">
            Provide a reason for rejecting{" "}
            <span className="text-white font-medium">{rejectModal.name}</span>.
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
            onClick={() => setRejectModal({ ...rejectModal, open: false })}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={!rejectReason.trim() || actionLoading === rejectModal.id}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {actionLoading === rejectModal.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Reject
          </button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

function StatCard({
  label, value, icon, color, bg,
}: {
  label: string; value: number; icon: React.ReactNode; color: string; bg: string
}) {
  return (
    <div
      className="flex items-center gap-4 rounded-xl border border-white/10 p-4"
      style={{ background: "hsl(0 0% 11%)" }}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg} ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  )
}

function ProductReviewSheet({
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
  const busy = product ? actionLoading === product.id : false

  return (
    <Sheet open={product !== null} onClose={onClose}>
      <SheetHeader onClose={onClose}>Review Product</SheetHeader>
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
                        onClick={() => setGalleryIndex((i: number) => i === 0 ? product.images.length - 1 : i - 1)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white/80 hover:bg-black/70 hover:text-white transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setGalleryIndex((i: number) => i === product.images.length - 1 ? 0 : i + 1)}
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
                          i === galleryIndex ? "border-primary" : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <img src={img.url} alt={img.altText ?? ""} className="h-full w-full object-cover" />
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

            <div
              className="rounded-xl border border-white/5 divide-y divide-white/5"
              style={{ background: "hsl(0 0% 11%)" }}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-400">Title</span>
                <span className="text-sm text-gray-200 text-right max-w-[60%] truncate">{product.title}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-400">Slug</span>
                <span className="text-xs text-gray-200 font-mono text-right max-w-[60%] truncate">{product.slug}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-400">Type</span>
                <span className="text-sm text-gray-200">{product.productType || "—"}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-400">Created</span>
                <span className="text-sm text-gray-200">{formatDate(product.createdAt)}</span>
              </div>
            </div>

            {product.description && (
              <div className="rounded-xl border border-white/5 px-4 py-3" style={{ background: "hsl(0 0% 11%)" }}>
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{product.description}</p>
              </div>
            )}

            {product.variants.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Variants ({product.variants.length})</h3>
                <div className="space-y-2">
                  {product.variants.map((v) => (
                    <div key={v.id} className="rounded-xl border border-white/5 px-4 py-3" style={{ background: "hsl(0 0% 11%)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-white">{v.name || "Default"}</p>
                        <span className="text-sm font-semibold text-emerald-400">{formatPrice(v.price)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Hash className="h-3 w-3" /> SKU: <span className="text-gray-300 font-mono">{v.sku}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <BoxesIcon className="h-3 w-3" /> Stock: <span className={v.stockQuantity === 0 ? "text-red-400" : "text-gray-300"}>{v.stockQuantity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {product.categories.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {product.categories.map((cat) => (
                    <span key={cat.id} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300">
                      <Tag className="h-3 w-3 text-gray-500" /> {cat.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </SheetBody>
      {product && (
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

/* ─────────────── Seller Application Review Sheet ─────────────── */

function SellerReviewSheet({
  seller,
  actionLoading,
  onClose,
  onApprove,
  onReject,
  onRequestInfo,
}: {
  seller: AdminSellerDetail | null
  actionLoading: string | null
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  onRequestInfo: (notes: string) => void
}) {
  const [adminNotes, setAdminNotes] = useState("")
  const [showInfoForm, setShowInfoForm] = useState(false)

  useEffect(() => {
    if (seller) {
      setAdminNotes("")
      setShowInfoForm(false)
    }
  }, [seller])

  if (!seller) return null

  const busy = actionLoading === seller.id
  const sectionCls = "border-t border-white/5 pt-4 mt-4"
  const labelCls = "text-xs font-medium text-gray-500 uppercase tracking-wider"
  const valueCls = "text-sm text-gray-200"
  const fieldCls = "flex items-start gap-3 text-sm"

  return (
    <Sheet open={true} onClose={onClose}>
      <SheetHeader onClose={onClose}>
        <span className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          Seller Application Review
        </span>
      </SheetHeader>
      <div className="px-6 pb-2 -mt-1">
        <p className="text-sm text-gray-400">{seller.businessName} — submitted {seller.submittedAt ? new Date(seller.submittedAt).toLocaleDateString() : "N/A"}</p>
      </div>

      <SheetBody>
        {/* Business info */}
        <div>
          <h3 className={cn(labelCls, "mb-3")}>Business Information</h3>
          <div className="space-y-2.5">
            <div className={fieldCls}>
              <Building2 className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-medium">{seller.businessName}</p>
                <p className="text-xs text-gray-500">{seller.entityType || "N/A"} · {seller.businessType || "N/A"}</p>
              </div>
            </div>
            {seller.businessDescription && (
              <div className={fieldCls}>
                <Info className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                <p className={valueCls}>{seller.businessDescription}</p>
              </div>
            )}
            {seller.taxId && (
              <div className={fieldCls}>
                <Hash className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                <p className={valueCls}>EIN / Tax ID: {seller.taxId}</p>
              </div>
            )}
            <div className={fieldCls}>
              <MapPin className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
              <p className={valueCls}>{seller.businessAddress || "No address"}</p>
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div className={sectionCls}>
          <h3 className={cn(labelCls, "mb-3")}>Contact</h3>
          <div className="space-y-2">
            {seller.contactEmail && (
              <div className={fieldCls}>
                <Mail className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                <a href={`mailto:${seller.contactEmail}`} className="text-primary hover:underline text-sm">{seller.contactEmail}</a>
              </div>
            )}
            {seller.contactPhone && (
              <div className={fieldCls}>
                <Phone className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                <p className={valueCls}>{seller.contactPhone}</p>
              </div>
            )}
            {seller.website && (
              <div className={fieldCls}>
                <Globe className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                <a href={seller.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm inline-flex items-center gap-1">
                  {seller.website} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Stripe / payment info */}
        <div className={sectionCls}>
          <h3 className={cn(labelCls, "mb-3")}>Payment & Stripe</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-[10px] text-gray-500 uppercase font-medium">Stripe Connected</p>
              <p className={cn("text-sm font-medium mt-1", seller.stripeAccountId ? "text-emerald-400" : "text-yellow-400")}>
                {seller.stripeAccountId ? "Yes" : "Not yet"}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-[10px] text-gray-500 uppercase font-medium">Charges Enabled</p>
              <p className={cn("text-sm font-medium mt-1", seller.chargesEnabled ? "text-emerald-400" : "text-gray-400")}>
                {seller.chargesEnabled ? "Yes" : "No"}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-[10px] text-gray-500 uppercase font-medium">Payouts Enabled</p>
              <p className={cn("text-sm font-medium mt-1", seller.payoutsEnabled ? "text-emerald-400" : "text-gray-400")}>
                {seller.payoutsEnabled ? "Yes" : "No"}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-[10px] text-gray-500 uppercase font-medium">Commission Rate</p>
              <p className="text-sm font-medium mt-1 text-white">{(seller.commissionRate * 100).toFixed(1)}%</p>
            </div>
          </div>
          {seller.stripeAccountId && (
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
              <CreditCard className="h-3 w-3" /> {seller.stripeAccountId}
            </p>
          )}
        </div>

        {/* Stores */}
        {seller.stores && seller.stores.length > 0 && (
          <div className={sectionCls}>
            <h3 className={cn(labelCls, "mb-3")}>Stores</h3>
            <div className="space-y-2">
              {seller.stores.map((store) => (
                <div key={store.id} className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-3">
                  {store.logoUrl ? (
                    <img src={store.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                      <Store className="h-5 w-5 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{store.name}</p>
                    <p className="text-xs text-gray-500">/{store.slug}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents */}
        {seller.documents && seller.documents.length > 0 && (
          <div className={sectionCls}>
            <h3 className={cn(labelCls, "mb-3")}>Submitted Documents ({seller.documents.length})</h3>
            <div className="space-y-2">
              {seller.documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-colors group"
                >
                  <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{doc.fileName || doc.documentType}</p>
                    <p className="text-[10px] text-gray-500 uppercase">{doc.documentType.replace(/_/g, " ")}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-gray-500 group-hover:text-primary transition-colors shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Onboarding progress */}
        <div className={sectionCls}>
          <h3 className={cn(labelCls, "mb-3")}>Onboarding Progress</h3>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (seller.onboardingStep / 7) * 100)}%` }} />
            </div>
            <span className="text-xs text-gray-400">Step {seller.onboardingStep}/7</span>
          </div>
          <p className="text-xs text-gray-500 mt-2 capitalize">Status: {seller.onboardingStatus.replace(/_/g, " ")}</p>
        </div>

        {/* Previous admin notes / rejection */}
        {(seller.rejectionReason || seller.adminNotes) && (
          <div className={sectionCls}>
            <h3 className={cn(labelCls, "mb-3 flex items-center gap-1.5")}>
              <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
              Previous Notes
            </h3>
            {seller.rejectionReason && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 mb-2">
                <p className="text-xs font-medium text-red-400 mb-1">Rejection Reason</p>
                <p className="text-sm text-gray-300">{seller.rejectionReason}</p>
              </div>
            )}
            {seller.adminNotes && (
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
                <p className="text-xs font-medium text-yellow-400 mb-1">Admin Notes</p>
                <p className="text-sm text-gray-300">{seller.adminNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Request info form */}
        {showInfoForm && (
          <div className={sectionCls}>
            <h3 className={cn(labelCls, "mb-3")}>Request Additional Information</h3>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={4}
              placeholder="Describe what information you need from the seller..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/25"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { setShowInfoForm(false); setAdminNotes("") }}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                disabled={!adminNotes.trim() || busy}
                onClick={() => onRequestInfo(adminNotes.trim())}
                className="rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-500 disabled:opacity-50"
              >
                Send Request
              </button>
            </div>
          </div>
        )}
      </SheetBody>

      <SheetFooter>
        <div className="flex items-center gap-2 w-full">
          {!showInfoForm && (
            <button
              onClick={() => setShowInfoForm(true)}
              className="rounded-xl border border-yellow-500/30 px-4 py-2.5 text-sm font-medium text-yellow-400 hover:bg-yellow-500/10 transition-colors"
            >
              Request Info
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onReject}
            disabled={busy}
            className="rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Approve
          </button>
        </div>
      </SheetFooter>
    </Sheet>
  )
}
