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
  getAiSettings,
  updateAiProvider,
  type ShippingSettings,
  type AiSettings,
} from "@/lib/api"
import { toast } from "sonner"
import { Loader2, Save, Bot, CheckCircle2, XCircle } from "lucide-react"

const INPUT_CLASS =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary/60 transition-colors"

function describeSettingsError(section: string, err: unknown): string {
  if (err instanceof ApiError) return `${section} failed (HTTP ${err.status}). ${err.body}`
  if (err instanceof Error && err.message) return `${section} failed. ${err.message}`
  return `${section} failed.`
}

const PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini 2.0 Flash & Flash-Lite — Google AI Studio",
    models: "gemini-2.0-flash, gemini-2.0-flash-lite",
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    description: "Claude Sonnet 4.6 & Haiku 4.5 — Anthropic API",
    models: "claude-sonnet-4-6, claude-haiku-4-5",
  },
]

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? "bg-primary" : "bg-gray-200"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  )
}

export default function SettingsPage() {
  const { status } = useSession()

  // ── AI provider ──────────────────────────────────────────────────────────
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>("gemini")
  const [savingAi, setSavingAi] = useState(false)

  // ── Payment / shipping ───────────────────────────────────────────────────
  const [settlementDays, setSettlementDays] = useState<number>(7)
  const [commissionRate, setCommissionRate] = useState<number>(10)
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
  const [savingPayment, setSavingPayment] = useState(false)

  useEffect(() => {
    if (status !== "authenticated") { setLoading(false); return }
    let cancelled = false

    async function load() {
      const token = await getAccessToken()
      if (!token) { if (!cancelled) setLoading(false); return }

      const [payResult, shipResult, aiResult] = await Promise.allSettled([
        getPaymentSettings(token),
        getAdminShippingSettings(token),
        getAiSettings(token),
      ])

      if (!cancelled) {
        if (payResult.status === "fulfilled") {
          const s = payResult.value
          setSettlementDays(s.settlement_days ?? 7)
          setCommissionRate((s.platform_commission_rate ?? 0.10) * 100)
          setAutoPayoutsEnabled(s.auto_payouts_enabled ?? true)
          setMinPayoutDollars((s.minimum_payout_amount_cents ?? 500) / 100)
          setMaxPayoutDollars((s.maximum_payout_amount_cents ?? 500000) / 100)
        } else {
          toast.error(describeSettingsError("Payment & payout settings", payResult.reason))
        }

        if (shipResult.status === "fulfilled") {
          setShipping(shipResult.value)
          setShippingStatesInput((shipResult.value.shipping_realtime_state_allowlist ?? []).join(", "))
          setShippingCitiesInput((shipResult.value.shipping_realtime_city_allowlist ?? []).join(", "))
        } else {
          toast.error(describeSettingsError("Shipping settings", shipResult.reason))
        }

        if (aiResult.status === "fulfilled") {
          setAiSettings(aiResult.value)
          setSelectedProvider(aiResult.value.provider)
        }
        // AI settings failure is non-fatal — service may not be running

        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [status])

  async function handleSaveAi() {
    const token = await getAccessToken()
    if (!token) return
    setSavingAi(true)
    try {
      const updated = await updateAiProvider(token, selectedProvider)
      setAiSettings(updated)
      setSelectedProvider(updated.provider)
      toast.success(`AI provider switched to ${updated.provider === "claude" ? "Claude" : "Gemini"}`)
    } catch (err) {
      toast.error(describeSettingsError("AI provider update", err))
    } finally {
      setSavingAi(false)
    }
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault()
    const token = await getAccessToken()
    if (!token) return
    setSavingPayment(true)
    try {
      const parseOptionalPositive = (v: number | null | undefined) =>
        v == null || Number.isNaN(v) || v <= 0 ? null : v

      const nextShipping: ShippingSettings = {
        ...shipping,
        shipping_realtime_state_allowlist: shippingStatesInput.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
        shipping_realtime_city_allowlist: shippingCitiesInput.split(",").map((s) => s.trim()).filter(Boolean),
        shipping_pack_max_weight_lbs: parseOptionalPositive(shipping.shipping_pack_max_weight_lbs ?? undefined),
        shipping_pack_max_stack_height_in: parseOptionalPositive(shipping.shipping_pack_max_stack_height_in ?? undefined),
      }

      await updatePaymentSettings(token, {
        settlement_days: settlementDays,
        platform_commission_rate: Number((commissionRate / 100).toFixed(4)),
        auto_payouts_enabled: autoPayoutsEnabled,
        minimum_payout_amount_cents: Math.round(minPayoutDollars * 100),
        maximum_payout_amount_cents: Math.round(maxPayoutDollars * 100),
      })

      try {
        await putAdminShippingSettings(token, nextShipping)
        setShipping(nextShipping)
      } catch (shipErr) {
        toast.error(describeSettingsError("Shipping settings were not saved", shipErr))
        toast.message("Payment changes may have been saved; refresh to confirm.", { duration: 6000 })
        return
      }
      toast.success("Platform settings saved")
    } catch (err) {
      toast.error(describeSettingsError("Payment & payout settings were not saved", err))
    } finally {
      setSavingPayment(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const activeProviderChanged = aiSettings && selectedProvider !== aiSettings.provider

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure AI provider, payments, shipping, and payout behaviour.</p>
      </div>

      {/* ── AI Provider ───────────────────────────────────────────────────── */}
      <details open className="rounded-2xl border border-gray-200 bg-white">
        <summary className="cursor-pointer list-none border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-gray-900">AI Provider</span>
            {aiSettings && (
              <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">
                {aiSettings.provider} active
              </span>
            )}
          </div>
        </summary>

        <div className="p-6 space-y-5">
          <p className="text-xs text-gray-500">
            Select which AI provider powers Victory — the chat assistant, seller coach, content moderation, and admin analytics.
            The switch takes effect immediately with no restart required.
          </p>

          {!aiSettings ? (
            <p className="text-sm text-gray-400 italic">AI service unavailable — cannot load provider settings.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROVIDERS.map((p) => {
                  const configured = p.id === "gemini" ? aiSettings.gemini_configured : aiSettings.claude_configured
                  const isSelected = selectedProvider === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProvider(p.id)}
                      className={`relative text-left rounded-xl border-2 p-4 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                          <p className="text-[11px] text-gray-400 mt-1.5 font-mono">{p.models}</p>
                        </div>
                        <div className="shrink-0 mt-0.5">
                          {configured ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <span title="API key not configured"><XCircle className="h-4 w-4 text-gray-300" /></span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="absolute bottom-2 right-3 text-[10px] font-bold text-primary uppercase tracking-wide">
                          Selected
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveAi}
                  disabled={savingAi || !activeProviderChanged}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {savingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Apply
                </button>
                {!activeProviderChanged && aiSettings && (
                  <span className="text-xs text-gray-400">
                    {aiSettings.provider === "claude" ? "Claude" : "Gemini"} is currently active
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </details>

      {/* ── Payment & Shipping ────────────────────────────────────────────── */}
      <form onSubmit={handleSavePayment} className="space-y-4">
        <details open className="rounded-2xl border border-gray-200 bg-white">
          <summary className="cursor-pointer list-none border-b border-gray-100 px-6 py-4 text-sm font-semibold text-gray-900">
            Commission & Platform Controls
          </summary>
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Platform Settings</h2>
              <p className="text-xs text-gray-500 mt-0.5">Controls the base platform configurations for all sellers.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Platform Commission Rate (%)</label>
                <div className="relative max-w-[150px]">
                  <input
                    type="number" step="0.1" min={0} max={100}
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    className={`${INPUT_CLASS} pr-8`}
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Default percentage cut taken from all sub-orders.</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Global Auto-Payouts</label>
                <Toggle on={autoPayoutsEnabled} onToggle={() => setAutoPayoutsEnabled(!autoPayoutsEnabled)} />
                <p className="text-xs text-gray-400 mt-1.5 leading-snug max-w-[200px]">
                  Off = freeze all nightly Stripe payouts (e.g. during a fraud audit).
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Realtime Carrier Shipping</label>
                <Toggle
                  on={shipping.shipping_realtime_enabled}
                  onToggle={() => setShipping((prev) => ({ ...prev, shipping_realtime_enabled: !prev.shipping_realtime_enabled }))}
                />
                <p className="text-xs text-gray-400 mt-1.5">Off = static rates. On = carrier quotes in checkout.</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Shipping Provider</label>
                <select
                  value={shipping.shipping_provider}
                  onChange={(e) => setShipping((prev) => ({ ...prev, shipping_provider: e.target.value as "shippo" | "easypost" }))}
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
                <input value={shippingStatesInput} onChange={(e) => setShippingStatesInput(e.target.value)} placeholder="TX, CA, NY" className={INPUT_CLASS} />
                <p className="text-xs text-gray-400 mt-1.5">Leave empty to allow all states.</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">City allowlist (CSV)</label>
                <input value={shippingCitiesInput} onChange={(e) => setShippingCitiesInput(e.target.value)} placeholder="Austin, Dallas" className={INPUT_CLASS} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Fallback to static when realtime unavailable</label>
              <Toggle
                on={shipping.shipping_realtime_fallback_static}
                onToggle={() => setShipping((prev) => ({ ...prev, shipping_realtime_fallback_static: !prev.shipping_realtime_fallback_static }))}
              />
            </div>
            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-900">Multi-parcel packing</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-4">Leave blank to use deployment defaults.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Max weight per parcel (lb)</label>
                  <input
                    type="number" min={0.1} step={0.5}
                    value={shipping.shipping_pack_max_weight_lbs ?? ""}
                    onChange={(e) => setShipping((prev) => ({ ...prev, shipping_pack_max_weight_lbs: e.target.value === "" ? null : Number(e.target.value) }))}
                    placeholder="e.g. 20" className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Max stacked height per parcel (in)</label>
                  <input
                    type="number" min={1} step={1}
                    value={shipping.shipping_pack_max_stack_height_in ?? ""}
                    onChange={(e) => setShipping((prev) => ({ ...prev, shipping_pack_max_stack_height_in: e.target.value === "" ? null : Number(e.target.value) }))}
                    placeholder="e.g. 36" className={INPUT_CLASS}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Settlement window (days)</label>
                <input type="number" min={1} max={30} value={settlementDays} onChange={(e) => setSettlementDays(Number(e.target.value))} className={INPUT_CLASS} />
                <p className="text-xs text-gray-400 mt-1.5 leading-snug">Funds held before nightly payout run.</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Min Payout Amount ($)</label>
                <input type="number" min={1} value={minPayoutDollars} onChange={(e) => setMinPayoutDollars(Number(e.target.value))} className={INPUT_CLASS} />
                <p className="text-xs text-gray-400 mt-1.5 leading-snug">Prevents micro-transfers.</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Max Payout Amount ($)</label>
                <input type="number" min={100} value={maxPayoutDollars} onChange={(e) => setMaxPayoutDollars(Number(e.target.value))} className={INPUT_CLASS} />
                <p className="text-xs text-gray-400 mt-1.5 leading-snug">Fraud protection — manual review above this.</p>
              </div>
            </div>
          </div>
        </details>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingPayment}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-[#0f0f10] hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {savingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Platform Settings
          </button>
        </div>
      </form>
    </div>
  )
}
