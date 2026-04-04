"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { toast } from "sonner"
import {
  Check,
  Edit2,
  Loader2,
  Plus,
  Save,
  Settings,
  X,
  AlertCircle,
} from "lucide-react"
import {
  getAdminPlans,
  getBillingConfig,
  createAdminPlan,
  updateAdminPlan,
  updateBillingConfig,
  type SubscriptionPlan,
} from "@/lib/api"

const CONFIG_DESCRIPTIONS: Record<string, string> = {
  trial_period_days: "Days for the initial free trial (Month 1)",
  trial_extension_days: "Extra free days when seller qualifies for Month 2",
  min_products_for_trial_extension: "Minimum active products required to earn Month 2 free",
  grace_period_days: "Days after failed payment before subscription is suspended",
  payment_retry_attempts: "Number of automatic payment retry attempts",
  payment_retry_interval_hours: "Hours between payment retry attempts",
}

type PlanFormData = {
  name: string
  slug: string
  description: string
  priceCentsPerMonth: number
  billingInterval: string
  billingCount: number
  maxProducts: number
  maxStores: number
  commissionRateOverride: string
  stripePriceId: string
  active: boolean
  displayOrder: number
  features: string
}

function planToFormData(plan?: SubscriptionPlan | null): PlanFormData {
  if (!plan) {
    return {
      name: "",
      slug: "",
      description: "",
      priceCentsPerMonth: 0,
      billingInterval: "month",
      billingCount: 1,
      maxProducts: 50,
      maxStores: 1,
      commissionRateOverride: "",
      stripePriceId: "",
      active: true,
      displayOrder: 0,
      features: "",
    }
  }
  return {
    name: plan.name,
    slug: plan.slug,
    description: plan.description ?? "",
    priceCentsPerMonth: plan.priceCentsPerMonth,
    billingInterval: plan.billingInterval || "month",
    billingCount: plan.billingCount || 1,
    maxProducts: plan.maxProducts,
    maxStores: plan.maxStores,
    commissionRateOverride: plan.commissionRateOverride != null ? String(plan.commissionRateOverride) : "",
    stripePriceId: plan.stripePriceId ?? "",
    active: plan.active,
    displayOrder: plan.displayOrder,
    features: (plan.features ?? []).join("\n"),
  }
}

function formDataToApiPayload(form: PlanFormData): Partial<SubscriptionPlan> {
  return {
    name: form.name,
    slug: form.slug,
    description: form.description || null,
    priceCentsPerMonth: form.priceCentsPerMonth,
    billingInterval: form.billingInterval,
    billingCount: form.billingCount,
    maxProducts: form.maxProducts,
    maxStores: form.maxStores,
    commissionRateOverride: form.commissionRateOverride ? Number(form.commissionRateOverride) : null,
    stripePriceId: form.stripePriceId || null,
    active: form.active,
    displayOrder: form.displayOrder,
    features: form.features
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  }
}

function formatPlanPrice(cents: number, interval: string, count: number) {
  const unit = interval === "year" ? "yr" : interval === "month" ? "mo" : interval === "week" ? "wk" : "day"
  const suffix = count === 1 ? unit : `${count} ${unit}s`
  return `$${(cents / 100).toFixed(2)}/${suffix}`
}

