"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Plus, Trash2, Upload, ImageIcon, Loader2,
  X, CheckCircle2, XCircle, Search, Package, Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUploadThing } from "@/lib/uploadthing"
import { getAccessToken } from "@/lib/auth-helpers"
import { createMediaItem, type MediaItem, type CategoryRef } from "@/lib/api"
import {
  importRows, flattenCategories, collectCategoryOptions,
  type ValidatedRow, type RawRow, type ImportResult,
} from "@/lib/bulk-import"

// ── Types ─────────────────────────────────────────────────────────────────────

interface GridRow {
  id: string
  product_name: string
  description: string
  category: string
  price: string
  compare_at_price: string
  stock: string
  weight: string
  weight_unit: "lb" | "kg"
  brand: string
  tags: string
  status: "draft" | "pending_review"
  images: MediaItem[]  // up to 3
}

function uid() { return Math.random().toString(36).slice(2, 10) }

function makeRow(): GridRow {
  return {
    id: uid(), product_name: "", description: "", category: "",
    price: "", compare_at_price: "", stock: "",
    weight: "", weight_unit: "lb", brand: "", tags: "",
    status: "pending_review", images: [],
  }
}

function makeRows(n: number): GridRow[] { return Array.from({ length: n }, makeRow) }

function fixHintForError(error: string): string {
  const e = error.toLowerCase()
  if (e.includes("name")) return "Use at least 3 characters, e.g. Organic Jasmine Rice."
  if (e.includes("description")) return "Add a clear description with at least 10 characters."
  if (e.includes("category") && e.includes("not found")) return "Choose a category from the dropdown list."
  if (e.includes("category required")) return "Select a category before importing."
  if (e.includes("price")) return "Use a positive number like 19.99."
  if (e.includes("stock")) return "Use a whole number 0 or higher."
  if (e.includes("weight")) return "Enter a positive weight and choose the right unit."
  return "Match this field to template rules, then try again."
}

function toValidatedRow(row: GridRow, index: number, catMap: Map<string, string>): ValidatedRow {
  const errors: string[] = []
  const warnings: string[] = []
  if (row.product_name.trim().length < 3) errors.push("Name must be ≥ 3 characters")
  if (row.description.trim().length < 10) errors.push("Description must be ≥ 10 characters")
  const catKey = row.category.trim().toLowerCase()
  const categoryId = catMap.get(catKey) ?? null
  if (!row.category) errors.push("Category required")
  else if (!categoryId) errors.push(`Category "${row.category}" not found`)
  const price = parseFloat(row.price)
  if (!row.price || isNaN(price) || price <= 0) errors.push("Price must be a positive number")
  const stock = parseInt(row.stock, 10)
  if (row.stock === "" || isNaN(stock) || stock < 0) errors.push("Stock must be ≥ 0")
  if (row.weight && (isNaN(parseFloat(row.weight)) || parseFloat(row.weight) <= 0))
    errors.push("Weight must be a positive number")
  if (!row.weight) errors.push("Weight is required")
  if (row.images.length === 0) warnings.push("No images set")

  // Build weight in kg for the API
  const weightNum = parseFloat(row.weight) || 0
  const weightKg = row.weight_unit === "lb" ? weightNum * 0.453592 : weightNum

  // Build attrs JSON mirroring the single-product form
  const attrsObj: Record<string, unknown> = {}
  if (row.brand.trim()) attrsObj["brand"] = row.brand.trim()
  const tagList = row.tags.split(",").map(t => t.trim()).filter(Boolean)
  if (tagList.length) attrsObj["tags"] = tagList
  if (weightNum > 0) { attrsObj["weight"] = weightNum; attrsObj["weightUnit"] = row.weight_unit }

  const raw: RawRow = {
    rowNumber: index + 1,
    product_name: row.product_name.trim(),
    description: row.description.trim(),
    category: row.category,
    price: row.price,
    compare_at_price: row.compare_at_price,
    stock: row.stock,
    brand: row.brand,
    weight_lbs: row.weight_unit === "lb" ? row.weight : String(weightNum / 0.453592),
    tags: row.tags,
    sku: "",
    status: row.status,
    image_group: "",
  }

  return {
    rowNumber: index + 1, raw, errors, warnings,
    resolvedImages: row.images,
    categoryId,
    overallStatus: errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ready",
  }
}

