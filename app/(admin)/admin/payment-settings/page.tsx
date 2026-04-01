"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { getPaymentSettings, updatePaymentSettings } from "@/lib/api"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

const INPUT_CLASS =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary/60 transition-colors"

export default function PaymentSettingsPage() {
  const { status } = useSession()

  const [settlementDays, setSettlementDays] = useState<number>(7)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      const token = await getAccessToken()
      if (!token) return
      try {
        const settings = await getPaymentSettings(token)
        if (!cancelled) setSettlementDays(settings.settlement_days)
      } catch {
        toast.error("Failed to load payment settings")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [status])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const token = await getAccessToken()
    if (!token) return
    setSaving(true)
    try {
      await updatePaymentSettings(token, { settlement_days: settlementDays })
      toast.success("Payment settings saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure platform-wide payment and payout behaviour.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Seller Payouts</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Controls how long after a customer payment the funds are held before being
                transferred to a seller&apos;s Stripe account.
              </p>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                Settlement window (days)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={settlementDays}
                onChange={(e) => setSettlementDays(Number(e.target.value))}
                className={`${INPUT_CLASS} max-w-[120px]`}
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Funds become eligible for the nightly payout run after this many days.
                Minimum 1, maximum 30.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
