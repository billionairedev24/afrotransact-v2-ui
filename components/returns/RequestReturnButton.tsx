"use client"

import { useState } from "react"
import { Package, X, AlertTriangle, CheckCircle2 } from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import { requestReturn, type ReturnReason } from "@/lib/api"
import { friendlyMessage } from "@/lib/errors"
import { UploadDropzone } from "@/lib/uploadthing"

interface SubOrderItem {
  id: string
  productTitle?: string | null
  productName?: string | null
  variantName?: string | null
  quantity: number
  unitPriceCents?: number | null
}

interface SubOrderLite {
  id: string
  items: SubOrderItem[]
}

const REASONS: { value: ReturnReason; label: string; needsPhotos?: boolean }[] = [
  { value: "damaged",          label: "Arrived damaged",                   needsPhotos: true },
  { value: "wrong_item",       label: "Wrong item sent",                   needsPhotos: true },
  { value: "not_as_described", label: "Not as described",                  needsPhotos: true },
  { value: "no_longer_wanted", label: "No longer needed / changed mind" },
  { value: "other",            label: "Other reason" },
]

const fmt = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)

export function RequestReturnButton({ sub, orderNumber }: { sub: SubOrderLite; orderNumber: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-gray-700 hover:text-foreground border border-gray-300 rounded-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
      >
        <Package className="h-3.5 w-3.5 shrink-0" />
        Return or replace items
      </button>
      {open && (
        <ReturnRequestModal
          sub={sub}
          orderNumber={orderNumber}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function ReturnRequestModal({
  sub, orderNumber, onClose,
}: {
  sub: SubOrderLite
  orderNumber: string
  onClose: () => void
}) {
  const [reason, setReason] = useState<ReturnReason>("damaged")
  const [buyerNotes, setBuyerNotes] = useState("")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const selectedReason = REASONS.find((r) => r.value === reason)
  const totalQty = Object.values(quantities).reduce((a, b) => a + (b || 0), 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (totalQty === 0) {
      setErr("Pick at least one item to return.")
      return
    }
    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in.")
      const items = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([orderItemId, quantity]) => ({ orderItemId, quantity }))
      await requestReturn(token, {
        orderNumber,
        subOrderId: sub.id,
        reason,
        buyerNotes: buyerNotes.trim() || undefined,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
        items,
      })
      setDone(true)
    } catch (e) {
      setErr(friendlyMessage(e, "Could not submit return."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <header className="flex items-start justify-between gap-3 px-6 py-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Return or replace items</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Order <code className="font-mono">{orderNumber}</code>
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </header>

        {done ? (
          <div className="px-6 py-10 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="font-semibold text-gray-900">Return requested</p>
            <p className="text-sm text-gray-600 max-w-sm mx-auto">
              The seller has 48 hours to respond. You'll get an email when they approve your return
              and a prepaid label is ready.
            </p>
            <button onClick={onClose} className="mt-4 inline-flex items-center justify-center px-5 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col overflow-hidden">
            <div className="px-6 py-5 space-y-5 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Why are you returning?
                </label>
                <div className="space-y-2">
                  {REASONS.map((r) => (
                    <label key={r.value} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-400 cursor-pointer">
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="mt-0.5"
                      />
                      <span className="text-sm text-gray-900">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Pick items + quantities
                </label>
                <div className="space-y-2">
                  {sub.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{item.productTitle ?? item.productName ?? "Item"}</p>
                        {item.variantName && (
                          <p className="text-xs text-gray-500 truncate">{item.variantName}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5">
                          Bought {item.quantity}{item.unitPriceCents != null && <> · {fmt(item.unitPriceCents)} each</>}
                        </p>
                      </div>
                      <select
                        value={quantities[item.id] ?? 0}
                        onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: parseInt(e.target.value) }))}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
                      >
                        {Array.from({ length: item.quantity + 1 }).map((_, i) => (
                          <option key={i} value={i}>{i}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Notes for the seller
                </label>
                <textarea
                  value={buyerNotes}
                  onChange={(e) => setBuyerNotes(e.target.value)}
                  maxLength={4000}
                  placeholder="Add any context that will help the seller process your return faster."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 min-h-[100px] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                />
              </div>

              {selectedReason?.needsPhotos && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Photos <span className="normal-case font-medium text-gray-500">(strongly recommended for {selectedReason.label.toLowerCase()})</span>
                  </label>
                  {photoUrls.length < 10 && (
                    <UploadDropzone
                      endpoint="returnPhoto"
                      appearance={{
                        container: "border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 ut-uploading:opacity-70",
                        button: "bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded-md ut-uploading:bg-gray-400 ut-readying:bg-gray-400 after:bg-gray-700",
                        allowedContent: "text-[11px] text-gray-500",
                        label: "text-sm text-gray-700 hover:text-gray-900",
                      }}
                      config={{ mode: "auto" }}
                      onUploadBegin={() => { setUploading(true); setErr(null) }}
                      onClientUploadComplete={(res) => {
                        setUploading(false)
                        const urls = (res ?? []).map((file) => file.url).filter(Boolean)
                        setPhotoUrls((prev) => [...prev, ...urls].slice(0, 10))
                      }}
                      onUploadError={(e) => { setUploading(false); setErr(e.message || "Photo upload failed — try again") }}
                    />
                  )}
                  {photoUrls.length > 0 && (
                    <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {photoUrls.map((u, i) => (
                        <li key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt={`Return photo ${i + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setPhotoUrls((prev) => prev.filter((_, j) => j !== i))}
                            aria-label="Remove photo"
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-gray-500 mt-2">
                    Up to 10 photos · PNG, JPG, WebP or GIF, max 8MB each.
                  </p>
                </div>
              )}

              {err && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{err}</span>
                </div>
              )}
            </div>

            <footer className="px-6 py-4 border-t border-gray-200 flex flex-col-reverse gap-3 bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-gray-500">
                Seller has 48 hours to respond. After that we auto-approve.
              </p>
              <div className="flex items-center justify-end gap-2 shrink-0">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap text-gray-700 hover:bg-gray-100">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploading || totalQty === 0}
                  className="px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40"
                >
                  {submitting ? "Submitting…" : uploading ? "Uploading…" : "Submit return"}
                </button>
              </div>
            </footer>
          </form>
        )}
      </div>
    </div>
  )
}
