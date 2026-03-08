"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { toast } from "sonner"
import { Save, Percent, Loader2 } from "lucide-react"
import { getRegions, updateRegion, type Region } from "@/lib/api"

const INPUT_CLASS =
  "w-20 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white text-center outline-none focus:border-primary/60 transition-colors"

export default function CommissionPage() {
  const { status } = useSession()

  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)

  const fetchRegions = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await getRegions(token)
      setRegions(data)
      setEdits({})
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load regions")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") fetchRegions()
  }, [status, fetchRegions])

  const getDisplayRate = (region: Region) => edits[region.id] ?? region.commissionRate

  const updateLocalRate = (id: string, value: number) => {
    setEdits((prev) => ({ ...prev, [id]: value }))
    setSuccessId(null)
  }

  const saveRegion = async (region: Region) => {
    const token = await getAccessToken()
    if (!token) return
    const newRate = getDisplayRate(region)
    if (newRate === region.commissionRate) {
      setEdits((prev) => {
        const next = { ...prev }
        delete next[region.id]
        return next
      })
      return
    }
    setSavingId(region.id)
    try {
      const updated = await updateRegion(token, region.id, { settings: { ...region.settings, commission_rate: newRate } })
      setRegions((prev) => prev.map((r) => (r.id === region.id ? updated : r)))
      setEdits((prev) => {
        const next = { ...prev }
        delete next[region.id]
        return next
      })
      toast.success(`Commission rate for ${region.name} updated`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSavingId(null)
    }
  }

  if (status !== "authenticated") {
    return (
      <div
        className="rounded-2xl border border-white/10 p-8 text-center"
        style={{ background: "hsl(0 0% 11%)" }}
      >
        <p className="text-gray-400">Sign in to manage commission rates.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Commission Rates</h1>
          <p className="text-gray-400 text-sm mt-1">
            Set the platform commission percentage per region. Applied at checkout to each sub-order.
          </p>
        </div>
        <div
          className="rounded-2xl border border-white/10 p-12 flex items-center justify-center"
          style={{ background: "hsl(0 0% 11%)" }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Commission Rates</h1>
          <p className="text-gray-400 text-sm mt-1">
            Set the platform commission percentage per region. Applied at checkout to each sub-order.
          </p>
        </div>
        <div
          className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-400"
        >
          <p className="font-medium">Failed to load regions</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchRegions}
            className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Commission Rates</h1>
        <p className="text-gray-400 text-sm mt-1">
          Set the platform commission percentage per region. Applied at checkout to each sub-order.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {regions.map((region) => (
          <div
            key={region.id}
            className="rounded-2xl border border-white/10 overflow-hidden"
            style={{ background: "hsl(0 0% 11%)" }}
          >
            <div className="p-5">
              <p className="text-white font-medium text-sm">{region.name || region.city || "Unnamed Region"}</p>
              <p className="text-gray-500 text-xs font-mono mt-0.5">{region.code || "—"}</p>

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={getDisplayRate(region)}
                  onChange={(e) => updateLocalRate(region.id, Number(e.target.value))}
                  className={INPUT_CLASS}
                />
                <Percent className="h-4 w-4 text-gray-400 shrink-0" />
              </div>

              <button
                onClick={() => saveRegion(region)}
                disabled={
                  savingId === region.id ||
                  getDisplayRate(region) === region.commissionRate
                }
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingId === region.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingId === region.id ? "Saving…" : successId === region.id ? "Saved ✓" : "Save"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {regions.length === 0 && (
        <div
          className="rounded-2xl border border-white/10 p-12 text-center"
          style={{ background: "hsl(0 0% 11%)" }}
        >
          <p className="text-gray-400">No regions found. Add regions in the Regions page.</p>
        </div>
      )}

      <div
        className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-xs text-yellow-300 space-y-1"
      >
        <p className="font-semibold">How commission works</p>
        <p>
          At checkout, the platform deducts the configured commission percentage from each
          sub-order subtotal before transferring the remainder to the seller via Stripe Connect.
          Stripe fees (~2.9% + $0.30) are deducted from the gross payment amount first.
        </p>
      </div>
    </div>
  )
}
