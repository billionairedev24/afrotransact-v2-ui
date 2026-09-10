import type { ProductTotal } from "./orders-export"

/**
 * Draws the "top products" bar chart as a PNG for embedding in the workbook.
 *
 * Why an image: ExcelJS cannot write native Excel charts, and hand-rolling the
 * chart OOXML is a large amount of fragile XML for one picture. The trade-off,
 * stated plainly: this is a picture, not a live chart — it will not recalculate
 * if you edit the sheet. The numbers behind it are written to the same sheet so
 * you can always build your own native chart or pivot from them.
 *
 * Drawn on a canvas rather than via a charting library because the export is
 * the only consumer: it keeps the dependency footprint to ExcelJS alone, and
 * gives exact control over colours and the legend.
 */

/** Distinct, print-legible hues. Cycled if there are more bars than colours. */
const PALETTE = [
  "#2563eb", "#16a34a", "#ea580c", "#9333ea", "#dc2626",
  "#0891b2", "#ca8a04", "#db2777", "#4f46e5", "#65a30d",
]

export interface ChartOptions {
  title: string
  /** Bar value per product, already sorted by the caller. */
  data: ProductTotal[]
  /** Which measure to plot. */
  measure: "quantity" | "revenue"
  currency?: string
  maxBars?: number
}

function formatValue(v: number, measure: ChartOptions["measure"], currency: string): string {
  if (measure === "revenue") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 })
      .format(v / 100)
  }
  return String(v)
}

/**
 * Returns a PNG data URL, or null when there is nothing to plot or no canvas is
 * available (SSR). Callers treat null as "skip the chart" rather than failing
 * the whole export — a missing picture must never cost the user their data.
 */
export function renderTopProductsChart(opts: ChartOptions): string | null {
  const { title, measure, currency = "USD", maxBars = 10 } = opts
  const data = opts.data.slice(0, maxBars)
  if (data.length === 0) return null
  if (typeof document === "undefined") return null

  const rowH = 34
  const padTop = 56
  const padBottom = 44 // legend strip
  const padLeft = 190 // product names
  const padRight = 90 // value labels
  const width = 900
  const height = padTop + data.length * rowH + padBottom

  const canvas = document.createElement("canvas")
  // Render at 2x for a crisp image when Excel scales it.
  const scale = 2
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.scale(scale, scale)

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = "#0f172a"
  ctx.font = "600 18px system-ui, -apple-system, Segoe UI, sans-serif"
  ctx.textBaseline = "middle"
  ctx.fillText(title, padLeft - 150, 26)

  const values = data.map((d) => (measure === "revenue" ? d.revenueCents : d.quantity))
  const max = Math.max(...values, 1)
  const barMaxW = width - padLeft - padRight

  data.forEach((d, i) => {
    const y = padTop + i * rowH
    const color = PALETTE[i % PALETTE.length]
    const value = values[i]
    const barW = Math.max(2, (value / max) * barMaxW)

    // Product name, truncated so a long title can't collide with the bar.
    ctx.fillStyle = "#334155"
    ctx.font = "13px system-ui, -apple-system, Segoe UI, sans-serif"
    let label = d.product
    while (ctx.measureText(label).width > padLeft - 24 && label.length > 3) {
      label = label.slice(0, -2)
    }
    if (label !== d.product) label += "…"
    ctx.fillText(label, 12, y + rowH / 2 - 2)

    ctx.fillStyle = color
    const barH = rowH - 12
    const r = 3
    const x = padLeft
    const by = y + 4
    ctx.beginPath()
    ctx.moveTo(x, by)
    ctx.lineTo(x + barW - r, by)
    ctx.quadraticCurveTo(x + barW, by, x + barW, by + r)
    ctx.lineTo(x + barW, by + barH - r)
    ctx.quadraticCurveTo(x + barW, by + barH, x + barW - r, by + barH)
    ctx.lineTo(x, by + barH)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = "#0f172a"
    ctx.font = "600 13px system-ui, -apple-system, Segoe UI, sans-serif"
    ctx.fillText(formatValue(value, measure, currency), padLeft + barW + 10, y + rowH / 2 - 2)
  })

  // Legend: one swatch per product, wrapping across the strip. Keeps the chart
  // readable when the bars themselves are truncated.
  let lx = 12
  let ly = padTop + data.length * rowH + 16
  ctx.font = "12px system-ui, -apple-system, Segoe UI, sans-serif"
  data.forEach((d, i) => {
    const text = d.product.length > 22 ? `${d.product.slice(0, 21)}…` : d.product
    const w = 14 + 6 + ctx.measureText(text).width + 16
    if (lx + w > width - 12) { lx = 12; ly += 18 }
    ctx.fillStyle = PALETTE[i % PALETTE.length]
    ctx.fillRect(lx, ly - 7, 12, 12)
    ctx.fillStyle = "#475569"
    ctx.fillText(text, lx + 18, ly)
    lx += w
  })

  return canvas.toDataURL("image/png")
}