// ── Media Picker Modal ────────────────────────────────────────────────────────

function MediaPickerModal({ mediaItems, onSelect, onClose }: {
  mediaItems: MediaItem[]
  onSelect: (item: MediaItem) => void
  onClose: () => void
}) {
  const [q, setQ] = useState("")
  const filtered = mediaItems.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-gray-900">Pick from Media Library</h3>
            <p className="mt-0.5 text-xs text-gray-500">Click an image to attach it</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-gray-100 px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input autoFocus type="text" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)}
              className="h-8 w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm focus:border-[#EAB308] focus:outline-none focus:ring-1 focus:ring-[#EAB308]/30" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ImageIcon className="h-10 w-10 mb-3" />
              <p className="text-sm">{mediaItems.length === 0 ? "No images in your Media Library" : "No results"}</p>
              {mediaItems.length === 0 && <Link href="/dashboard/upload" className="mt-3 text-xs text-blue-600 hover:underline">Upload images →</Link>}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {filtered.map(m => (
                <button key={m.id} onClick={() => onSelect(m)} title={m.name}
                  className="group relative aspect-square overflow-hidden rounded-xl border-2 border-transparent hover:border-[#EAB308] transition-all">
                  <Image src={m.url} alt={m.name} fill sizes="(max-width: 640px) 25vw, 16vw" className="object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="rounded-full bg-[#EAB308] p-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-black" /></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Images Cell ───────────────────────────────────────────────────────────────

function ImagesCell({ rowId, images, uploading, onUpload, onLibrary, onRemove }: {
  rowId: string; images: MediaItem[]; uploading: boolean
  onUpload: () => void; onLibrary: () => void; onRemove: (idx: number) => void
}) {
  const canAdd = images.length < 3
  return (
    <div className="flex items-center gap-1 px-2 py-1 flex-wrap min-h-[2.5rem]">
      {images.map((img, i) => (
        <div key={img.id} className="relative group/img shrink-0">
          <div className="relative h-8 w-8 overflow-hidden rounded-md border border-gray-200">
            <Image src={img.url} alt={img.name} fill sizes="32px" className="object-cover" />
          </div>
          {i === 0 && <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[#EAB308] border border-white" title="Primary" />}
          <button onClick={() => onRemove(i)}
            className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
            <X className="h-2 w-2" />
          </button>
        </div>
      ))}
      {uploading && (
        <div className="h-8 w-8 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#EAB308]" />
        </div>
      )}
      {canAdd && !uploading && (
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={onUpload} title="Upload from device"
            className="flex items-center gap-0.5 rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 hover:border-[#EAB308] hover:text-[#EAB308] transition-colors">
            <Upload className="h-2.5 w-2.5" /> Upload
          </button>
          <button onClick={onLibrary} title="Pick from Library"
            className="flex items-center gap-0.5 rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
            <ImageIcon className="h-2.5 w-2.5" /> Library
          </button>
        </div>
      )}
    </div>
  )
}

// ── Import Progress ───────────────────────────────────────────────────────────

function GridImportProgress({ results, total, done }: { results: ImportResult[]; total: number; done: boolean }) {
  const pct = total > 0 ? (results.length / total) * 100 : 100
  const ok = results.filter(r => r.status === "success").length
  const fail = results.filter(r => r.status === "error").length
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{done ? "Import Complete!" : "Importing…"}</h3>
          <span className="text-sm text-gray-500">{results.length} / {total}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-[#EAB308] transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        {done && (
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />{ok} created
            </span>
            {fail > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
                <XCircle className="h-3.5 w-3.5" />{fail} failed
              </span>
            )}
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-50 max-h-72 overflow-y-auto">
        {results.map(r => (
          <div key={`${r.rowNumber}-${r.productName}`} className="flex items-center gap-3 px-5 py-2.5">
            {r.status === "success"
              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
            <p className="flex-1 min-w-0 text-sm text-gray-900 truncate">{r.productName}</p>
            {r.error && <p className="shrink-0 text-xs text-red-500 max-w-[200px] truncate">{r.error}</p>}
          </div>
        ))}
        {!done && (
          <div className="flex items-center gap-3 px-5 py-2.5 opacity-50">
            <Loader2 className="h-4 w-4 animate-spin text-[#EAB308]" />
            <p className="text-sm text-gray-500">Processing…</p>
          </div>
        )}
      </div>
      {done && (
        <div className="flex justify-end">
          <Link href="/dashboard/products"
            className="inline-flex items-center gap-2 rounded-xl bg-[#EAB308] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#CA8A04] transition-colors">
            <Package className="h-4 w-4" /> View Products
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Input helpers ─────────────────────────────────────────────────────────────

const CELL = "w-full h-full border-none outline-none text-sm text-gray-900 placeholder:text-gray-300 bg-transparent focus:bg-white/60 px-2.5"
const TD = "border-r border-gray-100 p-0 align-middle"

// ── Main Component ────────────────────────────────────────────────────────────

export default function GridEditor({ categories, mediaItems, storeId }: {
  categories: CategoryRef[]; mediaItems: MediaItem[]; storeId: string
}) {
  const [rows, setRows] = useState<GridRow[]>(() => makeRows(10))
  const [pickerRowId, setPickerRowId] = useState<string | null>(null)
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Map<string, string[]>>(new Map())
  const [phase, setPhase] = useState<"edit" | "importing" | "done">("edit")
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [importTotal, setImportTotal] = useState(0)
  const [importError, setImportError] = useState<string | null>(null)

  // Column widths (user-resizable) ─ keys match table columns below
  const [colWidths, setColWidths] = useState(() => ({
    product_name: 220,
    description: 260,
    category: 200,
    price: 120,
    compare_at_price: 120,
    stock: 100,
    weight: 160,
    brand: 160,
    tags: 200,
    status: 180,
    images: 260,
  }))

  const uploadForRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const catMap = useMemo(() => flattenCategories(categories), [categories])
  const catOptions = useMemo(() => collectCategoryOptions(categories), [categories])

  // ── UploadThing ─────────────────────────────────────────────────────────────
  const { startUpload } = useUploadThing("sellerMedia", {
    onClientUploadComplete: async (res) => {
      const rowId = uploadForRef.current
      uploadForRef.current = null
      if (!res || !rowId) return
      const token = await getAccessToken()
      for (const r of res) {
        const url = (r as unknown as Record<string, string>).ufsUrl || r.url || `https://utfs.io/f/${r.key}`
        let img: MediaItem
        try {
          img = await createMediaItem(token!, { name: r.name, url, file_key: r.key ?? "", content_type: r.type ?? "image/jpeg", size_bytes: r.size ?? 0 })
        } catch {
          img = { id: uid(), seller_id: "", name: r.name, description: "", url, file_key: r.key ?? "", content_type: r.type ?? "image/jpeg", size_bytes: r.size ?? 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        }
        setRows(prev => prev.map(row => row.id === rowId && row.images.length < 3 ? { ...row, images: [...row.images, img] } : row))
      }
      setUploadingIds(prev => { const s = new Set(prev); s.delete(rowId!); return s })
    },
    onUploadError: () => {
      const rowId = uploadForRef.current
      uploadForRef.current = null
      if (rowId) setUploadingIds(prev => { const s = new Set(prev); s.delete(rowId); return s })
    },
  })

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const update = useCallback(<K extends keyof GridRow>(id: string, field: K, value: GridRow[K]) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }, [])

  // Column resize handlers
  type ResizableKey = keyof typeof colWidths
  const resizeState = useRef<{ key: ResizableKey; startX: number; startWidth: number } | null>(null)

  const handleResizeMouseDown = (key: ResizableKey, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = colWidths[key]
    resizeState.current = { key, startX, startWidth }

    const onMove = (ev: MouseEvent) => {
      if (!resizeState.current) return
      const delta = ev.clientX - resizeState.current.startX
      const next = Math.max(80, Math.min(480, resizeState.current.startWidth + delta))
      setColWidths(prev => ({ ...prev, [resizeState.current!.key]: next }))
    }

    const onUp = () => {
      resizeState.current = null
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  function triggerUpload(rowId: string) {
    if (rows.find(r => r.id === rowId)?.images.length === 3) return
    uploadForRef.current = rowId
    setUploadingIds(prev => new Set([...prev, rowId]))
    fileInputRef.current?.click()
  }

  function removeImage(rowId: string, idx: number) {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, images: r.images.filter((_, i) => i !== idx) } : r))
  }

  // ── Import ── THE FIX: token check before setPhase, try/finally ─────────────
  async function handleImport() {
    const filled = rows.filter(r => r.product_name.trim())
    if (!filled.length) return

    const validated = filled.map((r, i) => toValidatedRow(r, i, catMap))
    const newErrors = new Map<string, string[]>()
    filled.forEach((r, i) => { if (validated[i].errors.length) newErrors.set(r.id, validated[i].errors) })
    setErrors(newErrors)

    // Prevent partial imports that feel "random" to users.
    // If any filled row is invalid, stop and ask for fixes first.
    if (newErrors.size > 0) {
      setImportError(
        `${newErrors.size} row${newErrors.size !== 1 ? "s" : ""} still ${newErrors.size !== 1 ? "have" : "has"} validation errors. Fix highlighted rows, then import again.`,
      )
      return
    }

    const importable = validated.filter(r => r.overallStatus !== "error")
    if (!importable.length) return // stay on edit view, errors shown inline

    // Get token FIRST — before switching phase
    const token = await getAccessToken()
    if (!token) {
      setImportError("Session expired. Please refresh and try again.")
      return
    }

    if (!storeId) {
      setImportError("No store found. Please complete seller onboarding first.")
      return
    }

    setImportTotal(importable.length)
    setImportResults([])
    setImportError(null)
    setPhase("importing") // only set AFTER we have token + storeId

    try {
      await importRows(importable, storeId, token, (_, result) => {
        setImportResults(prev => [...prev, result])
      })
    } catch (err) {
      console.error("[GridEditor] importRows failed:", err)
      setImportError(err instanceof Error ? err.message : "Import failed. Check console for details.")
    } finally {
      setPhase("done") // always reach done, even on error
    }
  }

  const filledCount = rows.filter(r => r.product_name.trim()).length
  const errorCount = [...errors.values()].filter(e => e.length > 0).length

  if (phase === "importing" || phase === "done") {
    return <GridImportProgress results={importResults} total={importTotal} done={phase === "done"} />
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-xs font-semibold text-blue-900">Quick tips</p>
        <p className="mt-1 text-xs text-blue-800">
          Hover highlighted row messages to see exact fixes. For best mapping, rename media files in Media Library and add searchable metadata (e.g. rice,jasmine,5kg,front).
        </p>
      </div>
      {errorCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{errorCount} row{errorCount !== 1 ? "s have" : " has"} errors highlighted below.</p>
        </div>
      )}
      {importError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{importError}</p>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full border-collapse text-sm" style={{ minWidth: 1100 }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wide">
                <th className="border-r border-gray-200 px-2.5 py-2.5 text-gray-400 w-7 text-center">#</th>
                <th
                  className="relative border-r border-gray-200 px-2.5 py-2.5 text-gray-500 text-left"
                  style={{ width: colWidths.product_name, minWidth: colWidths.product_name }}
                >
                  <span>Product Name *</span>
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none"
                    onMouseDown={(e) => handleResizeMouseDown("product_name", e)}
                  />
                </th>
                <th
                  className="relative border-r border-gray-200 px-2.5 py-2.5 text-gray-500 text-left"
                  style={{ width: colWidths.description, minWidth: colWidths.description }}
                >
                  <span>Description *</span>
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none"
                    onMouseDown={(e) => handleResizeMouseDown("description", e)}
                  />
                </th>
                <th
                  className="relative border-r border-gray-200 px-2.5 py-2.5 text-gray-500 text-left"
                  style={{ width: colWidths.category, minWidth: colWidths.category }}
                >
                  <span>Category *</span>
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none"
                    onMouseDown={(e) => handleResizeMouseDown("category", e)}
                  />
                </th>
                <th
                  className="relative border-r border-gray-200 px-2.5 py-2.5 text-gray-500 text-left"
                  style={{ width: colWidths.price, minWidth: colWidths.price }}
                >
                  <span>Price *</span>
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none"
                    onMouseDown={(e) => handleResizeMouseDown("price", e)}
                  />
                </th>
                <th
                  className="relative border-r border-gray-200 px-2.5 py-2.5 text-gray-500 text-left"
                  style={{ width: colWidths.compare_at_price, minWidth: colWidths.compare_at_price }}
                >
                  <span>Compare $</span>
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none"
                    onMouseDown={(e) => handleResizeMouseDown("compare_at_price", e)}
                  />
                </th>
                <th
                  className="relative border-r border-gray-200 px-2.5 py-2.5 text-gray-500 text-left"
                  style={{ width: colWidths.stock, minWidth: colWidths.stock }}
                >
                  <span>Stock *</span>
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none"
                    onMouseDown={(e) => handleResizeMouseDown("stock", e)}
                  />
                </th>
                <th
                  className="relative border-r border-gray-200 px-2.5 py-2.5 text-gray-500 text-left"
                  style={{ width: colWidths.weight, minWidth: colWidths.weight }}
                >
                  <span>Weight *</span>
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none"
                    onMouseDown={(e) => handleResizeMouseDown("weight", e)}
                  />
                </th>
                <th
                  className="relative border-r border-gray-200 px-2.5 py-2.5 text-gray-500 text-left"
                  style={{ width: colWidths.brand, minWidth: colWidths.brand }}
                >
                  <span>Brand</span>
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none"
                    onMouseDown={(e) => handleResizeMouseDown("brand", e)}
                  />
                </th>
                <th
                  className="relative border-r border-gray-200 px-2.5 py-2.5 text-gray-500 text-left"
                  style={{ width: colWidths.tags, minWidth: colWidths.tags }}
                >
                  <span>Tags</span>
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none"
                    onMouseDown={(e) => handleResizeMouseDown("tags", e)}
                  />
                </th>
                <th
                  className="relative border-r border-gray-200 px-2.5 py-2.5 text-gray-500 text-left"
                  style={{ width: colWidths.status, minWidth: colWidths.status }}
                >
                  <span>Status</span>
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none"
                    onMouseDown={(e) => handleResizeMouseDown("status", e)}
                  />
                </th>
                <th
                  className="relative border-r border-gray-200 px-2.5 py-2.5 text-gray-500 text-left"
                  style={{ width: colWidths.images, minWidth: colWidths.images }}
                >
                  <span>Images (max 3)</span>
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none"
                    onMouseDown={(e) => handleResizeMouseDown("images", e)}
                  />
                </th>
                <th className="px-2 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const rowErrors = errors.get(row.id) ?? []
                const hasErr = rowErrors.length > 0
                return (
                  <tr key={row.id} className={cn("border-b border-gray-100 group transition-colors",
                    hasErr ? "bg-red-50/40" : "hover:bg-gray-50/30")}>

                    {/* # */}
                    <td className="border-r border-gray-100 text-center text-xs text-gray-400 font-mono py-0">{i + 1}</td>

                    {/* Product Name */}
                    <td
                      className={cn(TD, hasErr && "border-l-2 border-l-red-400")}
                      style={{ width: colWidths.product_name, minWidth: colWidths.product_name }}
                    >
                      <div>
                        <input type="text" placeholder="Product name" value={row.product_name}
                          onChange={e => update(row.id, "product_name", e.target.value)}
                          className={cn(CELL, "h-9")} />
                        {hasErr && (
                          <div className="px-2.5 pb-1">
                            {rowErrors.map((e) => (
                              <div key={e} className="mb-1 rounded-md border border-red-100 bg-red-50 px-1.5 py-1">
                                <p className="text-[10px] leading-tight text-red-700">{e}</p>
                                <p className="mt-0.5 text-[10px] leading-tight text-red-700/90">
                                  Fix: {fixHintForError(e)}
                                </p>
                              </div>
                            ))}
                            {row.images.length === 0 && (
                              <div className="rounded-md border border-yellow-100 bg-yellow-50 px-1.5 py-1">
                                <p className="text-[10px] leading-tight text-yellow-700">No images set</p>
                                <p className="mt-0.5 text-[10px] leading-tight text-yellow-700/90">
                                  Tip: Add at least one image (Upload or Library) so this product is ready for listing.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Description */}
                    <td
                      className={TD}
                      style={{ width: colWidths.description, minWidth: colWidths.description }}
                    >
                      <input type="text" placeholder="Short description" value={row.description}
                        onChange={e => update(row.id, "description", e.target.value)}
                        className={cn(CELL, "h-9")} />
                    </td>

                    {/* Category */}
                    <td
                      className={TD}
                      style={{ width: colWidths.category, minWidth: colWidths.category }}
                    >
                      <select value={row.category} onChange={e => update(row.id, "category", e.target.value)}
                        className={cn(CELL, "h-9 cursor-pointer appearance-none")}>
                        <option value="">— Select —</option>
                        {catOptions.map(opt => (
                          <option key={`${opt.isChild ? "c" : "p"}-${opt.value}`} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Price */}
                    <td
                      className={TD}
                      style={{ width: colWidths.price, minWidth: colWidths.price }}
                    >
                      <div className="flex items-center h-9">
                        <span className="pl-2.5 text-xs text-gray-400 shrink-0">$</span>
                        <input type="number" placeholder="0.00" min="0" step="0.01" value={row.price}
                          onChange={e => update(row.id, "price", e.target.value)}
                          className={cn(CELL, "h-full pl-1")} />
                      </div>
                    </td>

                    {/* Compare at price */}
                    <td
                      className={TD}
                      style={{ width: colWidths.compare_at_price, minWidth: colWidths.compare_at_price }}
                    >
                      <div className="flex items-center h-9">
                        <span className="pl-2.5 text-xs text-gray-400 shrink-0">$</span>
                        <input type="number" placeholder="0.00" min="0" step="0.01" value={row.compare_at_price}
                          onChange={e => update(row.id, "compare_at_price", e.target.value)}
                          className={cn(CELL, "h-full pl-1")} />
                      </div>
                    </td>

                    {/* Stock */}
                    <td
                      className={TD}
                      style={{ width: colWidths.stock, minWidth: colWidths.stock }}
                    >
                      <input type="number" placeholder="0" min="0" step="1" value={row.stock}
                        onChange={e => update(row.id, "stock", e.target.value)}
                        className={cn(CELL, "h-9")} />
                    </td>

                    {/* Weight */}
                    <td
                      className={TD}
                      style={{ width: colWidths.weight, minWidth: colWidths.weight }}
                    >
                      <div className="flex items-center h-9">
                        <input type="number" placeholder="0.0" min="0" step="0.1" value={row.weight}
                          onChange={e => update(row.id, "weight", e.target.value)}
                          className={cn(CELL, "h-full flex-1 min-w-0")} />
                        <select value={row.weight_unit} onChange={e => update(row.id, "weight_unit", e.target.value as "lb" | "kg")}
                          className="h-full shrink-0 border-l border-gray-100 bg-gray-50 px-1 text-[11px] text-gray-500 outline-none cursor-pointer">
                          <option value="lb">lb</option>
                          <option value="kg">kg</option>
                        </select>
                      </div>
                    </td>

                    {/* Brand */}
                    <td
                      className={TD}
                      style={{ width: colWidths.brand, minWidth: colWidths.brand }}
                    >
                      <input type="text" placeholder="Brand name" value={row.brand}
                        onChange={e => update(row.id, "brand", e.target.value)}
                        className={cn(CELL, "h-9")} />
                    </td>

                    {/* Tags */}
                    <td
                      className={TD}
                      style={{ width: colWidths.tags, minWidth: colWidths.tags }}
                    >
                      <input type="text" placeholder="tag1,tag2" value={row.tags}
                        onChange={e => update(row.id, "tags", e.target.value)}
                        className={cn(CELL, "h-9")} />
                    </td>

                    {/* Status */}
                    <td
                      className={TD}
                      style={{ width: colWidths.status, minWidth: colWidths.status }}
                    >
                      <select value={row.status} onChange={e => update(row.id, "status", e.target.value as GridRow["status"])}
                        className={cn(CELL, "h-9 cursor-pointer appearance-none")}>
                        <option value="draft">Draft</option>
                        <option value="pending_review">Submit for Review</option>
                      </select>
                    </td>

                    {/* Images */}
                    <td
                      className="border-r border-gray-100 p-0 align-middle"
                      style={{ width: colWidths.images, minWidth: colWidths.images }}
                    >
                      <ImagesCell
                        rowId={row.id}
                        images={row.images}
                        uploading={uploadingIds.has(row.id)}
                        onUpload={() => triggerUpload(row.id)}
                        onLibrary={() => setPickerRowId(row.id)}
                        onRemove={(idx) => removeImage(row.id, idx)}
                      />
                    </td>

                    {/* Delete row */}
                    <td className="px-1.5 text-center align-middle">
                      <button onClick={() => setRows(prev => prev.filter(r => r.id !== row.id))}
                        className="flex h-6 w-6 items-center justify-center rounded opacity-0 group-hover:opacity-100 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 bg-gray-50/50">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setRows(prev => [...prev, ...makeRows(5)])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add 5 rows
            </button>
            <button onClick={() => setRows(prev => [...prev, ...makeRows(10)])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add 10 rows
            </button>
            {rows.some(r => !r.product_name.trim()) && (
              <button onClick={() => setRows(prev => prev.filter(r => r.product_name.trim()))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
                <Trash2 className="h-3.5 w-3.5" /> Clear empty
              </button>
            )}
          </div>
          <span className="text-xs text-gray-400">{rows.length} rows · {filledCount} filled</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {filledCount > 0
            ? `${filledCount} product${filledCount !== 1 ? "s" : ""} ready — status "Submit for Review" goes to admin queue`
            : "Fill in at least one row to import"}
        </p>
        <button onClick={handleImport} disabled={filledCount === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-[#EAB308] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#CA8A04] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Sparkles className="h-4 w-4" />
          Import {filledCount || ""} Product{filledCount !== 1 ? "s" : ""}
        </button>
      </div>

      {/* Shared file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0]
          if (file) {
            try { await startUpload([file]) }
            catch {
              const id = uploadForRef.current
              if (id) setUploadingIds(p => { const s = new Set(p); s.delete(id); return s })
              uploadForRef.current = null
            }
          }
          e.target.value = ""
        }} />

      {/* Media picker modal */}
      {pickerRowId && (
        <MediaPickerModal
          mediaItems={mediaItems.filter(m => !rows.find(r => r.id === pickerRowId)?.images.some(img => img.id === m.id))}
          onSelect={item => {
            setRows(prev => prev.map(r => r.id === pickerRowId && r.images.length < 3 ? { ...r, images: [...r.images, item] } : r))
            setPickerRowId(null)
          }}
          onClose={() => setPickerRowId(null)}
        />
      )}
    </div>
  )
}
