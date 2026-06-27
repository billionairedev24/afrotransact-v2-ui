"use client"

import { useCallback, useEffect, useState } from "react"
import { Truck, AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getAccessToken } from "@/lib/auth-helpers"
import { ApiError } from "@/lib/api"
import { friendlyMessage, logError } from "@/lib/errors"
import {
  listAdminStoreShipping,
  setAdminStoreShippingMode,
  type AdminStoreShippingRow,
  type StoreShippingMode,
} from "@/lib/api"

const MODE_LABELS: Record<StoreShippingMode, string> = {
  unlimited: "Unlimited",
  radius:    "Radius",
  regions:   "Regions",
}

const MODE_BADGE: Record<StoreShippingMode, string> = {
  unlimited: "bg-emerald-50 text-emerald-700 border-emerald-200",
  radius:    "bg-blue-50 text-blue-700 border-blue-200",
  regions:   "bg-amber-50 text-amber-700 border-amber-200",
}

export default function AdminStoreShippingPage() {
  const [rows, setRows] = useState<AdminStoreShippingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      const data = await listAdminStoreShipping(token)
      setRows(data)
    } catch (e) {
      logError(e, "storeShipping.load")
      if (e instanceof ApiError && e.status === 401) {
        setError("Your admin session has expired. Please sign in again.")
      } else {
        setError(friendlyMessage(e, "Couldn't load store shipping. Please try again."))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function flip(row: AdminStoreShippingRow, next: StoreShippingMode) {
    if (next === row.shippingMode) return
    const previous = row.shippingMode
    // Optimistic
    setRows((rs) => rs.map((r) => r.storeId === row.storeId ? { ...r, shippingMode: next, stuckReason: null } : r))
    setSavingId(row.storeId)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in")
      await setAdminStoreShippingMode(token, row.storeId, next)
      toast.success(`${row.name ?? "Store"}: shipping mode set to ${MODE_LABELS[next]}`)
      void load() // re-resolve stuckReason against the new mode
    } catch (e) {
      // Revert
      setRows((rs) => rs.map((r) => r.storeId === row.storeId ? { ...r, shippingMode: previous } : r))
      logError(e, "storeShipping.flip")
      toast.error(friendlyMessage(e, "Couldn't change shipping mode. Please try again."))
    } finally {
      setSavingId(null)
    }
  }

  const stuckCount = rows.filter((r) => r.stuckReason).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="h-6 w-6" /> Store shipping diagnostics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Every seller's effective shipping policy at a glance. Force-flip a store's mode here to unblock buyers
            without asking the seller to re-save their settings.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          Refresh
        </button>
      </div>

      {stuckCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>{stuckCount}</strong> {stuckCount === 1 ? "store is" : "stores are"} in a stuck shipping configuration —
            buyers there cannot get rates. Switch them to <strong>Unlimited</strong> to unblock immediately.
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <div className="rounded-xl border border-input bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Store</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Diagnostics</th>
                <th className="px-4 py-3 font-medium w-[180px]">Force mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && !error && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No stores configured.</td></tr>
              )}
              {rows.map((r) => {
                const isSaving = savingId === r.storeId
                return (
                  <tr key={r.storeId} className={r.stuckReason ? "bg-amber-50/40" : ""}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.name ?? "(unnamed)"}</div>
                      {r.slug && <div className="text-xs text-gray-400 font-mono">{r.slug}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${MODE_BADGE[r.shippingMode]}`}>
                        {MODE_LABELS[r.shippingMode]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-gray-500">
                        <span className="rounded bg-gray-100 px-2 py-0.5">{r.regionCount} region rows</span>
                        <span className="rounded bg-gray-100 px-2 py-0.5">
                          origin {r.originGeocoded ? "geocoded ✓" : "not geocoded"}
                        </span>
                        {r.shippingRadiusMeters != null && (
                          <span className="rounded bg-gray-100 px-2 py-0.5">
                            radius {Math.round(r.shippingRadiusMeters / 1000)} km
                          </span>
                        )}
                      </div>
                      {r.stuckReason && (
                        <div className="mt-1.5 text-amber-800 flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{r.stuckReason}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={r.shippingMode}
                          onChange={(e) => void flip(r, e.target.value as StoreShippingMode)}
                          disabled={isSaving}
                          className="rounded-lg border border-input bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-primary/60 disabled:opacity-50"
                        >
                          <option value="unlimited">Unlimited</option>
                          <option value="radius">Radius</option>
                          <option value="regions">Regions</option>
                        </select>
                        {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
