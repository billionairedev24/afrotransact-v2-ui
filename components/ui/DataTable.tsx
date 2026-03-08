"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
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

function ColumnVisibilityDropdown({
  table,
}: {
  table: ReturnType<typeof useReactTable<any>>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const toggleable = table
    .getAllLeafColumns()
    .filter((col) => col.getCanHide())

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white",
          open && "bg-white/10 text-white"
        )}
      >
        <Eye className="h-4 w-4" />
        Columns
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 origin-top-right rounded-xl border border-white/10 bg-[hsl(0_0%_11%)] p-2 shadow-xl animate-in fade-in-0 zoom-in-95">
          {toggleable.map((col) => {
            const visible = col.getIsVisible()
            return (
              <button
                key={col.id}
                onClick={() => col.toggleVisibility(!visible)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                {visible ? (
                  <Eye className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
                <span className="truncate capitalize">
                  {typeof col.columnDef.header === "string"
                    ? col.columnDef.header
                    : col.id}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SkeletonRows({ cols, rows }: { cols: number; rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-white/5">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <div className="h-4 w-full animate-pulse rounded bg-white/5" />
            </td>
          ))}
        </tr>
      ))}
    </>
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
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const allColumns = useMemo<ColumnDef<TData, any>[]>(() => {
    if (!enableSelection) return columns
    const selectCol: ColumnDef<TData, any> = {
      id: "_select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="h-4 w-4 rounded border-white/20 bg-transparent accent-primary cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          className="h-4 w-4 rounded border-white/20 bg-transparent accent-primary cursor-pointer"
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
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: enableSelection,
    initialState: {
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

  const pageIndex = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()
  const totalRows = table.getFilteredRowModel().rows.length

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
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
            className="h-10 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-9 text-sm text-white placeholder:text-gray-500 outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Right-side controls */}
        <div className="flex items-center gap-2">
          <ColumnVisibilityDropdown table={table} />

          {enableExport && (
            <button
              onClick={handleExport}
              disabled={totalRows === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[hsl(0_0%_11%)]">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-white/10">
                {hg.headers.map((header) => {
                  const sortable = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400",
                        sortable && "cursor-pointer select-none hover:text-white transition-colors"
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
              <SkeletonRows
                cols={table.getVisibleLeafColumns().length}
                rows={table.getState().pagination.pageSize}
              />
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-2 text-gray-500">
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
                  className="border-b border-white/5 transition-colors hover:bg-white/[0.03] data-[selected]:bg-primary/5"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 text-sm text-gray-300"
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Selection info + page size */}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {enableSelection && (
            <span>
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {totalRows} selected
            </span>
          )}
          <div className="flex items-center gap-2">
            <span>Rows</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-gray-300 outline-none focus:border-primary/50"
            >
              {[10, 20, 30, 50, 100].map((size) => (
                <option key={size} value={size} className="bg-[hsl(0_0%_11%)] text-gray-300">
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Page {pageIndex + 1} of {pageCount || 1}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
