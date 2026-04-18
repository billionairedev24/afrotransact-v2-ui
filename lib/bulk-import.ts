/**
 * lib/bulk-import.ts
 *
 * Client-side utilities for the Bulk Product Import wizard.
 *
 * Image matching strategy:
 *   1) Prefer numbered naming convention:
 *      yam_1.jpg, yam_2.jpg, yam_3.jpg + image_group=yam
 *   2) Fallback to metadata/name matching:
 *      image_group is matched against media name + media description keywords.
 *      This supports production use cases where sellers upload files with
 *      meaningful metadata rather than strict numbered filenames.
 */

// `xlsx` is ~400KB parsed. It is intentionally NOT imported at the top level
// so pages that merely link to bulk-import routes do not pay the bundle cost.
// Callers load it lazily via `loadXLSX()` inside each function below.
import type { CategoryRef, MediaItem } from "./api"

type XLSXModule = typeof import("xlsx")
let xlsxPromise: Promise<XLSXModule> | null = null
function loadXLSX(): Promise<XLSXModule> {
  if (!xlsxPromise) {
    xlsxPromise = import("xlsx")
  }
  return xlsxPromise
}

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RawRow {
  rowNumber: number
  product_name: string
  description: string
  category: string
  price: string
  compare_at_price: string
  stock: string
  brand: string
  weight_lbs: string
  tags: string
  sku: string
  status: string
  image_group: string
}

export interface ValidatedRow {
  rowNumber: number
  raw: RawRow
  errors: string[]
  warnings: string[]
  resolvedImages: MediaItem[]
  categoryId: string | null
  overallStatus: "ready" | "warning" | "error"
}

export interface ImportResult {
  rowNumber: number
  productName: string
  status: "success" | "error" | "skipped"
  error?: string
  productId?: string
}

// ─────────────────────────────────────────────────────────────────────────────
//  Image resolution — the core logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a group name like "yam", find all media items whose filename matches
 * the pattern: yam_1.jpg, yam_2.jpg, yam_3.jpg  (case-insensitive)
 * Returns sorted by trailing number, max 3 items.
 */
