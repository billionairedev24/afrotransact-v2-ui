"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  ApiError,
  getPaymentSettings,
  updatePaymentSettings,
  getAdminShippingSettings,
  putAdminShippingSettings,
  type ShippingSettings,
} from "@/lib/api"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

const INPUT_CLASS =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary/60 transition-colors"

function describeSettingsError(section: string, err: unknown): string {
  if (err instanceof ApiError) {
    return `${section} failed (HTTP ${err.status}). ${err.body}`
  }
  if (err instanceof Error && err.message) {
    return `${section} failed. ${err.message}`
  }
  return `${section} failed.`
}

export default function PaymentSettingsPage() {
  const { status } = useSession()

  const [settlementDays, setSettlementDays] = useState<number>(7)
  const [commissionRate, setCommissionRate] = useState<number>(10) // display as %
  const [autoPayoutsEnabled, setAutoPayoutsEnabled] = useState<boolean>(true)
  const [minPayoutDollars, setMinPayoutDollars] = useState<number>(5)
  const [maxPayoutDollars, setMaxPayoutDollars] = useState<number>(5000)
  const [shipping, setShipping] = useState<ShippingSettings>({
    shipping_realtime_enabled: false,
    shipping_provider: "shippo",
    shipping_realtime_state_allowlist: [],
    shipping_realtime_city_allowlist: [],
    shipping_realtime_fallback_static: true,
    shipping_pack_max_weight_lbs: null,
    shipping_pack_max_stack_height_in: null,
  })
  const [shippingStatesInput, setShippingStatesInput] = useState("")
  const [shippingCitiesInput, setShippingCitiesInput] = useState("")

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
      if (!token) {
        if (!cancelled) setLoading(false)
        return
      }

      const [payResult, shipResult] = await Promise.allSettled([
        getPaymentSettings(token),
        getAdminShippingSettings(token),
      ])

      if (payResult.status === "fulfilled" && !cancelled) {
        const settings = payResult.value
        setSettlementDays(settings.settlement_days ?? 7)
        setCommissionRate((settings.platform_commission_rate ?? 0.10) * 100)
        setAutoPayoutsEnabled(settings.auto_payouts_enabled ?? true)
        setMinPayoutDollars((settings.minimum_payout_amount_cents ?? 500) / 100)
        setMaxPayoutDollars((settings.maximum_payout_amount_cents ?? 500000) / 100)
      } else if (payResult.status === "rejected") {
        toast.error(describeSettingsError("Payment & payout settings", payResult.reason))
      }

      if (shipResult.status === "fulfilled" && !cancelled) {
        const shippingSettings = shipResult.value
        setShipping(shippingSettings)
        setShippingStatesInput((shippingSettings.shipping_realtime_state_allowlist ?? []).join(", "))
        setShippingCitiesInput((shippingSettings.shipping_realtime_city_allowlist ?? []).join(", "))
      } else if (shipResult.status === "rejected") {
        toast.error(describeSettingsError("Shipping settings", shipResult.reason))
      }

      if (!cancelled) setLoading(false)
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
      const parseOptionalPositive = (v: number | null | undefined) => {
        if (v == null || Number.isNaN(v)) return null
        return v > 0 ? v : null
      }
      const nextShipping: ShippingSettings = {
        ...shipping,
        shipping_realtime_state_allowlist: shippingStatesInput
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
        shipping_realtime_city_allowlist: shippingCitiesInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        shipping_pack_max_weight_lbs: parseOptionalPositive(shipping.shipping_pack_max_weight_lbs ?? undefined),
        shipping_pack_max_stack_height_in: parseOptionalPositive(
          shipping.shipping_pack_max_stack_height_in ?? undefined,
        ),
      }
      await updatePaymentSettings(token, {
        settlement_days: settlementDays,
        platform_commission_rate: Number((commissionRate / 100).toFixed(4)),
        auto_payouts_enabled: autoPayoutsEnabled,
        minimum_payout_amount_cents: Math.round(minPayoutDollars * 100),
        maximum_payout_amount_cents: Math.round(maxPayoutDollars * 100)
      })
      try {
        await putAdminShippingSettings(token, nextShipping)
        setShipping(nextShipping)
      } catch (shipErr) {
        toast.error(describeSettingsError("Shipping settings were not saved", shipErr))
        toast.message("Payment & payout changes may have been saved; refresh to confirm.", { duration: 6000 })
        return
      }
      toast.success("Platform settings saved")
    } catch (err) {
      toast.error(describeSettingsError("Payment & payout settings were not saved", err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure platform-wide shipping, payment and payout behaviour.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <details open className="rounded-2xl border border-gray-200 bg-white">
            <summary className="cursor-pointer list-none border-b border-gray-100 px-6 py-4 text-sm font-semibold text-gray-900">
              Commission & Platform Controls
            </summary>
            <div className="p-6 space-y-5">
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
          </details>

          <details open className="rounded-2xl border border-gray-200 bg-white">
            <summary className="cursor-pointer list-none border-b border-gray-100 px-6 py-4 text-sm font-semibold text-gray-900">
              Shipping Controls
            </summary>
            <div className="p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Shipping Mode & Provider</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Controls realtime carrier shipping rollout. Internal mode remains active when disabled.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Realtime Carrier Shipping</label>
                <button
                  type="button"
                  onClick={() => setShipping((prev) => ({ ...prev, shipping_realtime_enabled: !prev.shipping_realtime_enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    shipping.shipping_realtime_enabled ? "bg-primary" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      shipping.shipping_realtime_enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <p className="text-xs text-gray-400 mt-1.5">
                  Off = current internal/admin fulfillment logic. On = carrier quote selection in checkout.
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Shipping Provider</label>
                <select
                  value={shipping.shipping_provider}
                  onChange={(e) =>
                    setShipping((prev) => ({
                      ...prev,
                      shipping_provider: (e.target.value as "shippo" | "easypost"),
                    }))
                  }
                  className={INPUT_CLASS}
                >
                  <option value="shippo">Shippo</option>
                  <option value="easypost">EasyPost</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">State allowlist (CSV)</label>
                <input
                  value={shippingStatesInput}
                  onChange={(e) => setShippingStatesInput(e.target.value)}
                  placeholder="TX, CA, NY"
                  className={INPUT_CLASS}
                />
                <p className="text-xs text-gray-400 mt-1.5">Leave empty to allow all states.</p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">City allowlist (CSV)</label>
                <input
                  value={shippingCitiesInput}
                  onChange={(e) => setShippingCitiesInput(e.target.value)}
                  placeholder="Austin, Dallas"
                  className={INPUT_CLASS}
                />
                <p className="text-xs text-gray-400 mt-1.5">Optional. If set, only these cities get realtime rates.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Fallback to static shipping when realtime unavailable</label>
              <button
                type="button"
                onClick={() =>
                  setShipping((prev) => ({
                    ...prev,
                    shipping_realtime_fallback_static: !prev.shipping_realtime_fallback_static,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  shipping.shipping_realtime_fallback_static ? "bg-primary" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    shipping.shipping_realtime_fallback_static ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-900">Multi-parcel packing (carrier quotes)</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-4">
                Limits how cart lines are split into parcels for rating. Leave blank to use the order service
                deployment defaults (see <code className="text-[11px]">SHIPPING_PACK_*</code> env vars).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Max weight per parcel (lb)</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.5}
                    value={shipping.shipping_pack_max_weight_lbs ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value
                      setShipping((prev) => ({
                        ...prev,
                        shipping_pack_max_weight_lbs: raw === "" ? null : Number(raw),
                      }))
                    }}
                    placeholder="e.g. 20"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Max stacked height per parcel (in)</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={shipping.shipping_pack_max_stack_height_in ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value
                      setShipping((prev) => ({
                        ...prev,
                        shipping_pack_max_stack_height_in: raw === "" ? null : Number(raw),
                      }))
                    }}
                    placeholder="e.g. 36"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </div>
            </div>
          </details>

          <details open className="rounded-2xl border border-gray-200 bg-white">
            <summary className="cursor-pointer list-none border-b border-gray-100 px-6 py-4 text-sm font-semibold text-gray-900">
              Payout Limits
            </summary>
            <div className="p-6 space-y-5">
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
          </details>

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
