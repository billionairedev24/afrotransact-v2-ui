"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, ShieldAlert, X } from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import { createDispute, type DisputeType } from "@/lib/api"
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

const TYPES: { value: DisputeType; label: string; hint: string }[] = [
  { value: "not_received", label: "I didn't receive my order", hint: "Marked delivered but never arrived, or lost in transit." },
  { value: "not_as_described", label: "Not as described", hint: "Materially different from the listing — and you want a refund, not to ship it back." },
  { value: "damaged", label: "Arrived damaged / defective", hint: "The item is unusable and you shouldn't have to return it." },
  { value: "unauthorized", label: "I didn't make this purchase", hint: "You don't recognize this charge." },
  { value: "other", label: "Something else", hint: "Tell us what happened." },
]

const fmt = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)

/**
 * "Report a problem" → open a dispute (distinct from a return: no send-back).
 * Item scope is optional — leaving quantities at 0 disputes the whole sub-order
 * (e.g. "order not received").
 */
export function ReportProblemButton({ sub, orderNumber }: { sub: SubOrderLite; orderNumber: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 hover:text-foreground"
      >
        <ShieldAlert className="h-3.5 w-3.5" /> Report a problem
      </button>
      {open && <DisputeModal sub={sub} orderNumber={orderNumber} onClose={() => setOpen(false)} />}
    </>
  )
}

function DisputeModal({
  sub, orderNumber, onClose,
}: {
  sub: SubOrderLite
  orderNumber: string
  onClose: () => void
}) {
  const [type, setType] = useState<DisputeType>("not_received")
  const [buyerNotes, setBuyerNotes] = useState("")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const selected = TYPES.find((t) => t.value === type)!
  // "not_received" / "unauthorized" are whole-order by nature — item picker is
  // only meaningful for item-condition disputes.
  const showItemPicker = type === "not_as_described" || type === "damaged" || type === "other"

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!buyerNotes.trim()) {
      setErr("Please tell us briefly what happened.")
      return
    }
    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in.")
      const items = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([orderItemId, quantity]) => ({ orderItemId, quantity }))
      await createDispute(token, {
        orderNumber,
        subOrderId: sub.id,
        type,
        buyerNotes: buyerNotes.trim(),
        evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
        items: showItemPicker && items.length > 0 ? items : undefined,
      })
      setDone(true)
    } catch (e) {
      setErr(friendlyMessage(e, "Could not open the dispute."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Report a problem</h2>
            <p className="mt-0.5 text-xs text-gray-600">
              Order <code className="font-mono">{orderNumber}</code> · we&apos;ll look into it and get back to you
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </header>

        {done ? (
          <div className="space-y-3 px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="font-semibold text-gray-900">Dispute submitted</p>
            <p className="mx-auto max-w-sm text-sm text-gray-600">
              We&apos;ve logged your report and will email you as it&apos;s reviewed. You don&apos;t need to ship anything back.
            </p>
            <button onClick={onClose} className="mt-4 inline-flex items-center justify-center rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col overflow-hidden">
            <div className="space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                  What&apos;s wrong?
                </label>
                <div className="space-y-2">
                  {TYPES.map((t) => (
                    <label key={t.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:border-gray-400">
                      <input
                        type="radio"
                        name="dispute-type"
                        value={t.value}
                        checked={type === t.value}
                        onChange={() => setType(t.value)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-900">{t.label}</span>
                        <span className="block text-xs text-gray-500">{t.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {showItemPicker && (
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Which items? <span className="font-normal normal-case text-gray-400">(optional — leave blank for the whole order)</span>
                  </label>
                  <div className="space-y-2">
                    {sub.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{item.productTitle ?? item.productName ?? "Item"}</p>
                          {item.variantName && <p className="truncate text-xs text-gray-500">{item.variantName}</p>}
                          <p className="mt-0.5 text-xs text-gray-500">
                            Bought {item.quantity}{item.unitPriceCents != null && <> · {fmt(item.unitPriceCents)} each</>}
                          </p>
                        </div>
                        <select
                          value={quantities[item.id] ?? 0}
                          onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: parseInt(e.target.value) }))}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                        >
                          {Array.from({ length: item.quantity + 1 }, (_, i) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                  What happened?
                </label>
                <textarea
                  value={buyerNotes}
                  onChange={(e) => setBuyerNotes(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder="A short description helps us resolve it faster."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                  Evidence <span className="font-normal normal-case text-gray-400">(optional — photos/screenshots)</span>
                </label>
                {evidenceUrls.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {evidenceUrls.map((u) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={u} src={u} alt="evidence" className="h-16 w-16 rounded-md border border-gray-200 object-cover" />
                    ))}
                  </div>
                )}
                <UploadDropzone
                  endpoint="productImage"
                  onClientUploadComplete={(res) => setEvidenceUrls((prev) => [...prev, ...res.map((f) => f.ufsUrl)])}
                  onUploadError={() => setErr("Couldn't upload that file. Please try again.")}
                  appearance={{ container: "border-dashed border-gray-300 rounded-lg py-4" }}
                />
              </div>

              {err && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {err}
                </div>
              )}
            </div>

            <footer className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-600 hover:text-gray-900">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit dispute"}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  )
}