export function resolveImageGroup(
  groupName: string,
  mediaItems: MediaItem[],
): MediaItem[] {
  const trimmed = groupName.trim()
  if (!trimmed) return []

  // Strip extension if seller accidentally typed "yam.jpg" instead of "yam"
  const base = trimmed.replace(/\.(jpg|jpeg|png|webp|gif)$/i, "")

  // Escape regex special chars in the base name
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  const pattern = new RegExp(
    `^${escaped}_\\d+\\.(jpg|jpeg|png|webp|gif)$`,
    "i",
  )

  const matched = mediaItems.filter((m) => pattern.test(m.name))

  // Sort by the numeric suffix (yam_1 < yam_2 < yam_10)
  matched.sort((a, b) => {
    const numA = parseInt(a.name.match(/_(\d+)\.[^.]+$/)?.[1] ?? "0", 10)
    const numB = parseInt(b.name.match(/_(\d+)\.[^.]+$/)?.[1] ?? "0", 10)
    return numA - numB
  })

  if (matched.length > 0) return matched.slice(0, 3)

  // Metadata fallback: score by token overlap against name + description
  const tokens = base
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)

  if (tokens.length === 0) return []

  const scored = mediaItems
    .map((m) => {
      const haystack = `${m.name ?? ""} ${m.description ?? ""}`.toLowerCase()
      let score = 0
      for (const t of tokens) {
        if (haystack.includes(` ${t} `) || haystack.startsWith(`${t} `) || haystack.endsWith(` ${t}`)) score += 3
        else if (haystack.includes(t)) score += 1
      }
      return { item: m, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, 3).map((x) => x.item)
}

// ─────────────────────────────────────────────────────────────────────────────
//  Category flattening + lookup
// ─────────────────────────────────────────────────────────────────────────────

/** Normalizes spreadsheet / API text so category matching survives Excel quirks (NBSP, etc.). */
export function normalizeCategoryKey(raw: string): string {
  return raw
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/[\u2000-\u200a\u202f\u205f\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
}

function registerCategoryAliases(map: Map<string, string>, id: string, name: string, slug?: string | null) {
  const nk = normalizeCategoryKey(name)
  if (nk) map.set(nk, id)
  const s = slug?.trim()
  if (s) {
    map.set(s.toLowerCase(), id)
    const fromSlug = normalizeCategoryKey(s.replace(/-/g, " "))
    if (fromSlug && fromSlug !== nk) map.set(fromSlug, id)
  }
}

export function flattenCategories(cats: CategoryRef[]): Map<string, string> {
  const map = new Map<string, string>()
  function walk(nodes: CategoryRef[]) {
    for (const c of nodes) {
      registerCategoryAliases(map, c.id, c.name, c.slug)
      if (c.children?.length) walk(c.children)
    }
  }
  walk(cats)
  return map
}

/** Display names in catalog order — use for the Categories sheet (exact API names). */
export function collectCategoryDisplayNames(cats: CategoryRef[]): string[] {
  const out: string[] = []
  function walk(nodes: CategoryRef[]) {
    for (const c of nodes) {
      out.push(c.name.trim())
      if (c.children?.length) walk(c.children)
    }
  }
  walk(cats)
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  Template generation
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_HEADERS = [
  "product_name",
  "description",
  "category",
  "price",
  "compare_at_price",
  "stock",
  "brand",
  "weight_lbs",
  "tags",
  "status",
  "image_group",
]

const COL_WIDTHS = [30, 50, 20, 10, 15, 10, 20, 12, 30, 15, 25]

export async function generateTemplate(
  categories: CategoryRef[],
  mediaItems: MediaItem[],
): Promise<void> {
  const XLSX = await loadXLSX()
  const wb = XLSX.utils.book_new()

  // ── Products sheet ──────────────────────────────────────────────────────────
  const displayNames = collectCategoryDisplayNames(categories)
  const firstCat = displayNames[0] ?? "Skincare"

  const sampleRow = [
    "Organic Shea Butter",
    "Rich moisturizing shea butter sourced from West Africa. Perfect for dry skin and hair.",
    firstCat,
    "19.99",
    "24.99",
    "50",
    "Afrot Naturals",
    "0.5",
    "shea,moisturizer,organic",
    "draft",
    "shea_butter",
  ]

  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, sampleRow])
  ws["!cols"] = COL_WIDTHS.map((w) => ({ wch: w }))
  // Freeze header row
  ws["!freeze"] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, ws, "Products")

  // ── Instructions sheet ──────────────────────────────────────────────────────
  const instructions = [
    ["AfroTransact Bulk Product Import Template"],
    [""],
    ["REQUIRED FIELDS", "product_name, description, category, price, stock"],
    [""],
    ["INSTRUCTIONS", ""],
    ["1. Header row", "Do NOT modify or delete row 1 (the header row)"],
    ["2. Sample row", "Row 2 is an example — delete it before importing"],
    [
      "3. category",
      "Must exactly match a category name from our catalog (see Categories tab)",
    ],
    ["4. price", "Positive number in USD (e.g. 19.99)"],
    ["5. stock", "Integer ≥ 0"],
    ["6. status", '"draft" = saved but hidden, "pending_review" = submit for approval'],
    ["7. tags", "Comma-separated, max 10 (e.g. shea,organic,moisturizer)"],
    ["8. weight_lbs", "Weight in pounds (e.g. 0.5)"],
    [""],
    ["IMAGE NAMING CONVENTION", ""],
    [
      "Step 1",
      "Upload your product images to the Media Library (/dashboard/upload)",
    ],
    [
      "Step 2",
      'Name images with a base name + number: "yam_1.jpg", "yam_2.jpg", "yam_3.jpg"',
    ],
    [
      "Step 3",
      'In the image_group column, write just the base name: "yam"',
    ],
    [
      "Result",
      "We automatically find yam_1, yam_2, yam_3 and link all 3 images to your product",
    ],
    [""],
    ["IMPORTANT", "See the _media_library tab for your exact uploaded filenames"],
  ]

  const wsInst = XLSX.utils.aoa_to_sheet(instructions)
  wsInst["!cols"] = [{ wch: 28 }, { wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsInst, "Instructions")

  // ── Categories sheet ────────────────────────────────────────────────────────
  const catRows = displayNames.map((name) => [name])
  const wsCat = XLSX.utils.aoa_to_sheet([["category_name"], ...catRows])
  wsCat["!cols"] = [{ wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsCat, "Categories")

  // ── Media library hint sheet ────────────────────────────────────────────────
  const mediaRows = mediaItems.map((m) => [m.name, m.url])
  const wsMedia = XLSX.utils.aoa_to_sheet([
    ["filename (use this in image_group, without the suffix number and extension)", "url"],
    ...mediaRows,
  ])
  wsMedia["!cols"] = [{ wch: 50 }, { wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsMedia, "_media_library")

  XLSX.writeFile(wb, "afrotransact_bulk_import_template.xlsx")
}

// ─────────────────────────────────────────────────────────────────────────────
//  Parsing
// ─────────────────────────────────────────────────────────────────────────────

export async function parseSpreadsheet(file: File): Promise<RawRow[]> {
  const XLSX = await loadXLSX()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: "array" })
        // Always use first sheet (Products)
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
          defval: "",
          raw: false,
        })

        const parsed: RawRow[] = rows.map((r, i) => ({
          rowNumber: i + 2, // +1 for header, +1 for 1-index
          product_name: String(r["product_name"] ?? "").trim(),
          description: String(r["description"] ?? "").trim(),
          category: String(r["category"] ?? "").trim(),
          price: String(r["price"] ?? "").trim(),
          compare_at_price: String(r["compare_at_price"] ?? "").trim(),
          stock: String(r["stock"] ?? "").trim(),
          brand: String(r["brand"] ?? "").trim(),
          weight_lbs: String(r["weight_lbs"] ?? "").trim(),
          tags: String(r["tags"] ?? "").trim(),
          sku: String(r["sku"] ?? "").trim(),
          status: String(r["status"] ?? "draft").trim().toLowerCase(),
          image_group: String(r["image_group"] ?? "").trim(),
        }))

        // Filter completely empty rows (sample row that seller forgot to delete is caught by validation)
        resolve(parsed.filter((r) => r.product_name || r.description))
      } catch (err) {
        reject(new Error("Could not parse the file. Make sure it is a valid .xlsx or .csv file."))
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsArrayBuffer(file)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
//  Validation
// ─────────────────────────────────────────────────────────────────────────────

export function validateRows(
  rows: RawRow[],
  categoryMap: Map<string, string>,
  mediaItems: MediaItem[],
): ValidatedRow[] {
  return rows.map((row) => {
    const errors: string[] = []
    const warnings: string[] = []

    // Required fields
    if (row.product_name.length < 3)
      errors.push("Product name must be at least 3 characters")
    if (row.description.length < 10)
      errors.push("Description must be at least 10 characters")

    // Category
    const catKey = normalizeCategoryKey(row.category)
    const categoryId = categoryMap.get(catKey) ?? null
    if (!row.category) {
      errors.push("Category is required")
    } else if (!categoryId) {
      errors.push(`Category "${row.category}" not found in catalog`)
    }

    // Price
    const price = parseFloat(row.price)
    if (!row.price || isNaN(price) || price <= 0)
      errors.push("Price must be a positive number")

    // Compare at price
    if (row.compare_at_price) {
      const cap = parseFloat(row.compare_at_price)
      if (isNaN(cap) || cap <= 0) errors.push("Compare-at price must be a positive number")
    }

    // Stock
    const stock = parseInt(row.stock, 10)
    if (row.stock === "" || isNaN(stock) || stock < 0)
      errors.push("Stock must be a number ≥ 0")

    // Status
    if (!["draft", "pending_review"].includes(row.status))
      errors.push('Status must be "draft" or "pending_review"')

    // Tags limit
    if (row.tags) {
      const tagCount = row.tags.split(",").filter(Boolean).length
      if (tagCount > 10) errors.push("Maximum 10 tags allowed")
    }

    // Image resolution
    const resolvedImages = resolveImageGroup(row.image_group, mediaItems)
    if (row.image_group && resolvedImages.length === 0) {
      warnings.push(
        `No images found matching "${row.image_group}". ` +
          `Use "${row.image_group}_1.jpg" naming or add searchable metadata to media names/descriptions.`,
      )
    }
    if (!row.image_group) {
      warnings.push("No image group set — product will have no images")
    }

    const overallStatus: ValidatedRow["overallStatus"] =
      errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ready"

    return {
      rowNumber: row.rowNumber,
      raw: row,
      errors,
      warnings,
      resolvedImages,
      categoryId,
      overallStatus,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
//  Import engine — single bulk API call
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface BulkBackendResult {
  rowIndex: number
  status: "created" | "error"
  productId?: string
  title?: string
  error?: string
}

export async function importRows(
  rows: ValidatedRow[],
  storeId: string,
  token: string,
  onProgress: (done: number, result: ImportResult) => void,
): Promise<ImportResult[]> {
  const importable = rows.filter((r) => r.overallStatus !== "error")

  if (importable.length === 0) return []

  // Build the single bulk payload — images inline, no separate calls needed
  const payload = importable.map((row) => {
    const r = row.raw
    const tags = r.tags ? r.tags.split(",").map((t) => t.trim()).filter(Boolean) : []
    const weightLbs = r.weight_lbs ? parseFloat(r.weight_lbs) : undefined
    const weightKg = weightLbs ? weightLbs * 0.453592 : undefined

    const attrsObj: Record<string, unknown> = {}
    if (r.brand) attrsObj["brand"] = r.brand
    if (tags.length) attrsObj["tags"] = tags
    if (weightLbs) {
      attrsObj["weight"] = weightLbs
      attrsObj["weightUnit"] = "lb"
    }

    const sku =
      r.sku ||
      `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    return {
      storeId,
      title: r.product_name,
      description: r.description,
      productType: "physical",
      status: r.status === "pending_review" ? "pending_review" : "draft",
      attributes: JSON.stringify(attrsObj),
      categoryIds: row.categoryId ? [row.categoryId] : [],
      variants: [
        {
          sku,
          name: "Default",
          price: parseFloat(r.price),
          compareAtPrice: r.compare_at_price ? parseFloat(r.compare_at_price) : undefined,
          currency: "USD",
          stockQuantity: parseInt(r.stock, 10),
          weightKg,
        },
      ],
      // Images are included inline — backend attaches them in the same transaction
      images: row.resolvedImages.map((img, i) => ({
        url: img.url,
        altText: r.product_name,
        sortOrder: i,
      })),
    }
  })

  const res = await fetch(`${API_BASE}/api/v1/products/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  if (!res.ok && res.status !== 207) {
    const text = await res.text().catch(() => "")
    throw new Error(`Bulk import failed: ${res.status} ${text}`)
  }

  const backendResults: BulkBackendResult[] = await res.json()

  // Map backend results back to our ImportResult type, preserving row numbers
  const finalResults: ImportResult[] = backendResults.map((br) => {
    const row = importable[br.rowIndex]
    const result: ImportResult = {
      rowNumber: row?.rowNumber ?? br.rowIndex + 2,
      productName: br.title ?? row?.raw.product_name ?? "",
      status: br.status === "created" ? "success" : "error",
      productId: br.productId,
      error: br.error,
    }
    onProgress(br.rowIndex + 1, result)
    return result
  })

  return finalResults
}

