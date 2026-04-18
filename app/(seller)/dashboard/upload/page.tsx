"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
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
  GripVertical,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUploadThing } from "@/lib/uploadthing"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getSellerMedia,
  createMediaItem,
  updateMediaItem,
  deleteMediaItem,
  type MediaItem,
} from "@/lib/api"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { createPortal } from "react-dom"

const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"]
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE_MB = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
const MAX_BULK_FILES = 25
const SELLER_MEDIA_MAX_PER_UPLOAD = 10

type UploadRow = { id: string; file: File; name: string; description: string }

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
  onRename,
}: {
  item: MediaItem
  onCopy: (url: string) => void
  onDelete: (id: string) => void
  onPreview: (item: MediaItem) => void
  onRename: (item: MediaItem) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      const clickedTrigger = !!ref.current?.contains(target)
      const clickedMenu = !!menuRef.current?.contains(target)
      if (!clickedTrigger && !clickedMenu) setOpen(false)
    }
    function updatePos() {
      const btn = btnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const menuW = 160
      const menuH = 116
      const gap = 6
      const left = Math.max(8, Math.min(window.innerWidth - menuW - 8, r.right - menuW))
      const placeAbove = r.top > menuH + gap + 8
      const top = placeAbove ? r.top - menuH - gap : r.bottom + gap
      setMenuPos({ top, left })
    }
    document.addEventListener("mousedown", handleClick)
    window.addEventListener("resize", updatePos)
    window.addEventListener("scroll", updatePos, true)
    updatePos()
    return () => {
      document.removeEventListener("mousedown", handleClick)
      window.removeEventListener("resize", updatePos)
      window.removeEventListener("scroll", updatePos, true)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[80] w-40 rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
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
            onClick={() => { onRename(item); setOpen(false) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> Edit metadata
          </button>
          <button
            onClick={() => { onDelete(item.id); setOpen(false) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}

function deriveMediaKeywords(filename: string): string[] {
  const base = filename.replace(/\.[^.]+$/, "").toLowerCase()
  const normalized = base
    .replace(/[_-]\d+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
  const stop = new Set(["img", "image", "photo", "final", "copy", "new", "edited", "file"])
  const parts = normalized
    .split(/\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2 && !stop.has(p))
  return [...new Set(parts)].slice(0, 8)
}

function buildAutoMediaDescription(filename: string): string {
  const keywords = deriveMediaKeywords(filename)
  if (!keywords.length) return ""
  const group = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]\d+$/g, "")
    .trim()
  return `auto_keywords:${keywords.join(",")}; auto_group:${group}`
}

export default function MediaPage() {
  const { status } = useSession()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get("returnTo")

  const [media, setMedia] = useState<MediaItem[]>([])
  const [loadingMedia, setLoadingMedia] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadMode, setUploadMode] = useState<"single" | "bulk">("single")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([])
  const [bulkMetaTemplate, setBulkMetaTemplate] = useState("")
  const [bulkNameBase, setBulkNameBase] = useState("")
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)
  const [editItem, setEditItem] = useState<MediaItem | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [inlineNameDraft, setInlineNameDraft] = useState("")
  const [savingInlineNameId, setSavingInlineNameId] = useState<string | null>(null)
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

  const { startUpload } = useUploadThing("sellerMedia")

  const applyBulkNumberedNames = useCallback((baseRaw: string) => {
    const base = baseRaw.trim()
    if (!base) return
    setUploadRows((prev) => prev.map((r, i) => ({ ...r, name: `${base}_${i + 1}` })))
    setBulkNameBase(base)
  }, [])

  const processFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return
    const all = Array.from(fileList)
    const valid: File[] = []
    for (const f of all) {
      const check = isValidFile(f)
      if (check.valid) valid.push(f)
    }
    if (valid.length === 0) {
      setUploadError(`No valid files selected. Allowed: ${ACCEPTED_EXTENSIONS.join(", ")} up to ${MAX_SIZE_MB}MB.`)
      return
    }
    const capped = uploadMode === "single" ? valid.slice(0, 1) : valid.slice(0, MAX_BULK_FILES)
    setUploadRows(
      capped.map((file, i) => ({
        id: `${file.name}-${file.lastModified}-${i}`,
        file,
        name: file.name.replace(/\.[^.]+$/, ""),
        description: buildAutoMediaDescription(file.name),
      })),
    )
    setUploadError(null)
  }, [uploadMode])

  async function submitUploadForm() {
    if (uploadRows.length === 0) {
      setUploadError("Select at least one file first.")
      return
    }
    const cleaned = uploadRows.map((r) => ({ ...r, name: r.name.trim(), description: r.description.trim() }))
    if (cleaned.some((r) => !r.name)) {
      setUploadError("Every file must have a name.")
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const token = await getAccessToken()
      if (!token) {
        setUploadError("Session expired. Refresh and try again.")
        return
      }
      for (let offset = 0; offset < cleaned.length; offset += SELLER_MEDIA_MAX_PER_UPLOAD) {
        const batch = cleaned.slice(offset, offset + SELLER_MEDIA_MAX_PER_UPLOAD)
        const uploaded = await startUpload(batch.map((r) => r.file))
        if (!uploaded || uploaded.length === 0) {
          setUploadError("Upload failed. Please try again.")
          return
        }
        for (let i = 0; i < uploaded.length; i += 1) {
          const r = uploaded[i]
          const meta = batch[i]
          const url =
            (r as unknown as Record<string, string>).ufsUrl ||
            r.url ||
            (r.key ? `https://utfs.io/f/${r.key}` : "")
          await createMediaItem(token, {
            name: meta?.name || r.name,
            description: meta?.description || buildAutoMediaDescription(r.name),
            url,
            file_key: r.key ?? "",
            content_type: r.type ?? "image/jpeg",
            size_bytes: r.size ?? 0,
          })
        }
      }

      await loadMedia()
      setUploadRows([])
      setUploadOpen(false)
    } catch {
      setUploadError("Could not complete upload. Check file size/type and try again.")
    } finally {
      setUploading(false)
    }
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

  async function handleSaveEdit() {
    if (!editItem) return
    const nextName = editName.trim()
    if (!nextName) {
      setEditError("Image name is required.")
      return
    }
    setSavingEdit(true)
    setEditError(null)
    try {
      const token = await getAccessToken()
      if (!token) {
        setEditError("Session expired. Refresh and try again.")
        return
      }
      const updated = await updateMediaItem(token, editItem.id, {
        name: nextName,
        description: editDescription.trim(),
      })
      setMedia((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
      setEditItem(null)
    } catch {
      setEditError("Failed to save media metadata. Please try again.")
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleInlineRename(id: string, rawName: string) {
    const nextName = rawName.trim()
    if (!nextName) return
    const existing = media.find((m) => m.id === id)
    if (!existing || existing.name === nextName) {
      setEditingNameId(null)
      return
    }
    setSavingInlineNameId(id)
    try {
      const token = await getAccessToken()
      if (!token) return
      const updated = await updateMediaItem(token, id, { name: nextName })
      setMedia((prev) => prev.map((m) => (m.id === id ? updated : m)))
    } catch {
      // keep old name on failure
    } finally {
      setSavingInlineNameId(null)
      setEditingNameId(null)
    }
  }

  const columns = useMemo<ColumnDef<MediaItem, unknown>[]>(
    () => [
      {
        id: "thumbnail",
        header: "",
        size: 64,
        cell: ({ row }) => (
          <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
            <Image src={row.original.url} alt={row.original.name} fill sizes="40px" className="object-cover" />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ getValue, row }) => {
          const item = row.original
          const isEditing = editingNameId === item.id
          const isSaving = savingInlineNameId === item.id
          return (
            <div className="min-w-[220px]">
              {isEditing ? (
                <input
                  autoFocus
                  value={inlineNameDraft}
                  onChange={(e) => setInlineNameDraft(e.target.value)}
                  onBlur={() => void handleInlineRename(item.id, inlineNameDraft)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleInlineRename(item.id, inlineNameDraft)
                    if (e.key === "Escape") setEditingNameId(null)
                  }}
                  className="h-8 w-full rounded-md border border-gray-200 px-2 text-sm text-gray-900 focus:border-[#EAB308] focus:outline-none focus:ring-1 focus:ring-[#EAB308]/40"
                />
              ) : (
                <button
                  onDoubleClick={() => {
                    setEditingNameId(item.id)
                    setInlineNameDraft(item.name || "")
                  }}
                  className="text-left font-medium text-gray-900 text-sm"
                  title="Double-click to rename"
                >
                  {(getValue() as string) || "Untitled"}
                </button>
              )}
              {isSaving && <p className="mt-1 text-[10px] text-gray-400">Saving…</p>}
            </div>
          )
        },
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
            onRename={(item) => {
              setEditItem(item)
              setEditName(item.name ?? "")
              setEditDescription(item.description ?? "")
              setEditError(null)
            }}
          />
        ),
        enableSorting: false,
      },
    ],
    [editingNameId, inlineNameDraft, savingInlineNameId, media],
  )

  const filteredMedia = useMemo(() => {
    const q = globalFilter.trim().toLowerCase()
    if (!q) return media
    return media.filter((m) =>
      [m.name, m.description, m.content_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
  }, [media, globalFilter])

  const table = useReactTable({
    data: filteredMedia,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
          <p className="mt-1 text-sm text-gray-500">Manage names and metadata used for product auto-matching.</p>
        </div>
        <div className="flex items-center gap-2">
          {returnTo && (
            <Link
              href={returnTo}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back to Bulk Import
            </Link>
          )}
          <button
            onClick={() => {
              setUploadMode("single")
              setUploadRows([])
              setUploadError(null)
              setBulkMetaTemplate("")
              setBulkNameBase("")
              setUploadOpen(true)
            }}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl bg-[#EAB308] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#CA8A04] transition-colors disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            Upload New
          </button>
          <button
            onClick={() => {
              setUploadMode("bulk")
              setUploadRows([])
              setUploadError(null)
              setBulkMetaTemplate("")
              setBulkNameBase("")
              setUploadOpen(true)
            }}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Bulk Upload
          </button>
        </div>
      </div>

      {/* Bulk import naming guide */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100">
            <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-blue-900">
              Using Bulk Product Import? Name your images like this:
            </p>
            <div className="flex flex-wrap gap-2">
              {["yam_1.jpg", "yam_2.jpg", "yam_3.jpg"].map((name) => (
                <code key={name} className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-mono text-blue-800">
                  {name}
                </code>
              ))}
            </div>
            <p className="text-xs text-blue-700">
              In your spreadsheet's <code className="rounded bg-blue-100 px-1 font-mono">image_group</code> column, write{" "}
              <code className="rounded bg-blue-100 px-1 font-mono">yam</code> — we'll automatically link all 3 images to that product.
              The first image (<code className="rounded bg-blue-100 px-1 font-mono">yam_1</code>) becomes the primary image.
            </p>
          </div>
          <a
            href="/dashboard/products/bulk-import"
            className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Go to Bulk Import
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </a>
        </div>
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
            <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-max text-left">
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
              This will remove the record from your library and permanently delete the file from storage.
              This action cannot be undone.
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

      {/* Rename/edit modal */}
      {editItem && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50" onClick={() => setEditItem(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">Edit media details</h3>
            <p className="mt-1 text-sm text-gray-500">
              Set a seller-friendly name and metadata for better product mapping.
            </p>
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-md border border-gray-200 bg-white">
                <Image src={editItem.url} alt={editItem.name} fill sizes="56px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-gray-900">{editItem.name || "Untitled"}</p>
                <p className="mt-0.5 text-[11px] text-gray-500">{editItem.content_type}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Display name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:border-[#EAB308] focus:outline-none focus:ring-1 focus:ring-[#EAB308]/40"
                  placeholder="e.g. Jasmine Rice Front Pack"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Metadata notes (searchable)</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#EAB308] focus:outline-none focus:ring-1 focus:ring-[#EAB308]/40"
                  placeholder="e.g. rice,jasmine,5kg,bag,front"
                />
              </div>
            </div>
            {editError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {editError}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditItem(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="inline-flex items-center gap-2 rounded-lg bg-[#EAB308] px-4 py-2 text-sm font-semibold text-black hover:bg-[#CA8A04] disabled:opacity-60"
              >
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload form modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50" onClick={() => !uploading && setUploadOpen(false)}>
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {uploadMode === "single" ? "Upload image with metadata" : "Bulk upload images with metadata"}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Set names and searchable metadata before saving to your media library.
                </p>
              </div>
              <button
                onClick={() => !uploading && setUploadOpen(false)}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Select file{uploadMode === "bulk" ? "s" : ""}
              </button>
              <p className="text-xs text-gray-500">
                Allowed: {ACCEPTED_EXTENSIONS.join(", ")} up to {MAX_SIZE_MB}MB
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple={uploadMode === "bulk"}
                className="hidden"
                onChange={(e) => {
                  processFiles(e.target.files)
                  e.target.value = ""
                }}
              />
            </div>

            {uploadMode === "bulk" && uploadRows.length > 0 && (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3">
                <p className="text-xs font-semibold text-blue-900">Bulk helper</p>
                <p className="mt-1 text-xs text-blue-800">
                  Add shared metadata once, then apply to every selected file.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={bulkMetaTemplate}
                    onChange={(e) => setBulkMetaTemplate(e.target.value)}
                    className="h-8 min-w-[260px] flex-1 rounded-md border border-blue-200 bg-white px-2 text-sm text-gray-900 focus:border-[#EAB308] focus:outline-none focus:ring-1 focus:ring-[#EAB308]/40"
                    placeholder="e.g. rice,5kg,packshot,store-a"
                  />
                  <button
                    onClick={() =>
                      setUploadRows((prev) =>
                        prev.map((r) => {
                          const t = bulkMetaTemplate.trim()
                          if (!t) return r
                          const merged = r.description?.trim() ? `${r.description.trim()},${t}` : t
                          return { ...r, description: merged }
                        }),
                      )
                    }
                    className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Append to all
                  </button>
                  <button
                    onClick={() =>
                      setUploadRows((prev) =>
                        prev.map((r) => ({ ...r, description: bulkMetaTemplate.trim() })),
                      )
                    }
                    className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Replace all
                  </button>
                </div>
                <div className="mt-3 border-t border-blue-200 pt-3">
                  <p className="text-xs text-blue-800">
                    Set all names at once. We auto-number by row order.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={bulkNameBase}
                      onChange={(e) => setBulkNameBase(e.target.value)}
                      className="h-8 min-w-[220px] flex-1 rounded-md border border-blue-200 bg-white px-2 text-sm text-gray-900 focus:border-[#EAB308] focus:outline-none focus:ring-1 focus:ring-[#EAB308]/40"
                      placeholder="e.g. jewelry"
                    />
                    <button
                      onClick={() => applyBulkNumberedNames(bulkNameBase)}
                      className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      Name all (jewelry_1..N)
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-blue-700">
                    Tip: drag rows to reorder, then click the button again to re-number suffixes by the new order.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 max-h-[45vh] overflow-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[680px] text-left">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    {uploadMode === "bulk" && (
                      <th className="w-10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">#</th>
                    )}
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">File</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Name *</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Metadata notes</th>
                    <th className="w-16 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Row</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadRows.length === 0 ? (
                    <tr>
                      <td colSpan={uploadMode === "bulk" ? 5 : 4} className="px-3 py-6 text-center text-sm text-gray-400">
                        No files selected yet.
                      </td>
                    </tr>
                  ) : (
                    uploadRows.map((row, i) => (
                      <tr
                        key={row.id}
                        className={cn("border-b border-gray-50", draggingRowId === row.id && "bg-amber-50")}
                        draggable={uploadMode === "bulk"}
                        onDragStart={() => setDraggingRowId(row.id)}
                        onDragOver={(e) => {
                          if (uploadMode !== "bulk") return
                          e.preventDefault()
                        }}
                        onDrop={() => {
                          if (uploadMode !== "bulk" || !draggingRowId || draggingRowId === row.id) return
                          setUploadRows((prev) => {
                            const from = prev.findIndex((r) => r.id === draggingRowId)
                            const to = prev.findIndex((r) => r.id === row.id)
                            if (from < 0 || to < 0) return prev
                            const next = [...prev]
                            const [moved] = next.splice(from, 1)
                            next.splice(to, 0, moved)
                            return next
                          })
                          setDraggingRowId(null)
                        }}
                        onDragEnd={() => setDraggingRowId(null)}
                      >
                        {uploadMode === "bulk" && (
                          <td className="px-3 py-2 text-xs text-gray-400">
                            <div className="inline-flex items-center gap-1">
                              <GripVertical className="h-3.5 w-3.5" />
                              <span>{i + 1}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-3 py-2 text-xs text-gray-600">{row.file.name}</td>
                        <td className="px-3 py-2">
                          <input
                            value={row.name}
                            onChange={(e) =>
                              setUploadRows((prev) =>
                                prev.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)),
                              )
                            }
                            className="h-8 w-full rounded-md border border-gray-200 px-2 text-sm text-gray-900 focus:border-[#EAB308] focus:outline-none focus:ring-1 focus:ring-[#EAB308]/40"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.description}
                            onChange={(e) =>
                              setUploadRows((prev) =>
                                prev.map((r, idx) => (idx === i ? { ...r, description: e.target.value } : r)),
                              )
                            }
                            className="h-8 w-full rounded-md border border-gray-200 px-2 text-sm text-gray-900 focus:border-[#EAB308] focus:outline-none focus:ring-1 focus:ring-[#EAB308]/40"
                            placeholder="e.g. rice,jasmine,5kg,front"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => setUploadRows((prev) => prev.filter((r) => r.id !== row.id))}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                            title="Remove row"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {uploadError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {uploadError}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setUploadOpen(false)}
                disabled={uploading}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={submitUploadForm}
                disabled={uploading || uploadRows.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-[#EAB308] px-4 py-2 text-sm font-semibold text-black hover:bg-[#CA8A04] disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading..." : `Save ${uploadRows.length} file${uploadRows.length !== 1 ? "s" : ""}`}
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
            <div className="relative h-[60vh] w-full">
              <Image
                src={previewItem.url}
                alt={previewItem.name}
                fill
                sizes="(max-width: 768px) 100vw, 640px"
                className="object-contain"
              />
            </div>
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
