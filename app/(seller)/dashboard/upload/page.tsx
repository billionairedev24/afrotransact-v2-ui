"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import {
  Upload,
  X,
  Check,
  Copy,
  AlertCircle,
  Loader2,
  ImageIcon,
  Trash2,
  MoreHorizontal,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUploadThing } from "@/lib/uploadthing"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getSellerMedia,
  createMediaItem,
  deleteMediaItem,
  type MediaItem,
} from "@/lib/api"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"

const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"]
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE_MB = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function isValidFile(file: File): { valid: boolean; error?: string } {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (!ext || !ACCEPTED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Invalid file type. Allowed: ${ACCEPTED_EXTENSIONS.join(", ")}` }
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { valid: false, error: `Invalid file type. Allowed: ${ACCEPTED_EXTENSIONS.join(", ")}` }
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: `File too large. Max ${MAX_SIZE_MB}MB` }
  }
  return { valid: true }
}

function ActionMenu({
  item,
  onCopy,
  onDelete,
  onPreview,
}: {
  item: MediaItem
  onCopy: (url: string) => void
  onDelete: (id: string) => void
  onPreview: (item: MediaItem) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full z-50 mb-1 w-40 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
          <button
            onClick={() => { onPreview(item); setOpen(false) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <button
            onClick={() => { onCopy(item.url); setOpen(false) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Copy className="h-3.5 w-3.5" /> Copy URL
          </button>
          <button
            onClick={() => { onDelete(item.id); setOpen(false) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default function MediaPage() {
  const { status } = useSession()

  const [media, setMedia] = useState<MediaItem[]>([])
  const [loadingMedia, setLoadingMedia] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)
  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }])
  const inputRef = useRef<HTMLInputElement>(null)

  const loadMedia = useCallback(async () => {
    try {
      const token = await getAccessToken()
      if (!token) return
      const res = await getSellerMedia(token, 1, 200)
      setMedia(res.items ?? [])
    } catch {
      // ignore
    } finally {
      setLoadingMedia(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") loadMedia()
    else setLoadingMedia(false)
  }, [status, loadMedia])

  const { startUpload } = useUploadThing("sellerMedia", {
    onClientUploadComplete: async (res) => {
      if (!res) return
      const token = await getAccessToken()
      if (!token) return

      for (const r of res) {
        const url =
          (r as unknown as Record<string, string>).ufsUrl ||
          r.url ||
          (r.key ? `https://utfs.io/f/${r.key}` : "")
        try {
          await createMediaItem(token, {
            name: r.name,
            url,
            file_key: r.key ?? "",
            content_type: r.type ?? "image/jpeg",
            size_bytes: r.size ?? 0,
          })
        } catch {
          // item still uploaded even if metadata save fails
        }
      }

      await loadMedia()
      setUploading(false)
    },
    onUploadError: () => {
      setUploading(false)
    },
  })

  const processFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return
      const valid: File[] = []
      Array.from(fileList).forEach((file) => {
        const { valid: ok } = isValidFile(file)
        if (ok) valid.push(file)
      })
      if (valid.length === 0) return
      setUploading(true)
      try {
        await startUpload(valid)
      } catch {
        setUploading(false)
      }
    },
    [startUpload],
  )

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    processFiles(e.dataTransfer.files)
  }

  function copyUrl(url: string, id?: string) {
    navigator.clipboard.writeText(url)
    setCopiedId(id ?? url)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const token = await getAccessToken()
      if (!token) return
      await deleteMediaItem(token, id)
      setMedia((prev) => prev.filter((m) => m.id !== id))
    } catch {
      // ignore
    } finally {
      setDeleting(null)
      setDeleteConfirm(null)
    }
  }

  const columns = useMemo<ColumnDef<MediaItem, unknown>[]>(
    () => [
      {
        id: "thumbnail",
        header: "",
        size: 56,
        cell: ({ row }) => (
          <div className="h-10 w-10 overflow-hidden rounded-lg border border-gray-100">
            <img
              src={row.original.url}
              alt={row.original.name}
              className="h-full w-full object-cover"
            />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ getValue }) => (
          <span className="font-medium text-gray-900 text-sm">
            {(getValue() as string) || "Untitled"}
          </span>
        ),
      },
      {
        accessorKey: "content_type",
        header: "Type",
        cell: ({ getValue }) => {
          const ct = (getValue() as string) || "unknown"
          const label = ct.replace("image/", "").toUpperCase()
          return (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {label}
            </span>
          )
        },
      },
      {
        accessorKey: "size_bytes",
        header: "Size",
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-500">{formatSize(getValue() as number)}</span>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-500">{formatDate(getValue() as string)}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 50,
        cell: ({ row }) => (
          <ActionMenu
            item={row.original}
            onCopy={copyUrl}
            onDelete={(id) => setDeleteConfirm(id)}
            onPreview={setPreviewItem}
          />
        ),
        enableSorting: false,
      },
    ],
    [],
  )

  const table = useReactTable({
    data: media,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  if (status === "loading") {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
      </div>
    )
  }

  if (status !== "authenticated") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <p className="text-sm font-medium text-gray-900">You must be signed in to manage media</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
          <p className="mt-1 text-sm text-gray-500">
            {media.length} file{media.length !== 1 ? "s" : ""} uploaded
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl bg-[#EAB308] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#CA8A04] transition-colors disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Upload New"}
        </button>
      </div>

      {/* Upload drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-10 transition-colors hover:border-[#EAB308]/40 hover:bg-[#EAB308]/5",
          dragging && "border-[#EAB308] bg-[#EAB308]/5",
        )}
      >
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
            dragging ? "bg-[#EAB308]/10" : "bg-gray-100 group-hover:bg-[#EAB308]/10",
          )}
        >
          <Upload
            className={cn(
              "h-5 w-5 transition-colors",
              dragging ? "text-[#EAB308]" : "text-gray-400 group-hover:text-[#EAB308]",
            )}
          />
        </div>
        <p className="mt-3 text-sm font-medium text-gray-900">
          Drag & drop files here, or click to browse
        </p>
        <p className="mt-1 text-xs text-gray-500">
          JPEG, PNG, WebP, GIF up to {MAX_SIZE_MB}MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            processFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search media…"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-9 w-64 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#EAB308] focus:outline-none focus:ring-1 focus:ring-[#EAB308]/50"
            />
            <ImageIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        {loadingMedia ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#EAB308]" />
          </div>
        ) : media.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ImageIcon className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-sm font-medium text-gray-900">No media yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Upload images to see them here
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-gray-100">
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          className={cn(
                            "px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500",
                            header.column.getCanSort() && "cursor-pointer select-none hover:text-gray-900",
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                          style={header.column.columnDef.size ? { width: header.column.columnDef.size } : undefined}
                        >
                          <span className="inline-flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === "asc" && <span className="text-[#EAB308]">↑</span>}
                            {header.column.getIsSorted() === "desc" && <span className="text-[#EAB308]">↓</span>}
                          </span>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-50 transition-colors hover:bg-gray-50/50"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-5 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {table.getPageCount() > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                <p className="text-sm text-gray-500">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete media?</h3>
            <p className="mt-2 text-sm text-gray-500">
              This will permanently remove this file from your library. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={!!deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative max-h-[80vh] max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewItem(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/80 p-1.5 text-gray-500 hover:bg-white hover:text-gray-900 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewItem.url}
              alt={previewItem.name}
              className="max-h-[60vh] w-full object-contain"
            />
            <div className="border-t border-gray-100 p-4">
              <p className="font-medium text-gray-900">{previewItem.name || "Untitled"}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                <span>{previewItem.content_type}</span>
                <span>{formatSize(previewItem.size_bytes)}</span>
                <span>{formatDate(previewItem.created_at)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => copyUrl(previewItem.url, previewItem.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    copiedId === previewItem.id
                      ? "border-[#EAB308] bg-[#EAB308]/10 text-[#EAB308]"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50",
                  )}
                >
                  {copiedId === previewItem.id ? (
                    <><Check className="h-3 w-3" /> Copied</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copy URL</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
