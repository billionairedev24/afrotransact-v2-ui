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
  const [commissionRate, setCommissionRate] = useState<number>(10) // display as %
  const [autoPayoutsEnabled, setAutoPayoutsEnabled] = useState<boolean>(true)
  const [minPayoutDollars, setMinPayoutDollars] = useState<number>(5)
  const [maxPayoutDollars, setMaxPayoutDollars] = useState<number>(5000)

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
        if (!cancelled) {
          setSettlementDays(settings.settlement_days ?? 7)
          setCommissionRate((settings.platform_commission_rate ?? 0.10) * 100)
          setAutoPayoutsEnabled(settings.auto_payouts_enabled ?? true)
          setMinPayoutDollars((settings.minimum_payout_amount_cents ?? 500) / 100)
          setMaxPayoutDollars((settings.maximum_payout_amount_cents ?? 500000) / 100)
        }
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
      await updatePaymentSettings(token, {
        settlement_days: settlementDays,
        platform_commission_rate: Number((commissionRate / 100).toFixed(4)),
        auto_payouts_enabled: autoPayoutsEnabled,
        minimum_payout_amount_cents: Math.round(minPayoutDollars * 100),
        maximum_payout_amount_cents: Math.round(maxPayoutDollars * 100)
      })
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
              <h2 className="text-sm font-semibold text-gray-900">Platform Settings</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Controls the base platform configurations and rules for all sellers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  Platform Commission Rate (%)
                </label>
                <div className="relative max-w-[150px]">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    className={`${INPUT_CLASS} pr-8`}
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  The default percentage cut taken from all sub-orders by the platform.
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  Global Auto-Payouts
                </label>
                <button
                  type="button"
                  onClick={() => setAutoPayoutsEnabled(!autoPayoutsEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoPayoutsEnabled ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoPayoutsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <p className="text-xs text-gray-400 mt-1.5 leading-snug max-w-[200px]">
                  Uncheck to instantly freeze all nightly Stripe payouts to sellers (e.g. during a fraud audit).
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Seller Payouts & Limits</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Controls how long after a customer payment the funds are held before being
                transferred to a seller&apos;s Stripe account.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
                  className={`${INPUT_CLASS}`}
                />
                <p className="text-xs text-gray-400 mt-1.5 leading-snug">
                  Funds become eligible for the nightly payout run after this many days.
                </p>
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  Min Payout Amount ($)
                </label>
                <input
                  type="number"
                  min={1}
                  value={minPayoutDollars}
                  onChange={(e) => setMinPayoutDollars(Number(e.target.value))}
                  className={`${INPUT_CLASS}`}
                />
                <p className="text-xs text-gray-400 mt-1.5 leading-snug">
                  Prevents micro-transfers that lose money to Stripe routing fees.
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  Max Payout Amount ($)
                </label>
                <input
                  type="number"
                  min={100}
                  value={maxPayoutDollars}
                  onChange={(e) => setMaxPayoutDollars(Number(e.target.value))}
                  className={`${INPUT_CLASS}`}
                />
                <p className="text-xs text-gray-400 mt-1.5 leading-snug">
                  Fraud protection bound. Amounts over this will require manual review.
                </p>
              </div>
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
