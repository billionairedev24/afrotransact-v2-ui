"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Plus,
  Trash2,
  ImageIcon,
  Upload,
  Save,
  Loader2,
  AlertCircle,
  X,
  Star,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getCurrentSeller,
  getSellerStores,
  getCategories,
  createProduct,
  addProductImage,
  type CategoryRef,
  type StoreDetail,
} from "@/lib/api"
import { useUploadThing } from "@/lib/uploadthing"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface VariantOptionRow {
  id: string
  key: string
  value: string
}

interface VariantRow {
  id: string
  name: string
  sku: string
  price: string
  compareAtPrice: string
  stockQuantity: string
  options: VariantOptionRow[]
  imagePreview: string
  imageUrl: string
  imageStatus: "none" | "uploading" | "done" | "error"
}

interface AttributePair {
  id: string
  key: string
  value: string
}

interface ProductImageEntry {
  id: string
  file: File
  preview: string
  url?: string
  status: "pending" | "uploading" | "done" | "error"
  error?: string
  isPrimary: boolean
}

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                */
/* ------------------------------------------------------------------ */

const MAX_IMAGES = 8
const MAX_TAGS = 10

const WEIGHT_UNITS = [
  { value: "lb", label: "lb" },
  { value: "kg", label: "kg" },
  { value: "oz", label: "oz" },
  { value: "g", label: "g" },
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function convertToKg(value: number, unit: string): number {
  switch (unit) {
    case "lb":
      return value * 0.453592
    case "oz":
      return value * 0.0283495
    case "g":
      return value * 0.001
    default:
      return value
  }
}

function defaultVariant(): VariantRow {
  return {
    id: uid(),
    name: "Default",
    sku: "",
    price: "",
    compareAtPrice: "",
    stockQuantity: "",
    options: [],
    imagePreview: "",
    imageUrl: "",
    imageStatus: "none",
  }
}

const CARD = "rounded-2xl border border-white/10 bg-[#1a1a1a] p-6"

function inputCls(error?: string) {
  return cn(
    "h-10 w-full rounded-lg border bg-white/5 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 transition-colors",
    error
      ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/50"
      : "border-white/10 focus:border-[#d4a853] focus:ring-[#d4a853]/50",
  )
}

function textareaCls(error?: string) {
  return cn(
    "w-full rounded-lg border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 transition-colors resize-none",
    error
      ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/50"
      : "border-white/10 focus:border-[#d4a853] focus:ring-[#d4a853]/50",
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-400">{msg}</p>
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function NewProductPage() {
  const { status: sessionStatus } = useSession()
  const router = useRouter()

  const { startUpload: startImageUpload } = useUploadThing("productImage")

  /* ---- loading / global state ---- */
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  /* ---- reference data ---- */
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [stores, setStores] = useState<StoreDetail[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState("")

  /* ---- form fields ---- */
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [weight, setWeight] = useState("")
  const [weightUnit, setWeightUnit] = useState("lb")
  const [brand, setBrand] = useState("")
  const [productPrice, setProductPrice] = useState("")
  const [productSku, setProductSku] = useState("")
  const [productStock, setProductStock] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [submitAction, setSubmitAction] = useState<"draft" | "pending_review">("pending_review")
  const [attributes, setAttributes] = useState<AttributePair[]>([])
  const [images, setImages] = useState<ProductImageEntry[]>([])
  const [variants, setVariants] = useState<VariantRow[]>([])

  /* ---- touched tracking ---- */
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  function touch(field: string) {
    setTouched((p) => ({ ...p, [field]: true }))
  }

  /* ================================================================ */
  /*  Validation                                                       */
  /* ================================================================ */

  const errors = useMemo(() => {
    const e: Record<string, string> = {}
    if (name.trim().length < 3) e.name = "Name must be at least 3 characters"
    if (description.trim().length < 10)
      e.description = "Description must be at least 10 characters"
    if (!categoryId) e.categoryId = "Please select a category"
    if (!weight || isNaN(parseFloat(weight)) || parseFloat(weight) <= 0)
      e.weight = "Weight is required and must be a positive number"
    if (variants.length === 0) {
      const pp = parseFloat(productPrice)
      if (!productPrice.trim() || isNaN(pp) || pp <= 0) e.productPrice = "Valid price required"
      if (!productSku.trim()) e.productSku = "SKU is required"
      const ps = parseInt(productStock, 10)
      if (productStock.trim() === "" || isNaN(ps) || ps < 0) e.productStock = "Valid quantity required"
    } else {
      variants.forEach((v, i) => {
        if (!v.name.trim()) e[`v${i}_name`] = "Required"
        if (!v.sku.trim()) e[`v${i}_sku`] = "Required"
        const p = parseFloat(v.price)
        if (!v.price.trim() || isNaN(p) || p <= 0) e[`v${i}_price`] = "Valid price required"
        const sq = parseInt(v.stockQuantity, 10)
        if (v.stockQuantity.trim() === "" || isNaN(sq) || sq < 0)
          e[`v${i}_stock`] = "Valid quantity required"
        if (v.compareAtPrice.trim()) {
          const cap = parseFloat(v.compareAtPrice)
          if (isNaN(cap) || cap < 0) e[`v${i}_compare`] = "Invalid"
        }
      })
    }
    return e
  }, [name, description, categoryId, weight, variants, productPrice, productSku, productStock])

  function err(field: string): string | undefined {
    if (!submitted && !touched[field]) return undefined
    return errors[field]
  }

  const canSubmit =
    Object.keys(errors).length === 0 &&
    !saving &&
    selectedStoreId !== "" &&
    images.every((i) => i.status !== "uploading") &&
    variants.every((v) => v.imageStatus !== "uploading")

  /* ================================================================ */
  /*  Data loading                                                     */
  /* ================================================================ */

  const loadData = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) return
    setLoading(true)
    setGlobalError(null)
    try {
      const [cats, seller] = await Promise.all([getCategories(), getCurrentSeller(token)])
      setCategories(cats)
      const st = await getSellerStores(token, seller.id)
      setStores(st)
      if (st.length > 0) setSelectedStoreId(st[0].id)
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/dashboard/products/new")
      return
    }
    if (sessionStatus === "authenticated") loadData()
  }, [sessionStatus, router, loadData])

  /* ================================================================ */
  /*  Image handlers                                                   */
  /* ================================================================ */

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) return
    const selected = Array.from(files).slice(0, remaining)
    const isFirstBatch = images.length === 0
    const entries: ProductImageEntry[] = selected.map((file, idx) => ({
      id: uid(),
      file,
      preview: URL.createObjectURL(file),
      status: "pending" as const,
      isPrimary: isFirstBatch && idx === 0,
    }))
    setImages((prev) => [...prev, ...entries])
    entries.forEach((img) => doUploadImage(img))
    e.target.value = ""
  }

  async function doUploadImage(img: ProductImageEntry) {
    setImages((prev) => prev.map((i) => (i.id === img.id ? { ...i, status: "uploading" as const } : i)))
    try {
      const res = await startImageUpload([img.file])
      if (res?.[0]) {
        const uploaded = res[0] as unknown as Record<string, unknown>
        const url =
          (uploaded.serverData as Record<string, string> | undefined)?.url ||
          (uploaded as Record<string, string>).ufsUrl ||
          (uploaded as Record<string, string>).url ||
          (uploaded.key ? `https://utfs.io/f/${uploaded.key}` : "")
        if (!url) throw new Error("No URL returned from upload")
        setImages((prev) =>
          prev.map((i) => (i.id === img.id ? { ...i, url, status: "done" as const } : i)),
        )
      } else {
        throw new Error("Upload returned no results")
      }
    } catch (e) {
      setImages((prev) =>
        prev.map((i) =>
          i.id === img.id
            ? { ...i, status: "error" as const, error: e instanceof Error ? e.message : "Upload failed" }
            : i,
        ),
      )
    }
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id)
      if (target) URL.revokeObjectURL(target.preview)
      const remaining = prev.filter((i) => i.id !== id)
      if (target?.isPrimary && remaining.length > 0) {
        remaining[0] = { ...remaining[0], isPrimary: true }
      }
      return remaining
    })
  }

  function setPrimary(id: string) {
    setImages((prev) => prev.map((i) => ({ ...i, isPrimary: i.id === id })))
  }

  /* ================================================================ */
  /*  Tag handlers                                                     */
  /* ================================================================ */

  function addTag(raw: string) {
    const t = raw.trim()
    if (!t) { setTagInput(""); return }
    if (tags.length >= MAX_TAGS) { setTagInput(""); return }
    if (!tags.includes(t)) setTags((p) => [...p, t])
    setTagInput("")
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault()
      addTag(tagInput)
    }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((p) => p.slice(0, -1))
    }
  }

  /* ================================================================ */
  /*  Attribute handlers                                               */
  /* ================================================================ */

  function addAttribute() {
    setAttributes((p) => [...p, { id: uid(), key: "", value: "" }])
  }

  function updateAttribute(id: string, field: "key" | "value", val: string) {
    setAttributes((p) => p.map((a) => (a.id === id ? { ...a, [field]: val } : a)))
  }

  function removeAttribute(id: string) {
    setAttributes((p) => p.filter((a) => a.id !== id))
  }

  /* ================================================================ */
  /*  Variant handlers                                                 */
  /* ================================================================ */

  function addVariant() {
    setVariants((p) => [...p, { ...defaultVariant(), name: "" }])
  }

  function removeVariant(id: string) {
    setVariants((p) => {
      const v = p.find((v) => v.id === id)
      if (v?.imagePreview) URL.revokeObjectURL(v.imagePreview)
      return p.filter((v) => v.id !== id)
    })
  }

  function updateVariantField(id: string, field: keyof VariantRow, val: string) {
    setVariants((p) => p.map((v) => (v.id === id ? { ...v, [field]: val } : v)))
  }

  function addVariantOption(variantId: string) {
    setVariants((p) =>
      p.map((v) =>
        v.id === variantId ? { ...v, options: [...v.options, { id: uid(), key: "", value: "" }] } : v,
      ),
    )
  }

  function updateVariantOption(variantId: string, optId: string, field: "key" | "value", val: string) {
    setVariants((p) =>
      p.map((v) =>
        v.id === variantId
          ? { ...v, options: v.options.map((o) => (o.id === optId ? { ...o, [field]: val } : o)) }
          : v,
      ),
    )
  }

  function removeVariantOption(variantId: string, optId: string) {
    setVariants((p) =>
      p.map((v) =>
        v.id === variantId ? { ...v, options: v.options.filter((o) => o.id !== optId) } : v,
      ),
    )
  }

  async function handleVariantImage(variantId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    const preview = URL.createObjectURL(file)
    setVariants((p) =>
      p.map((v) =>
        v.id === variantId ? { ...v, imagePreview: preview, imageUrl: "", imageStatus: "uploading" as const } : v,
      ),
    )
    try {
      const res = await startImageUpload([file])
      if (res?.[0]) {
        const uploaded = res[0] as unknown as Record<string, unknown>
        const url =
          (uploaded.serverData as Record<string, string> | undefined)?.url ||
          (uploaded as Record<string, string>).ufsUrl ||
          (uploaded as Record<string, string>).url ||
          (uploaded.key ? `https://utfs.io/f/${uploaded.key}` : "")
        setVariants((p) =>
          p.map((v) =>
            v.id === variantId ? { ...v, imageUrl: url, imageStatus: "done" as const } : v,
          ),
        )
      }
    } catch {
      setVariants((p) =>
        p.map((v) => (v.id === variantId ? { ...v, imageStatus: "error" as const } : v)),
      )
    }
  }

  function clearVariantImage(variantId: string) {
    setVariants((p) =>
      p.map((v) => {
        if (v.id !== variantId) return v
        if (v.imagePreview) URL.revokeObjectURL(v.imagePreview)
        return { ...v, imagePreview: "", imageUrl: "", imageStatus: "none" as const }
      }),
    )
  }

  /* ================================================================ */
  /*  Submit                                                           */
  /* ================================================================ */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length > 0) return

    const token = await getAccessToken()
    if (!token || !selectedStoreId) {
      setGlobalError("Please sign in and ensure you have a store.")
      return
    }

    if (images.some((i) => i.status === "uploading") || variants.some((v) => v.imageStatus === "uploading")) {
      setGlobalError("Please wait for all uploads to finish.")
      return
    }

    setSaving(true)
    setGlobalError(null)

    try {
      const weightNum = parseFloat(weight)
      const weightKg = convertToKg(weightNum, weightUnit)

      const attrsObj: Record<string, unknown> = {}
      attributes
        .filter((a) => a.key.trim())
        .forEach((a) => {
          attrsObj[a.key.trim()] = a.value.trim()
        })
      if (brand.trim()) attrsObj["brand"] = brand.trim()
      if (tags.length > 0) attrsObj["tags"] = tags
      attrsObj["weight"] = weightNum
      attrsObj["weightUnit"] = weightUnit

      let variantPayload
      if (variants.length > 0) {
        variantPayload = variants.map((v) => {
          const price = parseFloat(v.price)
          const compare = v.compareAtPrice.trim() ? parseFloat(v.compareAtPrice) : undefined
          const stock = parseInt(v.stockQuantity, 10)
          const optionsObj = v.options
            .filter((o) => o.key.trim())
            .reduce(
              (acc, o) => ({ ...acc, [o.key.trim()]: o.value.trim() }),
              {} as Record<string, string>,
            )
          return {
            name: v.name.trim() || undefined,
            sku: v.sku.trim(),
            price: price,
            compareAtPrice: compare !== undefined && !isNaN(compare) ? compare : undefined,
            currency: "USD",
            stockQuantity: isNaN(stock) ? 0 : stock,
            options: Object.keys(optionsObj).length > 0 ? optionsObj : undefined,
            weightKg: isNaN(weightKg) ? undefined : weightKg,
          }
        })
      } else {
        variantPayload = [{
          name: "Default",
          sku: productSku.trim(),
          price: parseFloat(productPrice),
          currency: "USD",
          stockQuantity: parseInt(productStock, 10) || 0,
          weightKg: isNaN(weightKg) ? undefined : weightKg,
        }]
      }

      const product = await createProduct(token, {
        storeId: selectedStoreId,
        title: name.trim(),
        description: description.trim(),
        productType: "physical",
        status: submitAction,
        attributes: JSON.stringify(attrsObj),
        categoryIds: [categoryId],
        variants: variantPayload,
      })

      // Add product images (primary first)
      const doneImages = images.filter((i) => i.status === "done" && i.url)
      const sorted = [...doneImages].sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0))
      for (let i = 0; i < sorted.length; i++) {
        const img = sorted[i]
        if (img.url) {
          await addProductImage(token, product.id, {
            url: img.url,
            altText: name.trim(),
            sortOrder: i,
          })
        }
      }

      // Add variant images as product images
      const variantImgStart = sorted.length
      let vIdx = 0
      for (const v of variants) {
        if (v.imageUrl) {
          await addProductImage(token, product.id, {
            url: v.imageUrl,
            altText: `${name.trim()} - ${v.name.trim()}`,
            sortOrder: variantImgStart + vIdx,
          })
          vIdx++
        }
      }

      router.push("/dashboard/products")
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to create product")
    } finally {
      setSaving(false)
    }
  }

  /* ================================================================ */
  /*  Loading / auth guard                                             */
  /* ================================================================ */

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#d4a853]" />
      </div>
    )
  }

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/products"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Create Product</h1>
          <p className="mt-0.5 text-sm text-white/50">Add a new product to your store</p>
        </div>
      </div>

      {/* Global error */}
      {globalError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {globalError}
        </div>
      )}

      {/* No store message */}
      {stores.length === 0 && !loading && (
        <div className={CARD}>
          <p className="text-sm text-white/50">
            You need to create a store before adding products.{" "}
            <Link href="/dashboard/store" className="text-[#d4a853] hover:underline">
              Go to Store Settings
            </Link>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Store selector */}
        {stores.length > 1 && (
          <section className={CARD}>
            <h2 className="text-lg font-semibold text-white">Store</h2>
            <p className="mt-1 text-sm text-white/50">Select the store for this product</p>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className={cn(inputCls(), "mt-4 max-w-md")}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </section>
        )}

        {/* ─── Section 1: Basic Info ─── */}
        <section className={CARD}>
          <h2 className="text-lg font-semibold text-white">Basic Information</h2>
          <p className="mt-1 text-sm text-white/50">Core product details</p>

          <div className="mt-6 space-y-5">
            {/* Product Name */}
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-white">
                Product Name <span className="text-red-400">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => touch("name")}
                placeholder="e.g. Organic Shea Butter"
                className={inputCls(err("name"))}
              />
              <FieldError msg={err("name")} />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="desc" className="mb-1.5 block text-sm font-medium text-white">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                id="desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => touch("description")}
                placeholder="Describe your product in detail…"
                className={textareaCls(err("description"))}
              />
              <FieldError msg={err("description")} />
            </div>

            {/* Brand */}
            <div>
              <label htmlFor="brand" className="mb-1.5 block text-sm font-medium text-white">
                Brand
              </label>
              <input
                id="brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Afrot Naturals"
                className={inputCls()}
              />
            </div>

            {/* Weight + Unit */}
            <div>
              <label htmlFor="weight" className="mb-1.5 block text-sm font-medium text-white">
                Weight <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="weight"
                  type="number"
                  step="0.01"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  onBlur={() => touch("weight")}
                  placeholder="0.00"
                  className={cn(inputCls(err("weight")), "flex-1")}
                />
                <select
                  value={weightUnit}
                  onChange={(e) => setWeightUnit(e.target.value)}
                  className={cn(inputCls(), "w-20")}
                >
                  {WEIGHT_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              <FieldError msg={err("weight")} />
            </div>

            {/* Pricing & Stock (shown when no variants) */}
            {variants.length === 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="productPrice" className="mb-1.5 block text-sm font-medium text-white">
                    Price ($) <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="productPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    onBlur={() => touch("productPrice")}
                    placeholder="0.00"
                    className={inputCls(err("productPrice"))}
                  />
                  <FieldError msg={err("productPrice")} />
                </div>
                <div>
                  <label htmlFor="productSku" className="mb-1.5 block text-sm font-medium text-white">
                    SKU <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="productSku"
                    type="text"
                    value={productSku}
                    onChange={(e) => setProductSku(e.target.value)}
                    onBlur={() => touch("productSku")}
                    placeholder="SKU-001"
                    className={inputCls(err("productSku"))}
                  />
                  <FieldError msg={err("productSku")} />
                </div>
                <div>
                  <label htmlFor="productStock" className="mb-1.5 block text-sm font-medium text-white">
                    Stock Quantity <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="productStock"
                    type="number"
                    min="0"
                    value={productStock}
                    onChange={(e) => setProductStock(e.target.value)}
                    onBlur={() => touch("productStock")}
                    placeholder="0"
                    className={inputCls(err("productStock"))}
                  />
                  <FieldError msg={err("productStock")} />
                </div>
              </div>
            )}

            {/* Status info */}
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
              <p className="text-sm text-yellow-400 font-medium">Product will be submitted for review</p>
              <p className="text-xs text-gray-400 mt-1">Your product will be reviewed by an admin before it appears on the marketplace.</p>
            </div>
          </div>
        </section>

        {/* ─── Section 2: Category & Tags ─── */}
        <section className={CARD}>
          <h2 className="text-lg font-semibold text-white">Category & Tags</h2>
          <p className="mt-1 text-sm text-white/50">Organize your product</p>

          <div className="mt-6 space-y-5">
            {/* Category */}
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-white">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value)
                  touch("categoryId")
                }}
                onBlur={() => touch("categoryId")}
                className={cn(
                  inputCls(err("categoryId")),
                  !categoryId && "text-white/30",
                )}
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <FieldError msg={err("categoryId")} />
            </div>

            {/* Tags */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white">Tags</label>
              <div
                className={cn(
                  "flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border bg-white/5 px-2 py-1.5 transition-colors focus-within:ring-1",
                  "border-white/10 focus-within:border-[#d4a853] focus-within:ring-[#d4a853]/50",
                )}
              >
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md border border-[#d4a853]/30 bg-[#d4a853]/10 px-2 py-0.5 text-xs font-medium text-[#d4a853]"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags((p) => p.filter((t) => t !== tag))}
                      className="text-[#d4a853]/50 hover:text-[#d4a853]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => {
                    if (tagInput.trim()) addTag(tagInput)
                  }}
                  placeholder={tags.length === 0 ? "Type and press Enter to add tags" : "Add tag…"}
                  className="min-w-[120px] flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-white/30">
                Press Enter or comma to add a tag ({tags.length}/{MAX_TAGS})
              </p>
            </div>
          </div>
        </section>

        {/* ─── Section 3: Images ─── */}
        <section className={CARD}>
          <h2 className="text-lg font-semibold text-white">Product Images</h2>
          <p className="mt-1 text-sm text-white/50">
            Upload up to {MAX_IMAGES} images. Click the star to set the main image.
          </p>

          <div className="mt-5 space-y-4">
            {/* Upload zone */}
            {images.length < MAX_IMAGES && (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 py-10 transition-colors hover:border-[#d4a853]/40 hover:bg-[#d4a853]/5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                  <Upload className="h-6 w-6 text-white/40" />
                </div>
                <p className="mt-3 text-sm font-medium text-white">Click to upload images</p>
                <p className="mt-1 text-xs text-white/40">
                  JPEG, PNG, WebP, GIF &middot; {MAX_IMAGES - images.length} remaining
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </label>
            )}

            {/* Image grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-lg border-2 bg-white/5",
                      img.isPrimary ? "border-[#d4a853]" : "border-white/10",
                    )}
                  >
                    {img.status === "done" && img.url ? (
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                    ) : img.preview ? (
                      <img src={img.preview} alt="" className="h-full w-full object-cover opacity-60" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-white/20" />
                      </div>
                    )}

                    {img.status === "uploading" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <Loader2 className="h-5 w-5 animate-spin text-[#d4a853]" />
                      </div>
                    )}

                    {img.status === "error" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      </div>
                    )}

                    {/* Primary star */}
                    <button
                      type="button"
                      onClick={() => setPrimary(img.id)}
                      className="absolute bottom-1 left-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                      style={img.isPrimary ? { opacity: 1 } : undefined}
                      title={img.isPrimary ? "Primary image" : "Set as primary"}
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          img.isPrimary
                            ? "fill-[#d4a853] text-[#d4a853]"
                            : "text-white/40 hover:text-white/70",
                        )}
                      />
                    </button>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white/50 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── Section 4: Variants (Optional) ─── */}
        <section className={CARD}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Variants</h2>
              <p className="mt-1 text-sm text-white/50">
                Optional — add variants if your product has different sizes, colors, etc.
              </p>
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Variant
            </button>
          </div>

          {variants.length === 0 ? (
            <p className="mt-5 rounded-lg border border-dashed border-white/10 py-6 text-center text-sm text-white/30">
              No variants. Your product will be listed without size/color options.
            </p>
          ) : (
          <div className="mt-5 space-y-4">
            {variants.map((variant, idx) => (
              <div
                key={variant.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                {/* Variant header */}
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/30">
                    Variant {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeVariant(variant.id)}
                    className="rounded p-1 text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Core fields grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {/* Name */}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="mb-1 block text-xs text-white/40">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={variant.name}
                      onChange={(e) => updateVariantField(variant.id, "name", e.target.value)}
                      onBlur={() => touch(`v${idx}_name`)}
                      placeholder="Default"
                      className={cn(inputCls(err(`v${idx}_name`)), "h-9")}
                    />
                    <FieldError msg={err(`v${idx}_name`)} />
                  </div>

                  {/* SKU */}
                  <div>
                    <label className="mb-1 block text-xs text-white/40">
                      SKU <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={variant.sku}
                      onChange={(e) => updateVariantField(variant.id, "sku", e.target.value)}
                      onBlur={() => touch(`v${idx}_sku`)}
                      placeholder="SKU-001"
                      className={cn(inputCls(err(`v${idx}_sku`)), "h-9")}
                    />
                    <FieldError msg={err(`v${idx}_sku`)} />
                  </div>

                  {/* Price */}
                  <div>
                    <label className="mb-1 block text-xs text-white/40">
                      Price ($) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={variant.price}
                      onChange={(e) => updateVariantField(variant.id, "price", e.target.value)}
                      onBlur={() => touch(`v${idx}_price`)}
                      placeholder="0.00"
                      className={cn(inputCls(err(`v${idx}_price`)), "h-9")}
                    />
                    <FieldError msg={err(`v${idx}_price`)} />
                  </div>

                  {/* Compare at Price */}
                  <div>
                    <label className="mb-1 block text-xs text-white/40">Compare at ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={variant.compareAtPrice}
                      onChange={(e) => updateVariantField(variant.id, "compareAtPrice", e.target.value)}
                      placeholder="0.00"
                      className={cn(inputCls(err(`v${idx}_compare`)), "h-9")}
                    />
                    <FieldError msg={err(`v${idx}_compare`)} />
                  </div>

                  {/* Stock */}
                  <div>
                    <label className="mb-1 block text-xs text-white/40">
                      Stock Qty <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={variant.stockQuantity}
                      onChange={(e) => updateVariantField(variant.id, "stockQuantity", e.target.value)}
                      onBlur={() => touch(`v${idx}_stock`)}
                      placeholder="0"
                      className={cn(inputCls(err(`v${idx}_stock`)), "h-9")}
                    />
                    <FieldError msg={err(`v${idx}_stock`)} />
                  </div>
                </div>

                {/* Options key-value pairs */}
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">Options</span>
                    <button
                      type="button"
                      onClick={() => addVariantOption(variant.id)}
                      className="text-xs text-[#d4a853] hover:underline"
                    >
                      + Add Option
                    </button>
                  </div>
                  {variant.options.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {variant.options.map((opt) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={opt.key}
                            onChange={(e) =>
                              updateVariantOption(variant.id, opt.id, "key", e.target.value)
                            }
                            placeholder="Key (e.g. Size)"
                            className="h-8 flex-1 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white placeholder:text-white/25 focus:border-[#d4a853] focus:outline-none"
                          />
                          <input
                            type="text"
                            value={opt.value}
                            onChange={(e) =>
                              updateVariantOption(variant.id, opt.id, "value", e.target.value)
                            }
                            placeholder="Value (e.g. M)"
                            className="h-8 flex-1 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white placeholder:text-white/25 focus:border-[#d4a853] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeVariantOption(variant.id, opt.id)}
                            className="text-white/25 hover:text-red-400"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Variant image */}
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <span className="mb-1.5 block text-xs text-white/40">Variant Image</span>
                  {variant.imagePreview || variant.imageUrl ? (
                    <div className="relative inline-block h-16 w-16 overflow-hidden rounded-lg border border-white/10">
                      <img
                        src={variant.imageUrl || variant.imagePreview}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      {variant.imageStatus === "uploading" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <Loader2 className="h-4 w-4 animate-spin text-[#d4a853]" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => clearVariantImage(variant.id)}
                        className="absolute right-0.5 top-0.5 rounded bg-black/70 p-0.5 text-white/50 hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-white/10 px-3 py-2 text-xs text-white/40 transition-colors hover:border-white/20 hover:text-white/60">
                      <Upload className="h-3.5 w-3.5" />
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleVariantImage(variant.id, e)}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
        </section>

        {/* ─── Section 5: Attributes ─── */}
        <section className={CARD}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Custom Attributes</h2>
              <p className="mt-1 text-sm text-white/50">
                Add key-value pairs (e.g. Origin Country, Certification)
              </p>
            </div>
            <button
              type="button"
              onClick={addAttribute}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {attributes.length === 0 ? (
            <p className="mt-5 rounded-lg border border-dashed border-white/10 py-6 text-center text-sm text-white/30">
              No attributes yet. Click Add to create one.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {attributes.map((attr) => (
                <div key={attr.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={attr.key}
                    onChange={(e) => updateAttribute(attr.id, "key", e.target.value)}
                    placeholder="Key"
                    className="h-9 flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#d4a853] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={attr.value}
                    onChange={(e) => updateAttribute(attr.id, "value", e.target.value)}
                    placeholder="Value"
                    className="h-9 flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#d4a853] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttribute(attr.id)}
                    className="rounded-md p-2 text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Submit bar ─── */}
        <div className="flex flex-col-reverse items-center justify-end gap-3 border-t border-white/10 pt-6 sm:flex-row">
          <Link
            href="/dashboard/products"
            className="w-full rounded-lg border border-white/10 px-5 py-2.5 text-center text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white sm:w-auto"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            onClick={() => setSubmitAction("draft")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {saving && submitAction === "draft" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save as Draft
              </>
            )}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            onClick={() => setSubmitAction("pending_review")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#d4a853] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#c49a48] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {saving && submitAction === "pending_review" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit for Review"
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
