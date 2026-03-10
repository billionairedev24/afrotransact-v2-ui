"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { useRouter, useParams } from "next/navigation"
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
  CheckCircle,
  X,
  Star,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getProductById,
  getCategories,
  updateProduct,
  deleteProduct,
  addProductImage,
  deleteProductImage,
  addVariant as apiAddVariant,
  updateVariant as apiUpdateVariant,
  deleteVariant as apiDeleteVariant,
  type Product,
  type ProductImage,
  type CategoryRef,
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
  apiId: string | null
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

interface UploadedImage {
  id: string
  file: File
  preview: string
  url?: string
  status: "pending" | "uploading" | "done" | "error"
  error?: string
}

interface ExistingImageDisplay extends ProductImage {
  removed?: boolean
  isPrimary?: boolean
}

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                */
/* ------------------------------------------------------------------ */

const MAX_IMAGES = 8

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

function parseOptionsToRows(jsonStr: string | null): VariantOptionRow[] {
  if (!jsonStr?.trim()) return []
  try {
    const obj = JSON.parse(jsonStr)
    if (typeof obj !== "object" || obj === null) return []
    return Object.entries(obj).map(([key, value]) => ({
      id: uid(),
      key,
      value: String(value ?? ""),
    }))
  } catch {
    return []
  }
}

const CARD = "rounded-2xl border border-gray-200 bg-white p-6"

function inputCls(error?: string) {
  return cn(
    "h-10 w-full rounded-lg border bg-gray-50 px-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors",
    error
      ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/50"
      : "border-gray-200 focus:border-[#EAB308] focus:ring-[#EAB308]/50",
  )
}

