"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { toast } from "sonner"
import { logError } from "@/lib/errors"
import { ToggleRight, ToggleLeft, Loader2, Plus, BarChart2 } from "lucide-react"
import {
  getAdminRegions,
  getFeatureFlags,
  upsertFeatureFlag,
  putAdminAnalyticsSettings,
  type Region,
  type FeatureFlag,
} from "@/lib/api"
import { useAdminAnalyticsSettings, useInvalidateAnalyticsSettings } from "@/hooks/use-analytics-settings"

const INPUT_CLASS =
  "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary/60 transition-colors"

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function FeatureFlagsPage() {
  const { status } = useSession()

  const [regions, setRegions] = useState<Region[]>([])
  const [selectedRegionId, setSelectedRegionId] = useState<string>("")
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [regionsLoading, setRegionsLoading] = useState(true)
  const [regionsError, setRegionsError] = useState<string | null>(null)
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [flagsError, setFlagsError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newFlagKey, setNewFlagKey] = useState("")

  const [analyticsToken, setAnalyticsToken] = useState<string | undefined>()
  const { data: analyticsSettings, isLoading: analyticsLoading } = useAdminAnalyticsSettings(analyticsToken)
  const [analyticsSaving, setAnalyticsSaving] = useState<"admin" | "seller" | null>(null)
  const invalidateAnalytics = useInvalidateAnalyticsSettings()

  useEffect(() => {
    if (status !== "authenticated") return
    getAccessToken().then((t) => {
      if (t) setAnalyticsToken(t)
    })
  }, [status])

  useEffect(() => {
    if (status !== "authenticated") {
      setRegionsLoading(false)
      return
    }

    let cancelled = false

    async function fetchRegions() {
      const token = await getAccessToken()
      if (!token) return
      try {
        setRegionsError(null)
        setRegionsLoading(true)
        const data = await getAdminRegions(token)
        if (!cancelled) {
          setRegions(data)
          if (data.length > 0 && !selectedRegionId) {
            setSelectedRegionId(data[0].id)
          }
        }
      } catch (e) {
        if (!cancelled) {
          logError(e, "loading regions")
          setRegionsError("Failed to load regions")
        }
      } finally {
        if (!cancelled) setRegionsLoading(false)
      }
    }

    fetchRegions()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  useEffect(() => {
    if (status !== "authenticated" || !selectedRegionId) {
      setFlags([])
      return
    }

    let cancelled = false

    async function load() {
      const token = await getAccessToken()
      if (!token) return
      try {
        setFlagsError(null)
        setFlagsLoading(true)
        const data = await getFeatureFlags(token, selectedRegionId)
        if (!cancelled) setFlags(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) {
          logError(e, "loading feature flags")
          setFlagsError("Failed to load feature flags")
        }
      } finally {
        if (!cancelled) setFlagsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [status, selectedRegionId])

  const handleToggle = async (flag: FeatureFlag) => {
    const token = await getAccessToken()
    if (!token || !selectedRegionId) return

    setSaving(flag.id)
    try {
      const updated = await upsertFeatureFlag(token, selectedRegionId, {
        key: flag.key,
        enabled: !flag.enabled,
      })
      setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, ...updated } : f)))
      toast.success(`${humanizeKey(flag.key)} ${!flag.enabled ? "enabled" : "disabled"}`)
    } catch (e) {
      logError(e, "updating feature flag")
      toast.error("Failed to update flag")
    } finally {
      setSaving(null)
    }
  }

  const handleAddFlag = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = await getAccessToken()
    if (!token || !selectedRegionId || !newFlagKey.trim()) return

    setAdding(true)
    try {
      const created = await upsertFeatureFlag(token, selectedRegionId, {
        key: newFlagKey.trim().toLowerCase().replace(/\s+/g, "_"),
        enabled: false,
      })
      setFlags((prev) => {
        const exists = prev.some((f) => f.key === created.key)
        return exists ? prev.map((f) => (f.key === created.key ? created : f)) : [...prev, created]
      })
      setNewFlagKey("")
      toast.success("Feature flag created")
    } catch (e) {
      logError(e, "creating feature flag")
      toast.error("Failed to create flag")
    } finally {
      setAdding(false)
    }
  }

  async function toggleAdminAnalytics(next: boolean) {
    const token = await getAccessToken()
    if (!token || !analyticsSettings) return
    setAnalyticsSaving("admin")
    try {
      await putAdminAnalyticsSettings(token, { ...analyticsSettings, adminAnalyticsEnabled: next })
      invalidateAnalytics()
      toast.success(`Admin analytics ${next ? "enabled" : "disabled"}`)
    } catch (e) {
      logError(e, "updating admin analytics setting")
      toast.error("Failed to update setting")
    } finally {
      setAnalyticsSaving(null)
    }
  }

  async function toggleSellerAnalytics(next: boolean) {
    const token = await getAccessToken()
    if (!token || !analyticsSettings) return
    setAnalyticsSaving("seller")
    try {
      await putAdminAnalyticsSettings(token, { ...analyticsSettings, sellerAnalyticsEnabled: next })
      invalidateAnalytics()
      toast.success(`Seller analytics ${next ? "enabled" : "disabled"}`)
    } catch (e) {
      logError(e, "updating seller analytics setting")
      toast.error("Failed to update setting")
    } finally {
      setAnalyticsSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
        <p className="text-gray-500 text-sm mt-1">
          Per-region toggles below. Analytics visibility is platform-wide and uses its own API (
          <span className="font-mono text-gray-600">/api/v1/config/analytics</span>).
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
        <div className="px-5 py-4 border-b border-gray-200 flex items-start gap-3">
          <BarChart2 className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-gray-900 font-semibold text-sm">Analytics access</p>
            <p className="text-gray-500 text-xs mt-1 max-w-xl">
              When off, the Analytics item is hidden from the corresponding sidebar and the dashboard shows a
              short message if opened directly. This does not use region feature flags.
            </p>
          </div>
        </div>
        {analyticsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !analyticsSettings ? (
          <p className="px-5 py-6 text-sm text-gray-400">Could not load analytics settings.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="flex items-start gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-medium text-sm">Admin analytics</p>
                <p className="text-gray-400 text-xs mt-1">
                  Platform Analytics under the admin sidebar (revenue, orders, etc.).
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                <span
                  className={`text-xs font-semibold ${
                    analyticsSettings.adminAnalyticsEnabled ? "text-green-500" : "text-gray-400"
                  }`}
                >
                  {analyticsSettings.adminAnalyticsEnabled ? "On" : "Off"}
                </span>
                <button
                  type="button"
                  onClick={() => toggleAdminAnalytics(!analyticsSettings.adminAnalyticsEnabled)}
                  disabled={analyticsSaving !== null}
                  className="text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-40"
                  aria-label="Toggle admin analytics"
                >
                  {analyticsSaving === "admin" ? (
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  ) : analyticsSettings.adminAnalyticsEnabled ? (
                    <ToggleRight className="h-7 w-7 text-primary" />
                  ) : (
                    <ToggleLeft className="h-7 w-7" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-start gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-medium text-sm">Seller analytics</p>
                <p className="text-gray-400 text-xs mt-1">
                  Store analytics under the seller dashboard sidebar.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                <span
                  className={`text-xs font-semibold ${
                    analyticsSettings.sellerAnalyticsEnabled ? "text-green-500" : "text-gray-400"
                  }`}
                >
                  {analyticsSettings.sellerAnalyticsEnabled ? "On" : "Off"}
                </span>
                <button
                  type="button"
                  onClick={() => toggleSellerAnalytics(!analyticsSettings.sellerAnalyticsEnabled)}
                  disabled={analyticsSaving !== null}
                  className="text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-40"
                  aria-label="Toggle seller analytics"
                >
                  {analyticsSaving === "seller" ? (
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  ) : analyticsSettings.sellerAnalyticsEnabled ? (
                    <ToggleRight className="h-7 w-7 text-primary" />
                  ) : (
                    <ToggleLeft className="h-7 w-7" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-500 shrink-0">Region</label>
        <select
          value={selectedRegionId}
          onChange={(e) => setSelectedRegionId(e.target.value)}
          disabled={regionsLoading || regions.length === 0}
          className={`${INPUT_CLASS} min-w-[200px]`}
        >
          <option value="">
            {regionsLoading ? "Loading regions…" : regions.length === 0 ? "No regions" : "Select region"}
          </option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.code})
            </option>
          ))}
        </select>
      </div>

      {regionsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {regionsError}
        </div>
      )}

      {!selectedRegionId && !regionsLoading && regions.length > 0 && (
        <p className="text-gray-500 text-sm">Select a region to manage feature flags.</p>
      )}

      {selectedRegionId && (
        <>
          {flagsError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {flagsError}
            </div>
          )}

          {flagsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden bg-white">
                {flags.map((flag) => (
                  <div key={flag.id || flag.key} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-medium text-sm">{humanizeKey(flag.key)}</p>
                      <p className="text-gray-500 text-xs mt-0.5 font-mono">{flag.key}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-semibold ${
                          flag.enabled ? "text-green-400" : "text-gray-500"
                        }`}
                      >
                        {flag.enabled ? "On" : "Off"}
                      </span>
                      <button
                        onClick={() => handleToggle(flag)}
                        disabled={saving === flag.id}
                        className="text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-40"
                        aria-label={`Toggle ${flag.key}`}
                      >
                        {saving === flag.id ? (
                          <Loader2 className="h-7 w-7 animate-spin text-primary" />
                        ) : flag.enabled ? (
                          <ToggleRight className="h-7 w-7 text-primary" />
                        ) : (
                          <ToggleLeft className="h-7 w-7" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
                {flags.length === 0 && (
                  <div className="px-5 py-8 text-center text-gray-500 text-sm">
                    No feature flags for this region yet.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                <div className="px-5 py-4 border-b border-gray-200">
                  <p className="text-gray-900 font-medium text-sm">Add region flag</p>
                </div>
                <form onSubmit={handleAddFlag} className="p-5 flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1.5">Feature key</label>
                    <input
                      type="text"
                      value={newFlagKey}
                      onChange={(e) => setNewFlagKey(e.target.value)}
                      placeholder="e.g. reviews_enabled"
                      className={`${INPUT_CLASS} w-full`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={adding || !newFlagKey.trim()}
                    className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add flag
                  </button>
                </form>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
