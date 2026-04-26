"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  ImageIcon,
  FileSpreadsheet,
  ChevronRight,
  Info,
  Package,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getCurrentSeller,
  getSellerStores,
  getCategories,
  getSellerMedia,
  type CategoryRef,
  type MediaItem,
  type StoreDetail,
} from "@/lib/api"
import {
  generateTemplate,
  parseSpreadsheet,
  validateRows,
  importRows,
  flattenCategories,
  type ValidatedRow,
  type ImportResult,
} from "@/lib/bulk-import"
import GridEditor from "./GridEditor"

// ────────────────────────────────────────────────────────────────────

const STEP_LABELS = ["Prepare", "Review", "Import"]

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const idx = i + 1
        const done = step > idx
        const active = step === idx
        return (
          <div key={label} className="flex items-center gap-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all",
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-primary text-black"
                      : "bg-gray-100 text-gray-400",
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : idx}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-gray-900" : "text-gray-400",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  "mb-5 h-px w-16 transition-all",
                  step > idx ? "bg-emerald-500" : "bg-gray-200",
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ValidatedRow["overallStatus"] }) {
  if (status === "ready")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Ready
      </span>
    )
  if (status === "warning")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
        <AlertCircle className="h-3 w-3" /> No images
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      <XCircle className="h-3 w-3" /> Error
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────

function fixHintForError(error: string): string {
  const e = error.toLowerCase()
  if (e.includes("product name")) return "Use at least 3 characters, for example: Organic Jasmine Rice."
  if (e.includes("description")) return "Add a clear description with at least 10 characters."
  if (e.includes("category") && e.includes("not found")) return "Pick a category exactly as listed in the Categories sheet."
  if (e.includes("category is required")) return "Fill the category column using a valid category name."
  if (e.includes("price")) return "Use a positive number like 19.99 (no currency symbol)."
  if (e.includes("stock")) return "Use a whole number 0 or higher."
  if (e.includes("status")) return 'Use only "draft" or "pending_review".'
  if (e.includes("tags")) return "Limit to 10 tags, separated by commas."
  return "Review this field value and match the template format."
}

function fixHintForWarning(warning: string): string {
  const w = warning.toLowerCase()
  if (w.includes("no images found")) {
    return 'Use image_group with numbered filenames (e.g. rice_1.jpg) or upload media with matching keywords in name/description.'
  }
  if (w.includes("no image group")) {
    return "Set image_group so products auto-link to media. Example: rice."
  }
  return "You can import with warnings, but fixing them improves product quality."
}

// ────────────────────────────────────────────────────────────────────