function textareaCls(error?: string) {
  return cn(
    "w-full rounded-lg border bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors resize-none",
    error
      ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/50"
      : "border-gray-200 focus:border-[#EAB308] focus:ring-[#EAB308]/50",
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-600">{msg}</p>
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function EditProductPage() {
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const { startUpload: startImageUpload } = useUploadThing("productImage")

  /* ---- loading / global ---- */
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)

  /* ---- reference data ---- */
  const [categories, setCategories] = useState<CategoryRef[]>([])

  /* ---- form fields ---- */
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [weight, setWeight] = useState("")
  const [weightUnit, setWeightUnit] = useState("lb")
  const [brand, setBrand] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [status, setStatus] = useState<"draft" | "active">("draft")
  const [attributes, setAttributes] = useState<AttributePair[]>([])
  const [existingImages, setExistingImages] = useState<ExistingImageDisplay[]>([])
  const [newImages, setNewImages] = useState<UploadedImage[]>([])
  const [variants, setVariants] = useState<VariantRow[]>([])

  /* ---- delete ---- */
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  /* ---- touched ---- */
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
    if (variants.length === 0) e.variants = "At least one variant is required"
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
    return e
  }, [name, description, categoryId, weight, variants])

  function err(field: string): string | undefined {
    if (!submitted && !touched[field]) return undefined
    return errors[field]
  }

  const canSubmit =
    Object.keys(errors).length === 0 &&
    !saving &&
    newImages.every((i) => i.status !== "uploading") &&
    variants.every((v) => v.imageStatus !== "uploading")

  /* ================================================================ */
  /*  Data loading                                                     */
  /* ================================================================ */

  const loadData = useCallback(async () => {
    const token = await getAccessToken()
    if (!token || !id) return
    setLoading(true)
    setGlobalError(null)
    try {
      const [prod, cats] = await Promise.all([getProductById(id), getCategories()])
      setProduct(prod)
      setCategories(cats)

      setName(prod.title ?? "")
      setDescription(prod.description ?? "")
      setStatus((prod.status === "active" ? "active" : "draft") as "draft" | "active")
      setCategoryId(prod.categories?.[0]?.id ?? "")

      // Parse attributes JSON for brand, tags, weight, and custom attrs
      const attrsMeta: Record<string, unknown> = {}
      const customAttrs: AttributePair[] = []
      if (prod.attributes?.trim()) {
        try {
          const obj = JSON.parse(prod.attributes)
          if (typeof obj === "object" && obj !== null) {
            for (const [k, v] of Object.entries(obj)) {
              if (k === "brand") {
                setBrand(String(v ?? ""))
              } else if (k === "tags" && Array.isArray(v)) {
                setTags(v.map(String))
              } else if (k === "weight") {
                setWeight(String(v ?? ""))
              } else if (k === "weightUnit") {
                setWeightUnit(String(v ?? "lb"))
              } else {
                customAttrs.push({ id: uid(), key: k, value: String(v ?? "") })
              }
            }
          }
        } catch {
          /* ignore parse errors */
        }
      }
      setAttributes(customAttrs)

      // If weight wasn't in attributes, try first variant
      if (!attrsMeta.weight && prod.variants?.[0]?.weightKg) {
        setWeight(String(prod.variants[0].weightKg))
        setWeightUnit("kg")
      }

      // Variants
      setVariants(
        prod.variants?.length
          ? prod.variants.map((v) => ({
              id: uid(),
              apiId: v.id,
              name: v.name ?? "",
              sku: v.sku ?? "",
              price: v.price != null ? String(v.price) : "",
              compareAtPrice: v.compareAtPrice != null ? String(v.compareAtPrice) : "",
              stockQuantity: v.stockQuantity != null ? String(v.stockQuantity) : "",
              options: parseOptionsToRows(v.options),
              imagePreview: "",
              imageUrl: "",
              imageStatus: "none" as const,
            }))
          : [
              {
                id: uid(),
                apiId: null,
                name: "Default",
                sku: "",
                price: "",
                compareAtPrice: "",
                stockQuantity: "",
                options: [],
                imagePreview: "",
                imageUrl: "",
                imageStatus: "none",
              },
            ],
      )

      // Existing images
      const imgs = (prod.images ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((img, idx) => ({
          ...img,
          removed: false,
          isPrimary: idx === 0,
        }))
      setExistingImages(imgs)
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to load product")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push(`/auth/login?callbackUrl=/dashboard/products/${id}/edit`)
      return
    }
    if (sessionStatus === "authenticated" && id) loadData()
  }, [sessionStatus, id, router, loadData])

  /* ================================================================ */
  /*  Image handlers                                                   */
  /* ================================================================ */

  const totalImageCount =
    existingImages.filter((i) => !i.removed).length + newImages.length

  function handleNewImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    const remaining = MAX_IMAGES - totalImageCount
    if (remaining <= 0) return
    const selected = Array.from(files).slice(0, remaining)
    const entries: UploadedImage[] = selected.map((file) => ({
      id: uid(),
      file,
      preview: URL.createObjectURL(file),
      status: "pending" as const,
    }))
    setNewImages((prev) => [...prev, ...entries])
    entries.forEach((img) => doUpload(img))
    e.target.value = ""
  }

  async function doUpload(img: UploadedImage) {
    const token = await getAccessToken()
    if (!token) return
    setNewImages((prev) =>
      prev.map((i) => (i.id === img.id ? { ...i, status: "uploading" as const } : i)),
    )
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
        setNewImages((prev) =>
          prev.map((i) => (i.id === img.id ? { ...i, url, status: "done" as const } : i)),
        )
      } else {
        throw new Error("Upload returned no results")
      }
    } catch (e) {
      setNewImages((prev) =>
        prev.map((i) =>
          i.id === img.id
            ? { ...i, status: "error" as const, error: e instanceof Error ? e.message : "Upload failed" }
            : i,
        ),
      )
    }
  }

  function removeExistingImage(imgId: string) {
    setExistingImages((prev) =>
      prev.map((img) => (img.id === imgId ? { ...img, removed: true } : img)),
    )
  }

  function unremoveExistingImage(imgId: string) {
    setExistingImages((prev) =>
      prev.map((img) => (img.id === imgId ? { ...img, removed: false } : img)),
    )
  }

  function setExistingPrimary(imgId: string) {
    setExistingImages((prev) =>
      prev.map((img) => ({ ...img, isPrimary: img.id === imgId })),
    )
  }

  function removeNewImage(imgId: string) {
    setNewImages((prev) => {
      const target = prev.find((i) => i.id === imgId)
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((i) => i.id !== imgId)
    })
  }

  /* ================================================================ */
  /*  Tag handlers                                                     */
  /* ================================================================ */

  function addTag(raw: string) {
    const t = raw.trim()
    if (t && !tags.includes(t)) setTags((p) => [...p, t])
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
  function updateAttribute(attrId: string, field: "key" | "value", val: string) {
    setAttributes((p) => p.map((a) => (a.id === attrId ? { ...a, [field]: val } : a)))
  }
  function removeAttribute(attrId: string) {
    setAttributes((p) => p.filter((a) => a.id !== attrId))
  }

  /* ================================================================ */
  /*  Variant handlers                                                 */
  /* ================================================================ */

  function addVariantRow() {
    setVariants((p) => [
      ...p,
      {
        id: uid(),
        apiId: null,
        name: "",
        sku: "",
        price: "",
        compareAtPrice: "",
        stockQuantity: "",
        options: [],
        imagePreview: "",
        imageUrl: "",
        imageStatus: "none",
      },
    ])
  }

  function removeVariantRow(rowId: string) {
    if (variants.length <= 1) return
    setVariants((p) => {
      const v = p.find((v) => v.id === rowId)
      if (v?.imagePreview) URL.revokeObjectURL(v.imagePreview)
      return p.filter((v) => v.id !== rowId)
    })
  }

  function updateVariantField(rowId: string, field: keyof VariantRow, val: string) {
    setVariants((p) => p.map((v) => (v.id === rowId ? { ...v, [field]: val } : v)))
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
        v.id === variantId
          ? { ...v, imagePreview: preview, imageUrl: "", imageStatus: "uploading" as const }
          : v,
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
    if (!token || !id || !product) {
      setGlobalError("Please sign in and ensure the product is loaded.")
      return
    }

    if (newImages.some((i) => i.status === "uploading") || variants.some((v) => v.imageStatus === "uploading")) {
      setGlobalError("Please wait for all uploads to finish.")
      return
    }

    setSaving(true)
    setGlobalError(null)
    setSuccess(false)

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

      await updateProduct(token, id, {
        title: name.trim(),
        description: description.trim(),
        productType: "physical",
        status,
        attributes: JSON.stringify(attrsObj),
        categoryIds: [categoryId],
      })

      // Variant CRUD
      const originalVariantIds = new Set((product.variants ?? []).map((v) => v.id))
      const currentApiIds = new Set(variants.filter((v) => v.apiId).map((v) => v.apiId as string))

      for (const vid of originalVariantIds) {
        if (!currentApiIds.has(vid)) {
          await apiDeleteVariant(token, vid)
        }
      }

      for (const v of variants) {
        const price = parseFloat(v.price)
        const compare = v.compareAtPrice.trim() ? parseFloat(v.compareAtPrice) : undefined
        const stock = parseInt(v.stockQuantity, 10)
        const optionsObj = v.options
          .filter((o) => o.key.trim())
          .reduce(
            (acc, o) => ({ ...acc, [o.key.trim()]: o.value.trim() }),
            {} as Record<string, string>,
          )
        const data = {
          sku: v.sku.trim(),
          name: v.name.trim() || undefined,
          price: price,
          compareAtPrice: compare !== undefined && !isNaN(compare) ? compare : undefined,
          currency: "USD",
          stockQuantity: isNaN(stock) ? 0 : stock,
          options: Object.keys(optionsObj).length > 0 ? optionsObj : undefined,
          weightKg: isNaN(weightKg) ? undefined : weightKg,
        }
        if (v.apiId) {
          await apiUpdateVariant(token, v.apiId, data)
        } else {
          await apiAddVariant(token, id, data)
        }
      }

      // Delete removed images
      const removed = existingImages.filter((img) => img.removed)
      for (const img of removed) {
        await deleteProductImage(token, img.id)
      }

      // Add new images
      const doneNew = newImages.filter((i) => i.status === "done" && i.url)
      const sortStart = (product.images?.length ?? 0) - removed.length
      for (let i = 0; i < doneNew.length; i++) {
        const img = doneNew[i]
        if (img.url) {
          await addProductImage(token, id, {
            url: img.url,
            altText: name.trim(),
            sortOrder: sortStart + i,
          })
        }
      }

      // Add variant images
      let vImgIdx = sortStart + doneNew.length
      for (const v of variants) {
        if (v.imageUrl) {
          await addProductImage(token, id, {
            url: v.imageUrl,
            altText: `${name.trim()} - ${v.name.trim()}`,
            sortOrder: vImgIdx++,
          })
        }
      }

      setSuccess(true)
      setSubmitted(false)
      setNewImages([])
      await loadData()
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to update product")
    } finally {
      setSaving(false)
    }
  }

  /* ================================================================ */
  /*  Delete                                                           */
  /* ================================================================ */

  async function handleDelete() {
    const token = await getAccessToken()
    if (!token || !id) return
    setDeleting(true)
    setGlobalError(null)
    try {
      await deleteProduct(token, id)
      router.push("/dashboard/products")
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to delete product")
      setDeleting(false)
    }
  }

  /* ================================================================ */
  /*  Loading / auth guard                                             */
  /* ================================================================ */

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
      </div>
    )
  }

  if (!product && !loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {globalError || "Product not found"}
        </div>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-2 text-sm text-[#EAB308] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Products
        </Link>
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
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
          <p className="mt-0.5 text-sm text-gray-500">Update product details</p>
        </div>
      </div>

      {/* Global error */}
      {globalError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {globalError}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-[#EAB308]/30 bg-[#EAB308]/10 px-4 py-3 text-sm text-[#EAB308]">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Product saved successfully.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ─── Section 1: Basic Info ─── */}
        <section className={CARD}>
          <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
          <p className="mt-1 text-sm text-gray-500">Core product details</p>

          <div className="mt-6 space-y-5">
            {/* Product Name */}
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-gray-900">
                Product Name <span className="text-red-600">*</span>
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
              <label htmlFor="desc" className="mb-1.5 block text-sm font-medium text-gray-900">
                Description <span className="text-red-600">*</span>
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
              <label htmlFor="brand" className="mb-1.5 block text-sm font-medium text-gray-900">
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
              <label htmlFor="weight" className="mb-1.5 block text-sm font-medium text-gray-900">
                Weight <span className="text-red-600">*</span>
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

            {/* Status */}
            <div>
              <span className="mb-2 block text-sm font-medium text-gray-900">Status</span>
              <div className="flex gap-3">
                {(["draft", "active"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "rounded-lg border px-5 py-2 text-sm font-medium capitalize transition-colors",
                      status === s
                        ? "border-[#EAB308] bg-[#EAB308]/10 text-[#EAB308]"
                        : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-600",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Section 2: Category & Tags ─── */}
        <section className={CARD}>
          <h2 className="text-lg font-semibold text-gray-900">Category & Tags</h2>
          <p className="mt-1 text-sm text-gray-500">Organize your product</p>

          <div className="mt-6 space-y-5">
            {/* Category */}
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-gray-900">
                Category <span className="text-red-600">*</span>
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value)
                  touch("categoryId")
                }}
                onBlur={() => touch("categoryId")}
                className={cn(inputCls(err("categoryId")), !categoryId && "text-gray-500")}
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
              <label className="mb-1.5 block text-sm font-medium text-gray-900">Tags</label>
              <div
                className={cn(
                  "flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border bg-gray-50 px-2 py-1.5 transition-colors focus-within:ring-1",
                  "border-gray-200 focus-within:border-[#EAB308] focus-within:ring-[#EAB308]/50",
                )}
              >
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md border border-[#EAB308]/30 bg-[#EAB308]/10 px-2 py-0.5 text-xs font-medium text-[#EAB308]"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags((p) => p.filter((t) => t !== tag))}
                      className="text-[#EAB308]/50 hover:text-[#EAB308]"
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
                  className="min-w-[120px] flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Press Enter or comma to add a tag</p>
            </div>
          </div>
        </section>

        {/* ─── Section 3: Images ─── */}
        <section className={CARD}>
          <h2 className="text-lg font-semibold text-gray-900">Product Images</h2>
          <p className="mt-1 text-sm text-gray-500">
            Upload up to {MAX_IMAGES} images. Click the star to set the main image.
          </p>

          <div className="mt-5 space-y-4">
            {/* Existing images */}
            {existingImages.filter((i) => !i.removed).length > 0 && (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
                {existingImages
                  .filter((img) => !img.removed)
                  .map((img) => (
                    <div
                      key={img.id}
                      className={cn(
                        "group relative aspect-square overflow-hidden rounded-lg border-2 bg-gray-50",
                        img.isPrimary ? "border-[#EAB308]" : "border-gray-200",
                      )}
                    >
                      <img src={img.url} alt={img.altText ?? ""} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setExistingPrimary(img.id)}
                        className="absolute bottom-1 left-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                        style={img.isPrimary ? { opacity: 1 } : undefined}
                        title={img.isPrimary ? "Primary image" : "Set as primary"}
                      >
                        <Star
                          className={cn(
                            "h-4 w-4",
                            img.isPrimary
                              ? "fill-[#EAB308] text-[#EAB308]"
                              : "text-gray-500 hover:text-gray-600",
                          )}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeExistingImage(img.id)}
                        className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-gray-500 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {/* Removed images (undo) */}
            {existingImages.some((i) => i.removed) && (
              <div className="flex flex-wrap gap-2">
                {existingImages
                  .filter((img) => img.removed)
                  .map((img) => (
                    <div
                      key={img.id}
                      className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 opacity-50"
                    >
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => unremoveExistingImage(img.id)}
                        className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-medium text-white"
                      >
                        Undo
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {/* Upload zone */}
            {totalImageCount < MAX_IMAGES && (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-10 transition-colors hover:border-[#EAB308]/40 hover:bg-[#EAB308]/5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
                  <Upload className="h-6 w-6 text-gray-500" />
                </div>
                <p className="mt-3 text-sm font-medium text-gray-900">Click to upload new images</p>
                <p className="mt-1 text-xs text-gray-500">
                  JPEG, PNG, WebP, GIF &middot; {MAX_IMAGES - totalImageCount} remaining
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={handleNewImageSelect}
                />
              </label>
            )}

            {/* New images */}
            {newImages.length > 0 && (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
                {newImages.map((img) => (
                  <div
                    key={img.id}
                    className="group relative aspect-square overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-50"
                  >
                    {img.status === "done" && img.url ? (
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                    ) : img.preview ? (
                      <img src={img.preview} alt="" className="h-full w-full object-cover opacity-60" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-gray-500" />
                      </div>
                    )}
                    {img.status === "uploading" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <Loader2 className="h-5 w-5 animate-spin text-[#EAB308]" />
                      </div>
                    )}
                    {img.status === "error" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeNewImage(img.id)}
                      className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-gray-500 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── Section 4: Variants ─── */}
        <section className={CARD}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Variants</h2>
              <p className="mt-1 text-sm text-gray-500">
                Pricing, stock, and options for each variant
              </p>
            </div>
            <button
              type="button"
              onClick={addVariantRow}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Variant
            </button>
          </div>

          {err("variants") && <FieldError msg={err("variants")} />}

          <div className="mt-5 space-y-4">
            {variants.map((variant, idx) => (
              <div
                key={variant.id}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Variant {idx + 1}
                    {variant.apiId && (
                      <span className="ml-2 text-[10px] normal-case tracking-normal text-gray-500">
                        (existing)
                      </span>
                    )}
                  </span>
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariantRow(variant.id)}
                      className="rounded p-1 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="mb-1 block text-xs text-gray-500">
                      Name <span className="text-red-600">*</span>
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
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">
                      SKU <span className="text-red-600">*</span>
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
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">
                      Price ($) <span className="text-red-600">*</span>
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
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Compare at ($)</label>
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
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">
                      Stock Qty <span className="text-red-600">*</span>
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

                {/* Options */}
                <div className="mt-3 border-t border-gray-200 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Options</span>
                    <button
                      type="button"
                      onClick={() => addVariantOption(variant.id)}
                      className="text-xs text-[#EAB308] hover:underline"
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
                            className="h-8 flex-1 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-900 placeholder:text-gray-500 focus:border-[#EAB308] focus:outline-none"
                          />
                          <input
                            type="text"
                            value={opt.value}
                            onChange={(e) =>
                              updateVariantOption(variant.id, opt.id, "value", e.target.value)
                            }
                            placeholder="Value (e.g. M)"
                            className="h-8 flex-1 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-900 placeholder:text-gray-500 focus:border-[#EAB308] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeVariantOption(variant.id, opt.id)}
                            className="text-gray-600 hover:text-red-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Variant image */}
                <div className="mt-3 border-t border-gray-200 pt-3">
                  <span className="mb-1.5 block text-xs text-gray-500">Variant Image</span>
                  {variant.imagePreview || variant.imageUrl ? (
                    <div className="relative inline-block h-16 w-16 overflow-hidden rounded-lg border border-gray-200">
                      <img
                        src={variant.imageUrl || variant.imagePreview}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      {variant.imageStatus === "uploading" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <Loader2 className="h-4 w-4 animate-spin text-[#EAB308]" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => clearVariantImage(variant.id)}
                        className="absolute right-0.5 top-0.5 rounded bg-black/70 p-0.5 text-gray-500 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700">
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
        </section>

        {/* ─── Section 5: Attributes ─── */}
        <section className={CARD}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Custom Attributes</h2>
              <p className="mt-1 text-sm text-gray-500">
                Add key-value pairs (e.g. Origin Country, Certification)
              </p>
            </div>
            <button
              type="button"
              onClick={addAttribute}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {attributes.length === 0 ? (
            <p className="mt-5 rounded-lg border border-dashed border-gray-200 py-6 text-center text-sm text-gray-500">
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
                    className="h-9 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#EAB308] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={attr.value}
                    onChange={(e) => updateAttribute(attr.id, "value", e.target.value)}
                    placeholder="Value"
                    className="h-9 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#EAB308] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttribute(attr.id)}
                    className="rounded-md p-2 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Submit / Delete bar ─── */}
        <div className="flex flex-col gap-4 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/products"
              className="rounded-lg border border-gray-200 px-5 py-2.5 text-center text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EAB308] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#CA8A04] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete Product
          </button>
        </div>
      </form>

      {/* Delete confirm modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteConfirmOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete Product</h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
