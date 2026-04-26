"use client"

import { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect, useId } from "react"
import { createPortal } from "react-dom"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table"
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  loading?: boolean
  searchPlaceholder?: string
  searchColumn?: string
  enableSelection?: boolean
  enableExport?: boolean
  exportFilename?: string
  emptyMessage?: string
  pageSize?: number
  /**
   * Server-side pagination. When provided, the table:
   *  - skips client-side `getPaginationRowModel`
   *  - uses these props as the source of truth for page index / size
   *  - calls onPageChange / onPageSizeChange instead of mutating internal state
   *
   *  Pass undefined for client-side pagination (default).
   */
  serverPagination?: {
    pageIndex: number
    pageSize: number
    pageCount: number
    totalRows: number
    onPageChange: (pageIndex: number) => void
    onPageSizeChange?: (pageSize: number) => void
  }
}

// Re-export for consumer convenience
export { createColumnHelper as columnHelper }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeCsvCell(value: unknown): string {
  const str = value == null ? "" : String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csvRows = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) =>
      headers.map((h) => escapeCsvCell(row[h])).join(",")
    ),
  ]
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const COLUMN_MENU_WIDTH = 208 // w-52

function ColumnVisibilityDropdown({
  table,
}: {
  table: ReturnType<typeof useReactTable<any>>
}) {
  const menuDomId = useId()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const pad = 8
    let left = rect.right - COLUMN_MENU_WIDTH
    left = Math.min(left, vw - COLUMN_MENU_WIDTH - pad)
    left = Math.max(pad, left)
    setMenuPos({ top: rect.bottom + pad, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      const menu = document.getElementById(menuDomId)
      if (menu?.contains(t)) return
      setOpen(false)
    }
    function onResize() {
      updatePosition()
    }
    document.addEventListener("mousedown", handleClickOutside)
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onResize, true)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onResize, true)
    }
  }, [open, updatePosition, menuDomId])

  const toggleable = table
    .getAllLeafColumns()
    .filter((col) => col.getCanHide())

  const menu =
    open && menuPos && typeof document !== "undefined"
      ? createPortal(
          <div
            id={menuDomId}
            className="fixed z-[200] max-h-[min(24rem,calc(100vh-6rem))] w-52 overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-xl"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
          >
            {toggleable.map((col) => {
              const visible = col.getIsVisible()
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => col.toggleVisibility(!visible)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {visible ? (
                    <Eye className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="min-w-0 break-words capitalize">
                    {typeof col.columnDef.header === "string"
                      ? col.columnDef.header
                      : col.id}
                  </span>
                </button>
              )
            })}
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={triggerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground",
          open && "bg-muted/80 text-foreground",
        )}
      >
        <Eye className="h-4 w-4" />
        Columns
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {menu}
    </div>
  )
}

function LoadingRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-16 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Loading…</p>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

