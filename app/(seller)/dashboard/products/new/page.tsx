"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
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
  Check,
  Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getCurrentSeller,
  getSellerStores,
  getCategories,
  createProduct,
  addProductImage,
  getMarketplaceConfig,
  getRegions,
  getSellerMedia,
  createSellerDeal,
  getAdminShippingSettings,
  type CategoryRef,
  type StoreDetail,
  type MediaItem,
} from "@/lib/api"
import { logError } from "@/lib/errors"
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

const DEFAULT_MAX_IMAGES = 8
const DEFAULT_MAX_TAGS = 10

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

function flattenCategories(cats: CategoryRef[], depth = 0): { id: string; name: string }[] {
  let res: { id: string; name: string }[] = []
  for (const c of cats) {
    res.push({
      id: c.id,
      name: "\u00A0\u00A0".repeat(depth) + (depth > 0 ? "\u2514 " : "") + c.name,
    })
    if (c.children && c.children.length > 0) {
      res = res.concat(flattenCategories(c.children, depth + 1))
    }
  }
  return res
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
  const [maxImages, setMaxImages] = useState(DEFAULT_MAX_IMAGES)
  const [maxTags, setMaxTags] = useState(DEFAULT_MAX_TAGS)

  /* ---- form fields ---- */
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [weight, setWeight] = useState("")
  const [weightUnit, setWeightUnit] = useState("lb")
  const [carrierShippingEnabled, setCarrierShippingEnabled] = useState(false)
  const [parcelLengthIn, setParcelLengthIn] = useState("")
  const [parcelWidthIn, setParcelWidthIn] = useState("")
  const [parcelHeightIn, setParcelHeightIn] = useState("")
  const [brand, setBrand] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [submitAction, setSubmitAction] = useState<"draft" | "pending_review">("pending_review")
  const [price, setPrice] = useState("")
  const [compareAtPrice, setCompareAtPrice] = useState("")
  const [stockQuantity, setStockQuantity] = useState("")
  const [attributes, setAttributes] = useState<AttributePair[]>([])
  const [images, setImages] = useState<ProductImageEntry[]>([])
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)

  /* ---- deal section ---- */
  const [createDeal, setCreateDeal] = useState(false)
  const [dealTitle, setDealTitle] = useState("")
  const [dealDescription, setDealDescription] = useState("")
  const [dealBadgeText, setDealBadgeText] = useState("")
  const [dealDiscountPercent, setDealDiscountPercent] = useState("")
  const [dealStartAt, setDealStartAt] = useState("")
  const [dealEndAt, setDealEndAt] = useState("")

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
    if (carrierShippingEnabled) {
      const L = parseFloat(parcelLengthIn)
      const W = parseFloat(parcelWidthIn)
      const H = parseFloat(parcelHeightIn)
      if (isNaN(L) || L <= 0)
        e.parcelLengthIn = "Length (in) is required for carrier shipping"
      if (isNaN(W) || W <= 0) e.parcelWidthIn = "Width (in) is required for carrier shipping"
      if (isNaN(H) || H <= 0) e.parcelHeightIn = "Height (in) is required for carrier shipping"
    }
    if (variants.length > 0) {
      variants.forEach((v, i) => {
        if (!v.name.trim()) e[`v${i}_name`] = "Required"
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
    } else {
      const p = parseFloat(price)
      if (!price.trim() || isNaN(p) || p <= 0) e.price = "Valid price required"
      const sq = parseInt(stockQuantity, 10)
      if (stockQuantity.trim() === "" || isNaN(sq) || sq < 0)
        e.stockQuantity = "Valid quantity required"
      if (compareAtPrice.trim()) {
        const cap = parseFloat(compareAtPrice)
        if (isNaN(cap) || cap < 0) e.compareAtPrice = "Invalid compare at price"
      }
    }
    return e
  }, [
    name,
    description,
    categoryId,
    weight,
    carrierShippingEnabled,
    parcelLengthIn,
    parcelWidthIn,
    parcelHeightIn,
    variants,
    price,
    stockQuantity,
    compareAtPrice,
  ])

  const flatCategories = useMemo(() => flattenCategories(categories), [categories])

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
      const [cats, seller, regions] = await Promise.all([
        getCategories(),
        getCurrentSeller(token),
        getRegions(token, true).catch(() => []),
      ])
      setCategories(cats)
      const st = await getSellerStores(token, seller.id)
      setStores(st)
      if (st.length > 0) setSelectedStoreId(st[0].id)
      if (regions.length > 0) {
        const mktCfg = await getMarketplaceConfig(regions[0].id)
        setMaxImages(mktCfg.maxProductImages)
        setMaxTags(mktCfg.maxProductTags)
      }
      try {
        const ship = await getAdminShippingSettings(token)
        setCarrierShippingEnabled(ship.shipping_realtime_enabled === true)
      } catch {
        setCarrierShippingEnabled(false)
      }
    } catch (e) {
      logError(e, "loading product form data")
      setGlobalError("Failed to load data")
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
    const remaining = maxImages - images.length
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
      logError(e, "uploading product image")
      setImages((prev) =>
        prev.map((i) =>
          i.id === img.id
            ? { ...i, status: "error" as const, error: "Upload failed" }
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

  async function openMediaPicker() {
    setShowMediaPicker(true)
    setLoadingLibrary(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const res = await getSellerMedia(token, 1, 200)
      setMediaLibrary(res.items ?? [])
    } catch {
      setMediaLibrary([])
    } finally {
      setLoadingLibrary(false)
    }
  }

  function selectFromLibrary(item: MediaItem) {
    if (images.length >= maxImages) return
    const alreadyAdded = images.some((i) => i.url === item.url)
    if (alreadyAdded) return
    const entry: ProductImageEntry = {
      id: uid(),
      file: new File([], item.name),
      preview: item.url,
      url: item.url,
      status: "done",
      isPrimary: images.length === 0,
    }
    setImages((prev) => [...prev, entry])
  }

  /* ================================================================ */
  /*  Tag handlers                                                     */
  /* ================================================================ */

  function addTag(raw: string) {
    const t = raw.trim()
    if (t && !tags.includes(t) && tags.length < maxTags) setTags((p) => [...p, t])
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

      const pl = parseFloat(parcelLengthIn)
      const pw = parseFloat(parcelWidthIn)
      const ph = parseFloat(parcelHeightIn)
      const parcelDims =
        !isNaN(pl) && pl > 0 && !isNaN(pw) && pw > 0 && !isNaN(ph) && ph > 0
          ? { lengthIn: pl, widthIn: pw, heightIn: ph }
          : {}

      const variantPayload = variants.length > 0
        ? variants.map((v) => {
            const vPrice = parseFloat(v.price)
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
              sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
              price: vPrice,
              compareAtPrice: compare !== undefined && !isNaN(compare) ? compare : undefined,
              currency: "USD",
              stockQuantity: isNaN(stock) ? 0 : stock,
              options: Object.keys(optionsObj).length > 0 ? optionsObj : undefined,
              weightKg: isNaN(weightKg) ? undefined : weightKg,
              ...parcelDims,
            }
          })
        : [{
            name: "Default",
            sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            price: parseFloat(price),
            compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : undefined,
            currency: "USD",
            stockQuantity: parseInt(stockQuantity, 10),
            weightKg: isNaN(weightKg) ? undefined : weightKg,
            ...parcelDims,
          }]

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

      if (createDeal && dealTitle.trim()) {
        try {
          const discPct = dealDiscountPercent ? parseInt(dealDiscountPercent, 10) : undefined
          await createSellerDeal(token, {
            productId: product.id,
            title: dealTitle.trim(),
            description: dealDescription.trim() || undefined,
            badgeText: dealBadgeText.trim() || undefined,
            discountPercent: discPct && !isNaN(discPct) ? discPct : undefined,
            startAt: dealStartAt ? new Date(dealStartAt).toISOString() : undefined,
            endAt: dealEndAt ? new Date(dealEndAt).toISOString() : undefined,
          })
        } catch {
          // product already created, don't block navigation
        }
      }

      router.push("/dashboard/products")
    } catch (e) {
      logError(e, "creating product")
      setGlobalError("Failed to create product")
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
        <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
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
          <h1 className="text-2xl font-bold text-gray-900">Create Product</h1>
          <p className="mt-0.5 text-sm text-gray-500">Add a new product to your store</p>
        </div>
      </div>

      {/* Global error */}
      {globalError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {globalError}
        </div>
      )}

      {/* No store message */}
      {stores.length === 0 && !loading && (
        <div className={CARD}>
          <p className="text-sm text-gray-500">
            You need to create a store before adding products.{" "}
            <Link href="/dashboard/store" className="text-[#EAB308] hover:underline">
              Go to Store Settings
            </Link>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Store selector */}
        {stores.length > 1 && (
          <section className={CARD}>
            <h2 className="text-lg font-semibold text-gray-900">Store</h2>
            <p className="mt-1 text-sm text-gray-500">Select the store for this product</p>
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

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-900">
                Parcel size (inches)
                {carrierShippingEnabled ? <span className="text-red-600"> *</span> : null}
              </p>
              <p className="mb-2 text-xs text-gray-500">
                Used for live carrier rates (length × width × height per unit). Optional when realtime shipping is off.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">L</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={parcelLengthIn}
                    onChange={(e) => setParcelLengthIn(e.target.value)}
                    onBlur={() => touch("parcelLengthIn")}
                    placeholder="12"
                    className={cn(inputCls(err("parcelLengthIn")), "w-full")}
                  />
                  <FieldError msg={err("parcelLengthIn")} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">W</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={parcelWidthIn}
                    onChange={(e) => setParcelWidthIn(e.target.value)}
                    onBlur={() => touch("parcelWidthIn")}
                    placeholder="9"
                    className={cn(inputCls(err("parcelWidthIn")), "w-full")}
                  />
                  <FieldError msg={err("parcelWidthIn")} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">H</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={parcelHeightIn}
                    onChange={(e) => setParcelHeightIn(e.target.value)}
                    onBlur={() => touch("parcelHeightIn")}
                    placeholder="6"
                    className={cn(inputCls(err("parcelHeightIn")), "w-full")}
                  />
                  <FieldError msg={err("parcelHeightIn")} />
                </div>
              </div>
            </div>

            {/* Status info */}
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
              <p className="text-sm text-yellow-700 font-medium">Product will be submitted for review</p>
              <p className="text-xs text-gray-500 mt-1">Your product will be reviewed by an admin before it appears on the marketplace.</p>
            </div>
          </div>
        </section>

        {/* ─── Section 1b: Pricing & Inventory (no variants) ─── */}
        {variants.length === 0 && (
          <section className={CARD}>
            <h2 className="text-lg font-semibold text-gray-900">Pricing & Inventory</h2>
            <p className="mt-1 text-sm text-gray-500">Set price and stock for your product</p>

            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* Price */}
                <div>
                  <label htmlFor="price" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Price ($) <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    onBlur={() => touch("price")}
                    placeholder="0.00"
                    className={inputCls(err("price"))}
                  />
                  <FieldError msg={err("price")} />
                </div>

                {/* Compare at Price */}
                <div>
                  <label htmlFor="compareAtPrice" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Compare at Price ($)
                  </label>
                  <input
                    id="compareAtPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    onBlur={() => touch("compareAtPrice")}
                    placeholder="0.00"
                    className={inputCls(err("compareAtPrice"))}
                  />
                  <FieldError msg={err("compareAtPrice")} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* Stock Quantity */}
                <div>
                  <label htmlFor="stockQuantity" className="mb-1.5 block text-sm font-medium text-gray-900">
                    Stock Quantity <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="stockQuantity"
                    type="number"
                    min="0"
                    step="1"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    onBlur={() => touch("stockQuantity")}
                    placeholder="0"
                    className={inputCls(err("stockQuantity"))}
                  />
                  <FieldError msg={err("stockQuantity")} />
                </div>
              </div>
            </div>
          </section>
        )}

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
                className={cn(
                  inputCls(err("categoryId")),
                  !categoryId && "text-gray-500",
                )}
              >
                <option value="">Select a category</option>
                {flatCategories.map((cat) => (
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
                {tags.length < maxTags && (
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
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {tags.length >= maxTags
                  ? `Maximum ${maxTags} tags reached`
                  : `Press Enter or comma to add a tag (${tags.length}/${maxTags})`}
              </p>
            </div>
          </div>
        </section>

        {/* ─── Section 3: Images ─── */}
        <section className={CARD}>
          <h2 className="text-lg font-semibold text-gray-900">Product Images</h2>
          <p className="mt-1 text-sm text-gray-500">
            Upload up to {maxImages} images. Click the star to set the main image.
          </p>

          <div className="mt-5 space-y-4">
            {/* Upload zone + Library button */}
            {images.length < maxImages && (
              <div className="space-y-3">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-10 transition-colors hover:border-[#EAB308]/40 hover:bg-[#EAB308]/5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
                    <Upload className="h-6 w-6 text-gray-500" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-gray-900">Click to upload images</p>
                  <p className="mt-1 text-xs text-gray-500">
                    JPEG, PNG, WebP, GIF &middot; {maxImages - images.length} remaining
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </label>
                <button
                  type="button"
                  onClick={openMediaPicker}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ImageIcon className="h-4 w-4" />
                  Select from Library
                </button>
              </div>
            )}

            {/* Image grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-lg border-2 bg-gray-50",
                      img.isPrimary ? "border-[#EAB308]" : "border-gray-200",
                    )}
                  >
                    {img.status === "done" && img.url ? (
                      <Image src={img.url} alt="" fill sizes="(max-width: 640px) 25vw, (max-width: 768px) 16vw, 12vw" className="object-cover" />
                    ) : img.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
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
                            ? "fill-[#EAB308] text-[#EAB308]"
                            : "text-gray-500 hover:text-gray-600",
                        )}
                      />
                    </button>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
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

        {/* ─── Section 4: Variants (Optional) ─── */}
        <section className={CARD}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Variants</h2>
              <p className="mt-1 text-sm text-gray-500">
                Optional — add variants if your product has different sizes, colors, etc.
              </p>
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Variant
            </button>
          </div>

          {variants.length === 0 ? (
            <p className="mt-5 rounded-lg border border-dashed border-gray-200 py-6 text-center text-sm text-gray-500">
              No variants. Your product will be listed without size/color options.
            </p>
          ) : (
          <div className="mt-5 space-y-4">
            {variants.map((variant, idx) => (
              <div
                key={variant.id}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                {/* Variant header */}
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Variant {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeVariant(variant.id)}
                    className="rounded p-1 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Core fields grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {/* Name */}
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

                  {/* Price */}
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

                  {/* Compare at Price */}
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

                  {/* Stock */}
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

                {/* Options key-value pairs */}
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
                      {/* eslint-disable-next-line @next/next/no-img-element -- may be a blob: URL preview */}
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
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-600">
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

        {/* ─── Section 6: Deal (Optional) ─── */}
        <section className={CARD}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Launch with a Deal</h2>
              <p className="mt-1 text-sm text-gray-500">
                Optionally create a deal for this product right away
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateDeal(!createDeal)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                createDeal ? "bg-[#EAB308]" : "bg-gray-200",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                  createDeal ? "translate-x-6" : "translate-x-1",
                )}
              />
            </button>
          </div>

          {createDeal && (
            <div className="mt-5 space-y-4 rounded-xl border border-[#EAB308]/20 bg-[#EAB308]/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[#EAB308]">
                <Tag className="h-4 w-4" />
                Deal Details
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Deal Title *</label>
                <input
                  type="text"
                  value={dealTitle}
                  onChange={(e) => setDealTitle(e.target.value)}
                  placeholder="e.g. Launch Special — 20% Off!"
                  className={inputCls()}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                <textarea
                  value={dealDescription}
                  onChange={(e) => setDealDescription(e.target.value)}
                  placeholder="Short deal description"
                  rows={2}
                  className={textareaCls()}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Badge Text</label>
                  <input
                    type="text"
                    value={dealBadgeText}
                    onChange={(e) => setDealBadgeText(e.target.value)}
                    placeholder="e.g. NEW, HOT, 20% OFF"
                    className={inputCls()}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Discount %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={dealDiscountPercent}
                    onChange={(e) => setDealDiscountPercent(e.target.value)}
                    placeholder="e.g. 20"
                    className={inputCls()}
                  />
                </div>
              </div>

              {price && dealDiscountPercent && parseInt(dealDiscountPercent) > 0 && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="text-sm text-green-700">
                    Deal price:{" "}
                    <span className="font-bold">
                      ${(parseFloat(price) * (1 - parseInt(dealDiscountPercent) / 100)).toFixed(2)}
                    </span>
                    <span className="text-xs text-green-600 ml-2">(was ${parseFloat(price).toFixed(2)})</span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Start Date</label>
                  <input
                    type="datetime-local"
                    value={dealStartAt}
                    onChange={(e) => setDealStartAt(e.target.value)}
                    className={inputCls()}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">End Date</label>
                  <input
                    type="datetime-local"
                    value={dealEndAt}
                    onChange={(e) => setDealEndAt(e.target.value)}
                    className={inputCls()}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ─── Submit bar ─── */}
        <div className="flex flex-col-reverse items-center justify-end gap-3 border-t border-gray-200 pt-6 sm:flex-row">
          <Link
            href="/dashboard/products"
            className="w-full rounded-lg border border-gray-200 px-5 py-2.5 text-center text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 sm:w-auto"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            onClick={() => setSubmitAction("draft")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#EAB308] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#CA8A04] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
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

      {/* Media picker modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowMediaPicker(false)}>
          <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Select from Media Library</h3>
              <button type="button" onClick={() => setShowMediaPicker(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(80vh - 80px)" }}>
              {loadingLibrary ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#EAB308]" />
                </div>
              ) : mediaLibrary.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ImageIcon className="h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-sm font-medium text-gray-900">No media in library</p>
                  <p className="mt-1 text-xs text-gray-500">Upload images in the Media Library first</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {mediaLibrary.map((item) => {
                    const alreadyAdded = images.some((i) => i.url === item.url)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={alreadyAdded || images.length >= maxImages}
                        onClick={() => { selectFromLibrary(item); setShowMediaPicker(false) }}
                        className={cn(
                          "group relative aspect-square overflow-hidden rounded-lg border-2 transition-colors",
                          alreadyAdded
                            ? "border-[#EAB308] opacity-60 cursor-not-allowed"
                            : "border-gray-200 hover:border-[#EAB308]/60 cursor-pointer",
                        )}
                      >
                        <Image src={item.url} alt={item.name} fill sizes="(max-width: 640px) 33vw, 20vw" className="object-cover" />
                        {alreadyAdded && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Check className="h-6 w-6 text-white" />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                          <p className="truncate text-xs font-medium text-white">{item.name || "Untitled"}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