function NamingGuide() {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-blue-600 shrink-0" />
        <p className="text-sm font-semibold text-blue-900">Image Naming Convention</p>
      </div>
      <div className="space-y-2 text-sm text-blue-800">
        <p>
          Name your images with a <strong>base name + underscore + number</strong>:
        </p>
        <div className="rounded-lg bg-blue-100 px-3 py-2 font-mono text-xs space-y-0.5">
          <div>yam<span className="text-blue-500">_1</span>.jpg</div>
          <div>yam<span className="text-blue-500">_2</span>.jpg</div>
          <div>yam<span className="text-blue-500">_3</span>.jpg</div>
        </div>
        <p>
          Then in the spreadsheet, write just the base name:{" "}
          <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs">yam</code>.
          We'll automatically link all 3 images to your product.
        </p>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
//  Step 1 — Prepare
// ────────────────────────────────────────────────────────────────────

function PrepareStep({
  mediaItems,
  categories,
  onDownload,
  onNext,
}: {
  mediaItems: MediaItem[]
  categories: CategoryRef[]
  onDownload: () => void
  onNext: () => void
}) {
  return (
    <div className="space-y-5">
      {/* Media check */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Step 1 — Upload Your Images First</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              All product images must be in your Media Library before importing.
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ImageIcon className="h-5 w-5 text-primary" />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
          {mediaItems.length > 0 ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {mediaItems.length > 0
                ? `${mediaItems.length} image${mediaItems.length !== 1 ? "s" : ""} in your Media Library`
                : "No images uploaded yet"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {mediaItems.length > 0
                ? "These filenames will be available in your template's _media_library sheet."
                : "Upload images before filling the template."}
            </p>
          </div>
          <Link
            href="/dashboard/upload"
            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {mediaItems.length > 0 ? "Manage" : "Upload images"}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <NamingGuide />

      </div>

      {/* Download template */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Step 2 — Download & Fill the Template</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              The template includes your media filenames and category list.
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-black hover:bg-primary/90 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download Excel Template (.xlsx)
          </button>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100">
          {[
            ["product_name", "Required — at least 3 characters"],
            ["description", "Required — at least 10 characters"],
            ["category", "Required — must match a category name (see Categories tab)"],
            ["price", "Required — positive number (USD)"],
            ["stock", "Required — integer ≥ 0"],
            ["image_group", "Base name for images (e.g. \"yam\" → yam_1.jpg, yam_2.jpg, yam_3.jpg)"],
            ["status", '"draft" or "pending_review"'],
            ["compare_at_price, brand, weight_lbs, tags", "Optional"],
          ].map(([field, desc]) => (
            <div key={field} className="flex gap-3 px-4 py-2.5">
              <code className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[11px] font-mono text-gray-700 self-start">
                {field}
              </code>
              <p className="text-xs text-gray-500 self-center">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
        >
          I've filled the template — Upload it
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
//  Step 2 — Upload & Review
// ────────────────────────────────────────────────────────────────────

function ReviewStep({
  categories,
  mediaItems,
  onValidated,
  onBack,
  onOpenMediaUpload,
  onRefreshMedia,
  refreshingMedia,
}: {
  categories: CategoryRef[]
  mediaItems: MediaItem[]
  onValidated: (rows: ValidatedRow[]) => void
  onBack: () => void
  onOpenMediaUpload: () => void
  onRefreshMedia: () => void
  refreshingMedia: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [rows, setRows] = useState<ValidatedRow[] | null>(null)
  const [fileName, setFileName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const errorCount = rows?.filter((r) => r.overallStatus === "error").length ?? 0
  const warningCount = rows?.filter((r) => r.overallStatus === "warning").length ?? 0
  const readyCount = rows?.filter((r) => r.overallStatus === "ready").length ?? 0
  const importableCount = rows?.filter((r) => r.overallStatus !== "error").length ?? 0

  async function processFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
      setParseError("Please upload an .xlsx, .xls, or .csv file.")
      return
    }
    setParsing(true)
    setParseError(null)
    setRows(null)
    setFileName(file.name)
    try {
      const raw = await parseSpreadsheet(file)
      if (raw.length === 0) {
        setParseError("No product rows found. Make sure the file has data rows below the header.")
        return
      }
      const catMap = flattenCategories(categories)
      const validated = validateRows(raw, catMap, mediaItems)
      setRows(validated)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to parse file")
    } finally {
      setParsing(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  return (
    <div className="space-y-5">
      {/* Context helper */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-900">Step 2: Upload and review your template</p>
            <p className="mt-1 text-xs text-blue-800">
              Need to upload more images first? Open Media Upload, add files, then come back here and click
              refresh. You do not need to restart this flow.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onOpenMediaUpload}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              Open Media Upload
              <ChevronRight className="h-3 w-3" />
            </button>
            <button
              onClick={onRefreshMedia}
              disabled={refreshingMedia}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-60"
            >
              {refreshingMedia ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Refresh media ({mediaItems.length})
            </button>
          </div>
        </div>
      </div>

      {/* CSV notice */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <strong>Tip:</strong> Use <strong>.xlsx</strong> for the best experience — it includes
          dropdown validations, your media library reference, and the naming guide. CSV is supported
          but you lose those features.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-12 transition-all",
          dragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : rows
              ? "border-emerald-300 bg-emerald-50"
              : "border-gray-200 bg-gray-50 hover:border-primary/50 hover:bg-primary/90/5",
        )}
      >
        {parsing ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-3 text-sm font-medium text-gray-900">Parsing your file…</p>
          </>
        ) : rows ? (
          <>
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="mt-3 text-sm font-semibold text-gray-900">{fileName}</p>
            <p className="mt-1 text-xs text-gray-500">{rows.length} rows detected — click to replace</p>
          </>
        ) : (
          <>
            <div className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
              dragging ? "bg-primary/20" : "bg-gray-100"
            )}>
              <Upload className={cn("h-6 w-6 transition-colors", dragging ? "text-primary" : "text-gray-400")} />
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900">
              Drag & drop your file, or click to browse
            </p>
            <p className="mt-1 text-xs text-gray-500">.xlsx, .xls, or .csv</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) processFile(file)
            e.target.value = ""
          }}
        />
      </div>

      {parseError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{parseError}</p>
        </div>
      )}

      {/* Validation results */}
      {rows && rows.length > 0 && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {readyCount} ready
            </span>
            {warningCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-3 py-1 text-sm font-medium text-yellow-700">
                <AlertCircle className="h-3.5 w-3.5" />
                {warningCount} no images
              </span>
            )}
            {errorCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
                <XCircle className="h-3.5 w-3.5" />
                {errorCount} errors (will be skipped)
              </span>
            )}
          </div>

          {/* Validation table */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Row</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Product</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Category</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Price / Stock</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Images</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={cn(
                        "transition-colors",
                        row.overallStatus === "error" && "bg-red-50/40",
                        row.overallStatus === "warning" && "bg-yellow-50/30",
                      )}
                    >
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{row.rowNumber}</td>

                      {/* Product name + errors */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {row.raw.product_name || <span className="text-gray-400 italic">empty</span>}
                        </p>
                        {row.errors.map((e) => (
                          <div key={e} className="mt-0.5 rounded-md border border-red-100 bg-red-50 px-2 py-1.5">
                            <p className="text-[11px] text-red-700 flex items-start gap-1">
                              <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                              {e}
                            </p>
                            <p className="mt-1 text-[10px] text-red-700/90">
                              Fix: {fixHintForError(e)}
                            </p>
                          </div>
                        ))}
                        {row.warnings.map((w) => (
                          <div key={w} className="mt-0.5 rounded-md border border-yellow-100 bg-yellow-50 px-2 py-1.5">
                            <p className="text-[11px] text-yellow-700 flex items-start gap-1">
                              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                              {w}
                            </p>
                            <p className="mt-1 text-[10px] text-yellow-700/90">
                              Tip: {fixHintForWarning(w)}
                            </p>
                          </div>
                        ))}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-xs rounded-full px-2 py-0.5",
                          row.categoryId
                            ? "bg-gray-100 text-gray-700"
                            : "bg-red-100 text-red-700",
                        )}>
                          {row.raw.category || "—"}
                        </span>
                      </td>

                      {/* Price / Stock */}
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <span>${row.raw.price || "—"}</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span>{row.raw.stock || "—"} in stock</span>
                      </td>

                      {/* Images */}
                      <td className="px-4 py-3">
                        {row.resolvedImages.length > 0 ? (
                          <div className="flex gap-1">
                            {row.resolvedImages.map((img, idx) => (
                              <div
                                key={img.id}
                                className="relative h-9 w-9 overflow-hidden rounded-md border border-gray-200"
                              >
                                <Image src={img.url} alt={img.name} fill sizes="36px" className="object-cover" />
                                {idx === 0 && (
                                  <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-primary border border-white" title="Primary" />
                                )}
                              </div>
                            ))}
                            <span className="self-center text-xs text-gray-400 ml-1">
                              {row.resolvedImages.length} img{row.resolvedImages.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            {row.raw.image_group ? "Not found" : "None"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge status={row.overallStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {importableCount > 0
                ? `Ready to import ${importableCount} product${importableCount !== 1 ? "s" : ""}${errorCount > 0 ? ` after fixing ${errorCount} blocked row${errorCount !== 1 ? "s" : ""}` : ""}.`
                : "All rows are blocked by errors. Fix the highlighted rows or re-upload the corrected file."}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => onValidated(rows)}
                disabled={importableCount === 0 || errorCount > 0}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-black hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-4 w-4" />
                Import {importableCount} product{importableCount !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
          {errorCount > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-xs text-red-700">
                Import is blocked until all row errors are fixed. Warnings (like missing images) can still be imported, but fixing images is recommended for best product quality.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
//  Step 3 — Import Progress
// ────────────────────────────────────────────────────────────────────

function ImportStep({
  rows,
  storeId,
  onDone,
}: {
  rows: ValidatedRow[]
  storeId: string
  onDone: (results: ImportResult[]) => void
}) {
  const importable = rows.filter((r) => r.overallStatus !== "error")
  const [results, setResults] = useState<ImportResult[]>([])
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  const progress = importable.length > 0 ? (results.length / importable.length) * 100 : 100

  useEffect(() => {
    if (started) return
    setStarted(true)

    async function run() {
      try {
        const token = await getAccessToken()
        if (!token) {
          setRuntimeError("Your session expired. Refresh this page and try importing again.")
          setDone(true)
          return
        }
        if (!storeId) {
          setRuntimeError("No active store found for this seller. Create/select a store first.")
          setDone(true)
          return
        }

        const final = await importRows(importable, storeId, token, (_, result) => {
          setResults((prev) => [...prev, result])
        })
        onDone(final)
      } catch (err) {
        setRuntimeError(err instanceof Error ? err.message : "Import failed unexpectedly. Please retry.")
      } finally {
        setDone(true)
      }
    }
    run()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const successCount = results.filter((r) => r.status === "success").length
  const failCount = results.filter((r) => r.status === "error").length
  const skippedCount = rows.filter((r) => r.overallStatus === "error").length

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {done ? "Import Complete!" : "Importing products…"}
          </h2>
          <span className="text-sm text-gray-500">
            {results.length} / {importable.length}
          </span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {done && (
          <div className="flex flex-wrap gap-3 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {successCount} created
            </span>
            {failCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
                <XCircle className="h-3.5 w-3.5" />
                {failCount} failed
              </span>
            )}
            {skippedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                {skippedCount} skipped (had errors)
              </span>
            )}
          </div>
        )}
        {runtimeError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-xs text-red-700">{runtimeError}</p>
          </div>
        )}
      </div>

      {/* Per-row results */}
      <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-50">
        {results.map((r) => (
          <div key={r.rowNumber} className="flex items-center gap-3 px-5 py-3">
            {r.status === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{r.productName}</p>
              {r.error && <p className="text-xs text-red-600 mt-0.5">{r.error}</p>}
            </div>
            <span className="text-xs text-gray-400 font-mono shrink-0">row {r.rowNumber}</span>
          </div>
        ))}

        {/* In-flight spinner for rows not yet processed */}
        {!done &&
          importable.slice(results.length, results.length + 3).map((row) => (
            <div key={row.rowNumber} className="flex items-center gap-3 px-5 py-3 opacity-50">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              <p className="text-sm text-gray-500 truncate">{row.raw.product_name}</p>
            </div>
          ))}
      </div>

      {done && (
        <div className="flex justify-end">
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-black hover:bg-primary/90 transition-colors"
          >
            <Package className="h-4 w-4" />
            View My Products
          </Link>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
//  Page
// ────────────────────────────────────────────────────────────────────

export default function BulkImportPage() {
  const { status: sessionStatus } = useSession()

  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState("")
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [tab, setTab] = useState<"spreadsheet" | "grid">("spreadsheet")
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([])
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshingMedia, setRefreshingMedia] = useState(false)

  const loadData = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) return
    setLoading(true)
    try {
      // Four requests in flight. Only getSellerStores depends on seller.id —
      // chain it off the seller promise so the other three (categories,
      // media, seller-self) all race in parallel. Previously this ran as
      // two serial Promise.all batches, wasting a full round-trip of wall
      // time (typically the media fetch, which lists up to 500 items).
      const sellerP = getCurrentSeller(token)
      const catsP = getCategories()
      const mediaP = getSellerMedia(token, 1, 500)
      const storesP = sellerP.then((s) => getSellerStores(token, s.id))

      const [seller, cats, media, stores] = await Promise.all([
        sellerP, catsP, mediaP, storesP,
      ])
      void seller // reserved for future use; kept to fail-fast if token invalid
      setCategories(cats)
      setMediaItems(media.items ?? [])
      if (stores.length > 0) setStoreId(stores[0].id)
      else setError("You need to create a store before importing products.")
    } catch {
      setError("Failed to load data. Please refresh and try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === "authenticated") loadData()
    else if (sessionStatus === "unauthenticated") setLoading(false)
  }, [sessionStatus, loadData])

  async function handleDownload() {
    // `generateTemplate` lazy-loads the xlsx library (~400KB parsed) on first use,
    // so the download is slightly deferred on cold cache but the rest of the page
    // stays lean.
    await generateTemplate(categories, mediaItems)
  }

  function handleValidated(rows: ValidatedRow[]) {
    setValidatedRows(rows)
    setStep(3)
  }

  async function refreshMediaOnly() {
    const token = await getAccessToken()
    if (!token) {
      setError("Your session expired. Refresh the page and try again.")
      return
    }
    setRefreshingMedia(true)
    try {
      const media = await getSellerMedia(token, 1, 500)
      setMediaItems(media.items ?? [])
    } catch {
      setError("Could not refresh media right now. Please try again.")
    } finally {
      setRefreshingMedia(false)
    }
  }

  if (loading || sessionStatus === "loading") {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/products"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Product Import</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Upload dozens of products at once using a spreadsheet
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1">
        {(["spreadsheet", "grid"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-all",
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}>
            {t === "spreadsheet" ? "📥  Spreadsheet Import" : "📝  Table Editor"}
          </button>
        ))}
      </div>

      {/* Step indicator — only for spreadsheet mode */}
      {tab === "spreadsheet" && (
        <div className="flex justify-center">
          <StepIndicator step={step} />
        </div>
      )}

      {/* Spreadsheet Import */}
      {tab === "spreadsheet" && step === 1 && (
        <PrepareStep
          mediaItems={mediaItems}
          categories={categories}
          onDownload={handleDownload}
          onNext={() => setStep(2)}
        />
      )}
      {tab === "spreadsheet" && step === 2 && (
        <ReviewStep
          categories={categories}
          mediaItems={mediaItems}
          onValidated={handleValidated}
          onBack={() => setStep(1)}
          onOpenMediaUpload={() => window.open("/dashboard/upload?returnTo=/dashboard/products/bulk-import", "_blank", "noopener,noreferrer")}
          onRefreshMedia={refreshMediaOnly}
          refreshingMedia={refreshingMedia}
        />
      )}
      {tab === "spreadsheet" && step === 3 && (
        <ImportStep
          rows={validatedRows}
          storeId={storeId}
          onDone={(results) => setImportResults(results)}
        />
      )}

      {/* Table Editor */}
      {tab === "grid" && (
        <GridEditor
          categories={categories}
          mediaItems={mediaItems}
          storeId={storeId}
        />
      )}
    </div>
  )
}