function PlanCard({
  plan,
  onEdit,
}: {
  plan: SubscriptionPlan
  onEdit: (plan: SubscriptionPlan) => void
}) {
  const commission = plan.commissionRateOverride ?? 10
  return (
    <div
      className={`flex flex-col justify-between gap-4 rounded-xl border bg-white p-4 transition-all sm:flex-row sm:items-center ${
        plan.active
          ? "border-gray-200 shadow-sm"
          : "border-gray-100 bg-gray-50/80 opacity-80"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
          {!plan.active && (
            <span className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
              Inactive
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-600">
          {plan.priceDisplay || formatPlanPrice(plan.priceCentsPerMonth, plan.billingInterval, plan.billingCount)} · {plan.maxProducts === -1 ? "∞" : plan.maxProducts} products ·{" "}
          {plan.maxStores} store{plan.maxStores > 1 ? "s" : ""} · {commission}% commission
        </p>
        {plan.features?.length ? (
          <ul className="mt-1.5 space-y-0.5 text-xs text-gray-500">
            {plan.features.slice(0, 3).map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onEdit(plan)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          <Edit2 className="h-3 w-3" />
          Edit
        </button>
      </div>
    </div>
  )
}

function PlanModal({
  plan,
  mode,
  onClose,
  onSave,
  saving,
  error,
}: {
  plan: SubscriptionPlan | null
  mode: "create" | "edit"
  onClose: () => void
  onSave: (data: PlanFormData) => void
  saving: boolean
  error: string | null
}) {
  const [form, setForm] = useState<PlanFormData>(() => planToFormData(plan))

  useEffect(() => {
    setForm(planToFormData(plan))
  }, [plan])

  const update = (key: keyof PlanFormData, value: PlanFormData[keyof PlanFormData]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (key === "name" && mode === "create") {
      setForm((f) => ({
        ...f,
        slug: String(value)
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, ""),
      }))
    }
  }

  const field = (
    label: string,
    key: keyof PlanFormData,
    type: "text" | "number" = "text",
    placeholder?: string
  ) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {key === "features" ? (
        <textarea
          value={form.features}
          onChange={(e) => update("features", e.target.value)}
          rows={4}
          placeholder="One feature per line"
          className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
        />
      ) : key === "billingInterval" ? (
        <select
          value={form.billingInterval}
          onChange={(e) => update("billingInterval", e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
        >
          <option value="month">Monthly</option>
          <option value="year">Yearly</option>
          <option value="week">Weekly</option>
          <option value="day">Daily</option>
        </select>
      ) : key === "active" ? (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => update("active", e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary/30"
          />
          <span className="text-sm text-gray-700">Active</span>
        </label>
      ) : (
        <input
          type={type}
          value={String(form[key])}
          onChange={(e) =>
            update(
              key,
              type === "number" ? Number(e.target.value) || 0 : e.target.value
            )
          }
          placeholder={placeholder}
          disabled={key === "slug" && mode === "edit"}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative max-h-[min(90vh,100dvh)] w-full max-w-lg min-h-0 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="min-w-0 text-lg font-bold text-gray-900">
            {mode === "create" ? "Create Plan" : `Edit Plan — ${plan?.name}`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="shrink-0 rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("Plan Name", "name")}
          {field("Slug", "slug", "text", "e.g. starter")}
          {field("Description", "description", "text", "Optional")}
          {field("Billing Interval", "billingInterval")}
          {field("Billing Count", "billingCount", "number")}
          {field("Total Price (cents)", "priceCentsPerMonth", "number")}
          {field("Max Products (-1 = unlimited)", "maxProducts", "number")}
          {field("Max Stores", "maxStores", "number")}
          {field("Commission Override (%)", "commissionRateOverride", "text", "Leave empty for default")}
          {field("Stripe Price ID", "stripePriceId", "text", "Optional")}
          {field("Display Order", "displayOrder", "number")}
        </div>
        {field("Features", "features")}
        <div className="pt-2">
          {field("Active", "active")}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-header transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {mode === "create" ? "Create Plan" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminSubscriptionPage() {
  const { status } = useSession()

  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [billingConfig, setBillingConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, _setSuccess] = useState<string | null>(null)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configSuccess, setConfigSuccess] = useState(false)

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchData() {
      const token = await getAccessToken()
      if (!token) return
      try {
        setError(null)
        setLoading(true)
        const [plansRes, configRes] = await Promise.all([
          getAdminPlans(token),
          getBillingConfig(token),
        ])
        if (cancelled) return
        setPlans(plansRes)
        setBillingConfig(configRes ?? {})
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load subscription data")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [status])

  const handleCreatePlan = async (form: PlanFormData) => {
    const token = await getAccessToken()
    if (!token) return
    setPlanError(null)
    setSavingPlan(true)
    try {
      const created = await createAdminPlan(token, formDataToApiPayload(form))
      setPlans((prev) => [...prev, created])
      setCreateModalOpen(false)
      toast.success("Plan created successfully")
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Failed to create plan")
    } finally {
      setSavingPlan(false)
    }
  }

  const handleUpdatePlan = async (form: PlanFormData) => {
    const token = await getAccessToken()
    if (!token || !editingPlan) return
    setPlanError(null)
    setSavingPlan(true)
    try {
      const updated = await updateAdminPlan(
        token,
        editingPlan.id,
        formDataToApiPayload(form)
      )
      setPlans((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      )
      setEditingPlan(null)
      toast.success("Plan updated successfully")
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Failed to update plan")
    } finally {
      setSavingPlan(false)
    }
  }

  const handleSaveConfig = async () => {
    const token = await getAccessToken()
    if (!token) return
    setSavingConfig(true)
    setConfigSuccess(false)
    try {
      for (const [key, value] of Object.entries(billingConfig)) {
        await updateBillingConfig(token, key, value)
      }
      setConfigSuccess(true)
      setTimeout(() => setConfigSuccess(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save billing config")
    } finally {
      setSavingConfig(false)
    }
  }

  const sortedPlans = [...plans].sort((a, b) => a.displayOrder - b.displayOrder)

  return (
    <div className="min-w-0 space-y-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">Subscription Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage subscription plans and billing configuration
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <Check className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-800">{success}</p>
        </div>
      )}

      {/* Plans */}
      <section>
        <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-gray-900">Subscription Plans</h2>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            disabled={status !== "authenticated" || loading}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-header transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New Plan
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : sortedPlans.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">No plans yet. Create your first plan to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} onEdit={setEditingPlan} />
            ))}
          </div>
        )}
      </section>

      {/* Billing Config */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Settings className="h-4 w-4 text-primary" />
            Billing Configuration
          </h2>
        </div>
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : Object.keys(billingConfig).length === 0 ? (
            <p className="py-4 text-sm text-gray-500">No billing configuration available.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Object.entries(billingConfig).map(([key, value]) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </label>
                    {CONFIG_DESCRIPTIONS[key] && (
                      <p className="mb-1.5 text-[11px] text-gray-500">
                        {CONFIG_DESCRIPTIONS[key]}
                      </p>
                    )}
                    <input
                      type="text"
                      value={value}
                      onChange={(e) =>
                        setBillingConfig((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                {configSuccess && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-700">
                    <Check className="h-4 w-4" />
                    Configuration saved
                  </span>
                )}
                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={savingConfig || status !== "authenticated"}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-header transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {savingConfig ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Config
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Changes to billing configuration take effect at the next scheduled billing cycle run (daily
          at 06:00 UTC).
        </p>
      </section>

      {/* Create Plan Modal */}
      {createModalOpen && (
        <PlanModal
          plan={null}
          mode="create"
          onClose={() => {
            setCreateModalOpen(false)
            setPlanError(null)
          }}
          onSave={handleCreatePlan}
          saving={savingPlan}
          error={planError}
        />
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <PlanModal
          plan={editingPlan}
          mode="edit"
          onClose={() => {
            setEditingPlan(null)
            setPlanError(null)
          }}
          onSave={handleUpdatePlan}
          saving={savingPlan}
          error={planError}
        />
      )}
    </div>
  )
}
