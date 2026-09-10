import type { OrderDto } from "./api"
import { flattenOrderLineItems, aggregateProductTotals } from "./orders-export"
import { renderTopProductsChart } from "./orders-chart"

/**
 * Builds the admin orders workbook and triggers the download.
 *
 * Three sheets, because the old single-sheet CSV answered only "how many
 * orders" and never "how many of product X":
 *
 *   Orders      — one row per order (the previous export, unchanged in spirit)
 *   Line items  — one row per purchased product: the grain that makes
 *                 "units of X sold" a pivot or SUMIF
 *   Analytics   — per-product totals plus the rendered charts
 *
 * ExcelJS is imported dynamically so it is never in the page bundle: it is a
 * sizeable dependency and only matters at the moment someone clicks Export.
 */

export interface OrdersWorkbookInput {
  orders: OrderDto[]
  filename?: string
}

const money = (cents: number) => Number((cents / 100).toFixed(2))

export async function downloadOrdersWorkbook({ orders, filename = "admin-orders" }: OrdersWorkbookInput) {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.created = new Date()

  const currency = orders[0]?.currency ?? "USD"
  const lineItems = flattenOrderLineItems(orders)
  const totals = aggregateProductTotals(lineItems)

  const headerStyle = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1F2937" } },
  }
  const styleHeader = (row: import("exceljs").Row) => {
    row.eachCell((cell) => {
      cell.font = headerStyle.font
      cell.fill = headerStyle.fill
    })
    row.height = 20
  }

  // ── Orders ───────────────────────────────────────────────────────────────
  const os = wb.addWorksheet("Orders")
  os.columns = [
    { header: "Order #", key: "orderNumber", width: 16 },
    { header: "Placed at", key: "placedAt", width: 22 },
    { header: "Status", key: "status", width: 14 },
    { header: "Items", key: "items", width: 8 },
    { header: "Total", key: "total", width: 14 },
    { header: "Currency", key: "currency", width: 10 },
  ]
  for (const o of orders) {
    const items = (o.subOrders ?? []).reduce((s, so) => s + (so.items ?? []).reduce((n, i) => n + i.quantity, 0), 0)
    os.addRow({
      orderNumber: o.orderNumber,
      placedAt: o.placedAt || o.createdAt,
      status: o.status,
      items,
      total: money(o.totalCents),
      currency: o.currency,
    })
  }
  styleHeader(os.getRow(1))
  os.views = [{ state: "frozen", ySplit: 1 }]
  os.autoFilter = { from: "A1", to: "F1" }

  // ── Line items ───────────────────────────────────────────────────────────
  const ls = wb.addWorksheet("Line items")
  ls.columns = [
    { header: "Order #", key: "orderNumber", width: 16 },
    { header: "Placed at", key: "placedAt", width: 22 },
    { header: "Order status", key: "orderStatus", width: 14 },
    { header: "Fulfillment", key: "fulfillmentStatus", width: 16 },
    { header: "Product", key: "product", width: 34 },
    { header: "Variant", key: "variant", width: 18 },
    { header: "Qty", key: "quantity", width: 8 },
    { header: "Unit price", key: "unitPrice", width: 12 },
    { header: "Line total", key: "lineTotal", width: 12 },
    { header: "Currency", key: "currency", width: 10 },
  ]
  for (const r of lineItems) {
    ls.addRow({
      ...r,
      unitPrice: money(r.unitPriceCents),
      lineTotal: money(r.lineTotalCents),
    })
  }
  styleHeader(ls.getRow(1))
  ls.views = [{ state: "frozen", ySplit: 1 }]
  if (lineItems.length > 0) ls.autoFilter = { from: "A1", to: "J1" }

  // ── Analytics ────────────────────────────────────────────────────────────
  const as = wb.addWorksheet("Analytics")
  as.columns = [
    { header: "Product", key: "product", width: 34 },
    { header: "Units sold", key: "quantity", width: 12 },
    { header: "Revenue", key: "revenue", width: 14 },
    { header: "Orders", key: "orders", width: 10 },
  ]
  for (const t of totals) {
    as.addRow({ product: t.product, quantity: t.quantity, revenue: money(t.revenueCents), orders: t.orders })
  }
  styleHeader(as.getRow(1))
  as.views = [{ state: "frozen", ySplit: 1 }]

  // Charts sit to the right of the figures so both are visible at once, and the
  // numbers remain available for a native chart or pivot of your own.
  const addChart = (dataUrl: string | null, col: number, row: number, h: number) => {
    if (!dataUrl) return
    const id = wb.addImage({ base64: dataUrl, extension: "png" })
    as.addImage(id, { tl: { col, row }, ext: { width: 900, height: h } })
  }
  const chartRows = Math.min(totals.length, 10)
  const chartHeight = 56 + chartRows * 34 + 44
  addChart(
    renderTopProductsChart({ title: "Top products by units sold", data: totals, measure: "quantity", currency }),
    5, 1, chartHeight,
  )
  addChart(
    renderTopProductsChart({ title: "Top products by revenue", data: [...totals].sort((a, b) => b.revenueCents - a.revenueCents), measure: "revenue", currency }),
    5, Math.ceil(chartHeight / 20) + 3, chartHeight,
  )

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
