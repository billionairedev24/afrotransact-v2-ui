"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  Upload,
  X,
  Check,
  Copy,
  AlertCircle,
  Loader2,
  ImageIcon,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUploadThing } from "@/lib/uploadthing"
import { getAccessToken } from "@/lib/auth-helpers"
import { getSellerProducts } from "@/lib/api"

const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"]
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE_MB = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

interface UploadedFile {
  id: string
  name: string
  size: number
  status: "uploading" | "complete" | "error"
  error?: string
  url?: string
  mediaId?: string
}

interface ExistingMedia {
  id: string
  url: string
  altText: string | null
  productTitle: string
  productId: string
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
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

export default function MediaPage() {
  const { status } = useSession()

  const [files, setFiles] = useState<UploadedFile[]>([])
  const [existingMedia, setExistingMedia] = useState<ExistingMedia[]>([])
  const [loadingMedia, setLoadingMedia] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"library" | "upload">("library")
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (status !== "authenticated") {
      setLoadingMedia(false)
      return
    }
    let cancelled = false

    async function loadMedia() {
      try {
        const token = await getAccessToken()
        if (!token || cancelled) return
        const res = await getSellerProducts(token)
        const media: ExistingMedia[] = []
        for (const product of res.content) {
          for (const img of product.images) {
            media.push({
              id: img.id,
              url: img.url,
              altText: img.altText ?? null,
              productTitle: product.title,
              productId: product.id,
            })
          }
        }
        if (!cancelled) setExistingMedia(media)
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingMedia(false)
      }
    }

    loadMedia()
    return () => { cancelled = true }
  }, [status])

  const { startUpload } = useUploadThing("sellerMedia", {
    onClientUploadComplete: (res) => {
      if (!res) return
      res.forEach((r) => {
        const url = (r as unknown as Record<string, string>).ufsUrl || r.url || (r.key ? `https://utfs.io/f/${r.key}` : "")
        const tempId = pendingRef.current.get(r.name) ?? r.name
        setFiles((prev) =>
          prev.map((f) =>
            f.id === tempId
              ? { ...f, status: "complete" as const, url, mediaId: r.key, error: undefined }
              : f
          )
        )
        pendingRef.current.delete(r.name)
      })
    },
    onUploadError: (err) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading" ? { ...f, status: "error" as const, error: err.message || "Upload failed" } : f
        )
      )
    },
  })

  const performUpload = useCallback(
    async (file: File, tempId: string) => {
      pendingRef.current.set(file.name, tempId)
      setFiles((prev) =>
        prev.map((f) =>
          f.id === tempId ? { ...f, status: "uploading" as const, error: undefined } : f
        )
      )
      try {
        await startUpload([file])
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed"
        setFiles((prev) =>
          prev.map((f) =>
            f.id === tempId ? { ...f, status: "error" as const, error: message } : f
          )
        )
      }
    },
    [startUpload]
  )

  const processFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return
      const valid: { file: File; tempId: string }[] = []
      Array.from(fileList).forEach((file) => {
        const { valid: ok } = isValidFile(file)
        if (ok) valid.push({ file, tempId: generateId() })
      })
      const newFiles: UploadedFile[] = valid.map(({ file, tempId }) => ({
        id: tempId,
        name: file.name,
        size: file.size,
        status: "uploading" as const,
      }))
      setFiles((prev) => [...newFiles, ...prev])
      valid.forEach(({ file, tempId }) => performUpload(file, tempId))
    },
    [performUpload]
  )

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    processFiles(e.dataTransfer.files)
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function copyUrl(url: string, id: string) {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status !== "authenticated") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Media Library</h1>
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-sm font-medium text-foreground">You must be signed in to manage media</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Media Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage all your uploaded images and media files
          </p>
        </div>
        <button
          onClick={() => { setActiveTab("upload"); inputRef.current?.click() }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Upload New
        </button>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {(["library", "upload"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors capitalize",
              activeTab === tab
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "library" ? `Library (${existingMedia.length})` : `Uploads (${files.length})`}
          </button>
        ))}
      </div>

      {activeTab === "library" && (
        <>
          {loadingMedia ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : existingMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-20 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
              <p className="mt-4 text-sm font-medium text-foreground">No media yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload images or add them to your products to see them here
              </p>
              <button
                onClick={() => setActiveTab("upload")}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Upload className="h-4 w-4" />
                Upload Media
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {existingMedia.map((media) => (
                <div
                  key={media.id}
                  className="group overflow-hidden rounded-lg border border-border bg-card"
                >
                  <div className="relative aspect-square bg-muted">
                    <img
                      src={media.url}
                      alt={media.altText ?? media.productTitle}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyUrl(media.url, media.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
                          title="Copy URL"
                        >
                          {copiedId === media.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <a
                          href={media.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-foreground">
                      {media.altText || media.productTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      From: {media.productTitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "upload" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Accepted:</span>
            {ACCEPTED_EXTENSIONS.map((fmt) => (
              <span
                key={fmt}
                className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              >
                .{fmt}
              </span>
            ))}
            <span className="text-xs text-muted-foreground">(max {MAX_SIZE_MB}MB per file)</span>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "group flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card/50 py-16 transition-colors hover:border-primary/40 hover:bg-primary/5",
              dragging && "border-primary bg-primary/5"
            )}
          >
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full transition-colors",
                dragging ? "bg-primary/10" : "bg-muted group-hover:bg-primary/10"
              )}
            >
              <Upload
                className={cn(
                  "h-6 w-6 transition-colors",
                  dragging ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                )}
              />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              Drag & drop files here, or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPEG, PNG, WebP, or GIF up to {MAX_SIZE_MB}MB
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

          {files.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-foreground">
                Recent Uploads ({files.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {files.map((file) => (
                  <div key={file.id} className="overflow-hidden rounded-lg border border-border bg-card">
                    <div className="relative aspect-square bg-muted">
                      {file.status === "complete" && file.url ? (
                        <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                      ) : file.status === "error" ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4">
                          <AlertCircle className="h-10 w-10 text-destructive" />
                          <span className="text-center text-xs text-destructive">Upload failed</span>
                        </div>
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">Uploading…</span>
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(file.id) }}
                        className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                      {file.status === "error" && file.error && (
                        <p className="mt-1 text-xs text-destructive">{file.error}</p>
                      )}
                      {file.status === "complete" && file.url && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={file.url}
                            className="h-8 flex-1 truncate rounded-md border border-border bg-background px-2.5 text-xs text-muted-foreground focus:outline-none"
                          />
                          <button
                            onClick={() => copyUrl(file.url!, file.id)}
                            className={cn(
                              "flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
                              copiedId === file.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {copiedId === file.id ? (
                              <><Check className="h-3 w-3" /> Copied</>
                            ) : (
                              <><Copy className="h-3 w-3" /> Copy URL</>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