export function DataTable<TData>({
  columns,
  data,
  loading = false,
  searchPlaceholder = "Search…",
  searchColumn,
  enableSelection = false,
  enableExport = false,
  exportFilename = "export",
  emptyMessage = "No results found.",
  pageSize: initialPageSize = 10,
  serverPagination,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const isServer = !!serverPagination

  const allColumns = useMemo<ColumnDef<TData, any>[]>(() => {
    if (!enableSelection) return columns
    const selectCol: ColumnDef<TData, any> = {
      id: "_select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="h-4 w-4 rounded border-input bg-transparent accent-primary cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          className="h-4 w-4 rounded border-input bg-transparent accent-primary cursor-pointer"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    }
    return [selectCol, ...columns]
  }, [columns, enableSelection])

  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
      ...(isServer
        ? {
            pagination: {
              pageIndex: serverPagination!.pageIndex,
              pageSize: serverPagination!.pageSize,
            },
          }
        : {}),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Skip client pagination row model in server mode — backend already paginated.
    ...(isServer ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    manualPagination: isServer,
    pageCount: isServer ? serverPagination!.pageCount : undefined,
    enableRowSelection: enableSelection,
    initialState: isServer ? undefined : {
      pagination: { pageSize: initialPageSize },
    },
  })

  const handleExport = useCallback(() => {
    const visibleCols = table
      .getVisibleLeafColumns()
      .filter((col) => col.id !== "_select")
    const rows = table.getFilteredRowModel().rows.map((row) => {
      const obj: Record<string, unknown> = {}
      for (const col of visibleCols) {
        const header =
          typeof col.columnDef.header === "string"
            ? col.columnDef.header
            : col.id
        obj[header] = row.getValue(col.id)
      }
      return obj
    })
    downloadCsv(rows, exportFilename)
  }, [table, exportFilename])

  const pageIndex = isServer ? serverPagination!.pageIndex : table.getState().pagination.pageIndex
  const pageCount = isServer ? serverPagination!.pageCount : table.getPageCount()
  const totalRows = isServer ? serverPagination!.totalRows : table.getFilteredRowModel().rows.length

  const goToPage = (i: number) => {
    if (isServer) serverPagination!.onPageChange(i)
    else table.setPageIndex(i)
  }
  const setPageSize = (n: number) => {
    if (isServer) serverPagination!.onPageSizeChange?.(n)
    else table.setPageSize(n)
  }
  const canPrev = pageIndex > 0
  const canNext = pageIndex + 1 < pageCount

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative min-w-0 max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchColumn ? (table.getColumn(searchColumn)?.getFilterValue() as string ?? "") : globalFilter}
            onChange={(e) => {
              const v = e.target.value
              if (searchColumn) {
                table.getColumn(searchColumn)?.setFilterValue(v)
              } else {
                setGlobalFilter(v)
              }
            }}
            className="h-10 w-full rounded-lg border border-border bg-muted pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
          {(searchColumn
            ? (table.getColumn(searchColumn)?.getFilterValue() as string)
            : globalFilter) && (
            <button
              onClick={() => {
                if (searchColumn) {
                  table.getColumn(searchColumn)?.setFilterValue("")
                } else {
                  setGlobalFilter("")
                }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Right-side controls — right-align on mobile so popovers stay in viewport */}
        <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto sm:justify-start">
          <ColumnVisibilityDropdown table={table} />

          {enableExport && (
            <button
              onClick={handleExport}
              disabled={totalRows === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* ── Table: only this region scrolls horizontally on narrow viewports ─── */}
      <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-card [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-max text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header) => {
                  const sortable = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                        sortable && "cursor-pointer select-none hover:text-foreground transition-colors"
                      )}
                      onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className="flex items-center gap-1.5">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {sortable && (
                          <span className="inline-flex flex-col">
                            {sorted === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5 text-primary" />
                            ) : sorted === "desc" ? (
                              <ChevronDown className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {loading ? (
              <LoadingRow cols={table.getVisibleLeafColumns().length} />
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Filter className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-selected={row.getIsSelected() || undefined}
                  className="border-b border-border transition-colors hover:bg-muted/50 data-[selected]:bg-primary/5"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 text-sm text-foreground/80"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────── */}
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Selection info + page size */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {enableSelection && (
            <span>
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {totalRows} selected
            </span>
          )}
          <div className="flex items-center gap-2">
            <span>Rows</span>
            <select
              value={isServer ? serverPagination!.pageSize : table.getState().pagination.pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border border-border bg-muted px-2 py-1 text-sm text-foreground outline-none focus:border-primary/50"
            >
              {[10, 20, 30, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {pageIndex + 1} of {pageCount || 1}
            {isServer && totalRows > 0 && (
              <span className="ml-2 text-muted-foreground/70">({totalRows} total)</span>
            )}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => goToPage(pageIndex - 1)}
              disabled={!canPrev}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => goToPage(pageIndex + 1)}
              disabled={!canNext}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
