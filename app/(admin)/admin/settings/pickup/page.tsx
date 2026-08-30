"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Save, MapPin } from "lucide-react"
import { toast } from "sonner"
import { getAccessToken } from "@/lib/auth-helpers"
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete"
import {
  ApiError,
  getAdminPickupSettings,
  putAdminPickupSettings,
  type PickupSettings,
} from "@/lib/api"
import { friendlyMessage, logError } from "@/lib/errors"

const INPUT_CLASS =
  "w-full rounded-xl border border-input bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary/60 transition-colors"

const EMPTY_SETTINGS: PickupSettings = {
  pickup_enabled: false,
  pickup_location: {
    name: "",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postal_code: "",
    country: "",
    hours: "",
    instructions: "",
    prep_time: "",
  },
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? "bg-primary" : "bg-gray-200"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  )
}

function describePickupError(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) {
    return "Your admin session has expired. Please sign in again."
  }
  if (err instanceof ApiError && err.status === 403) {
    return "You don't have permission to change platform settings."
  }
  return friendlyMessage(err, "Pickup settings failed. Please try again.")
}

export default function AdminPickupSettingsPage() {
  const [settings, setSettings] = useState<PickupSettings>(EMPTY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) { setLoading(false); return }
      const data = await getAdminPickupSettings(token)
      setSettings({
        pickup_enabled: data.pickup_enabled ?? false,
        pickup_location: { ...EMPTY_SETTINGS.pickup_location, ...data.pickup_location },
      })
    } catch (e) {
      logError(e, "pickupSettings.load")
      toast.error(describePickupError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function updateLocation(field: keyof PickupSettings["pickup_location"], value: string) {
    setSettings((prev) => ({ ...prev, pickup_location: { ...prev.pickup_location, [field]: value } }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const token = await getAccessToken()
    if (!token) return
    setSaving(true)
    try {
      const updated = await putAdminPickupSettings(token, settings)
      setSettings(updated)
      toast.success("Pickup settings saved")
    } catch (err) {
      logError(err, "pickupSettings.save")
      toast.error(describePickupError(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pickup Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Enable in-person pickup and set the location buyers see at checkout.
        </p>
      </div>

      <form onSubmit={handleSave} className="rounded-2xl border border-input bg-white overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <MapPin className="h-4 w-4 shrink-0 text-foreground" />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-gray-900">Pickup location</span>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              settings.pickup_enabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            {settings.pickup_enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900">Pickup enabled</label>
              <p className="text-xs text-gray-500 mt-0.5 max-w-md">
                Pickup appears at checkout for buyers whose delivery address is in the same city as this location.
              </p>
            </div>
            <Toggle
              on={settings.pickup_enabled}
              onToggle={() => setSettings((prev) => ({ ...prev, pickup_enabled: !prev.pickup_enabled }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Location name</label>
              <input
                value={settings.pickup_location.name}
                onChange={(e) => updateLocation("name", e.target.value)}
                placeholder="e.g. AfroTransact Warehouse"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Hours</label>
              <input
                value={settings.pickup_location.hours}
                onChange={(e) => updateLocation("hours", e.target.value)}
                placeholder="e.g. Mon-Fri 9am-5pm"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Ready in (prep time)</label>
              <input
                value={settings.pickup_location.prep_time}
                onChange={(e) => updateLocation("prep_time", e.target.value)}
                placeholder="e.g. Ready in ~2 hours, or Same day"
                className={INPUT_CLASS}
              />
              <p className="text-[11px] text-gray-400 mt-1">Shown to buyers at checkout next to the pickup option.</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Find address (autocomplete)</label>
              <AddressAutocomplete
                value={settings.pickup_location.line1}
                onChange={(v) => updateLocation("line1", v)}
                onSelect={(parts) => setSettings((prev) => ({
                  ...prev,
                  pickup_location: {
                    ...prev.pickup_location,
                    line1: parts.line1,
                    line2: parts.line2 || prev.pickup_location.line2,
                    city: parts.city || prev.pickup_location.city,
                    region: parts.state || prev.pickup_location.region,
                    postal_code: parts.zip || prev.pickup_location.postal_code,
                    latitude: parts.lat ?? prev.pickup_location.latitude ?? null,
                    longitude: parts.lng ?? prev.pickup_location.longitude ?? null,
                  },
                }))}
                placeholder="Start typing the pickup address…"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Pick from suggestions to auto-fill the fields below and capture coordinates
                (used to show buyers how far the pickup point is from their address).
                {settings.pickup_location.latitude != null && settings.pickup_location.longitude != null && (
                  <span className="ml-1 font-medium text-emerald-600">Coordinates captured ✓</span>
                )}
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Address line 1</label>
              <input
                value={settings.pickup_location.line1}
                onChange={(e) => updateLocation("line1", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Address line 2</label>
              <input
                value={settings.pickup_location.line2}
                onChange={(e) => updateLocation("line2", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">City</label>
              <input
                value={settings.pickup_location.city}
                onChange={(e) => updateLocation("city", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Region / State</label>
              <input
                value={settings.pickup_location.region}
                onChange={(e) => updateLocation("region", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Postal code</label>
              <input
                value={settings.pickup_location.postal_code}
                onChange={(e) => updateLocation("postal_code", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Country</label>
              <input
                value={settings.pickup_location.country}
                onChange={(e) => updateLocation("country", e.target.value)}
                placeholder="e.g. US"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="block text-xs text-gray-500 mb-1.5">Pickup instructions</label>
            <textarea
              value={settings.pickup_location.instructions}
              onChange={(e) => updateLocation("instructions", e.target.value)}
              placeholder="e.g. Ring the bell at the loading dock and ask for the pickup counter."
              rows={4}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-bold text-[#0f0f10] hover:bg-brand-gold-hover transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Pickup Settings
          </button>
        </div>
      </form>
    </div>
  )
}
