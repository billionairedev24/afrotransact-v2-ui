"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Save, Gift } from "lucide-react"
import { toast } from "sonner"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  ApiError,
  getReferralSettings,
  updateReferralSettings,
  type ReferralSettings,
} from "@/lib/api"
import { friendlyMessage, logError } from "@/lib/errors"

const INPUT_CLASS =
  "w-full rounded-xl border border-input bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary/60 transition-colors"

const EMPTY_SETTINGS: ReferralSettings = {
  enabled: false,
  reward_cents: 0,
  currency: "USD",
  max_referrals_per_user: 0,
}

const MAX_REWARD_DOLLARS = 10_000

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

function describeReferralError(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) {
    return "Your admin session has expired. Please sign in again."
  }
  if (err instanceof ApiError && err.status === 403) {
    return "You don't have permission to change platform settings."
  }
  return friendlyMessage(err, "Referral settings failed. Please try again.")
}

export default function AdminReferralSettingsPage() {
  const [settings, setSettings] = useState<ReferralSettings>(EMPTY_SETTINGS)
  const [rewardDollars, setRewardDollars] = useState<number>(0)
  const [maxReferralsPerUser, setMaxReferralsPerUser] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) { setLoading(false); return }
      const data = await getReferralSettings()
      setSettings(data)
      setRewardDollars((data.reward_cents ?? 0) / 100)
      setMaxReferralsPerUser(data.max_referrals_per_user ?? 0)
    } catch (e) {
      logError(e, "referralSettings.load")
      toast.error(describeReferralError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const token = await getAccessToken()
    if (!token) return

    if (Number.isNaN(rewardDollars) || rewardDollars < 0) {
      toast.error("Reward amount must be zero or greater.")
      return
    }
    if (rewardDollars > MAX_REWARD_DOLLARS) {
      toast.error(`Reward amount can't exceed $${MAX_REWARD_DOLLARS.toLocaleString()}.`)
      return
    }
    if (!Number.isInteger(maxReferralsPerUser) || maxReferralsPerUser < 0) {
      toast.error("Max referrals per user must be a whole number of zero or greater.")
      return
    }

    setSaving(true)
    try {
      const payload: ReferralSettings = {
        enabled: settings.enabled,
        reward_cents: Math.round(rewardDollars * 100),
        currency: "USD",
        max_referrals_per_user: maxReferralsPerUser,
      }
      const updated = await updateReferralSettings(token, payload)
      setSettings(updated)
      setRewardDollars((updated.reward_cents ?? 0) / 100)
      setMaxReferralsPerUser(updated.max_referrals_per_user ?? 0)
      toast.success("Referral settings saved")
    } catch (err) {
      logError(err, "referralSettings.save")
      toast.error(describeReferralError(err))
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
        <h1 className="text-2xl font-bold text-gray-900">Referral Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Enable the referral program and set the store-credit reward buyers earn.
        </p>
      </div>

      <form onSubmit={handleSave} className="rounded-2xl border border-input bg-white overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <Gift className="h-4 w-4 shrink-0 text-foreground" />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-gray-900">Referral program</span>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              settings.enabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            {settings.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900">Referral program enabled</label>
              <p className="text-xs text-gray-500 mt-0.5 max-w-md">
                When on, buyers can share a referral link and earn store credit when it's used.
              </p>
            </div>
            <Toggle
              on={settings.enabled}
              onToggle={() => setSettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Reward amount ($)</label>
              <div className="relative max-w-[180px]">
                <span className="absolute left-3 top-2.5 text-xs text-gray-400">$</span>
                <input
                  type="number"
                  min={0}
                  max={MAX_REWARD_DOLLARS}
                  step={0.01}
                  value={rewardDollars}
                  onChange={(e) => setRewardDollars(Number(e.target.value))}
                  className={`${INPUT_CLASS} pl-6`}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Store credit awarded per successful referral.</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Currency</label>
              <input value="USD" disabled className={`${INPUT_CLASS} max-w-[180px] bg-gray-50 text-gray-500`} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Max referrals per user (0 = unlimited)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={maxReferralsPerUser}
                onChange={(e) => setMaxReferralsPerUser(Math.max(0, Math.trunc(Number(e.target.value))))}
                className={`${INPUT_CLASS} max-w-[180px]`}
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Caps how many rewarded referrals a single referrer can earn. Guards against reward farming.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-bold text-[#0f0f10] hover:bg-brand-gold-hover transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Referral Settings
          </button>
        </div>
      </form>
    </div>
  )
}
