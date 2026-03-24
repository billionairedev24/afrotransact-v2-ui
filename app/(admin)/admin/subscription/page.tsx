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
  createPlan,
  updatePlan,
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
    maxProducts: plan.maxProducts,
    maxStores: plan.maxStores,
    commissionRateOverride: plan.commissionRateOverride != null ? String(plan.commissionRateOverride) : "",
    stripePriceId: plan.stripePriceId ?? "",
    active: plan.active,
    displayOrder: plan.displayOrder,
    features: (plan.features ?? []).join("\n"),
  }
}

function formDataToApiPayload(form: PlanFormData): Record<string, unknown> {
  return {
    name: form.name,
    slug: form.slug,
    description: form.description || null,
    priceCentsPerMonth: form.priceCentsPerMonth,
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
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
        plan.active ? "border-white/10 bg-white/5" : "border-white/5 bg-white/2 opacity-60"
      }`}
      style={{ background: "hsl(0 0% 11%)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">{plan.name}</span>
          {!plan.active && (
            <span className="text-[10px] text-gray-500 bg-gray-500/10 border border-gray-500/20 rounded px-1.5 py-0.5">
              Inactive
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {plan.priceDisplay}/mo · {plan.maxProducts === -1 ? "∞" : plan.maxProducts} products ·{" "}
          {plan.maxStores} store{plan.maxStores > 1 ? "s" : ""} · {commission}% commission
        </p>
        {plan.features?.length ? (
          <ul className="text-xs text-gray-500 mt-1.5 space-y-0.5">
            {plan.features.slice(0, 3).map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onEdit(plan)}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
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
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {key === "features" ? (
        <textarea
          value={form.features}
          onChange={(e) => update("features", e.target.value)}
          rows={4}
          placeholder="One feature per line"
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors resize-none"
        />
      ) : key === "active" ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => update("active", e.target.checked)}
            className="rounded border-white/20"
          />
          <span className="text-sm text-gray-300">Active</span>
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
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-primary/60 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        />
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative rounded-2xl border border-white/15 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4"
        style={{ background: "hsl(0 0% 11%)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            {mode === "create" ? "Create Plan" : `Edit Plan — ${plan?.name}`}
          </h3>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/30 p-3 bg-red-500/5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {field("Plan Name", "name")}
          {field("Slug", "slug", "text", "e.g. starter")}
          {field("Description", "description", "text", "Optional")}
          {field("Price (cents/month)", "priceCentsPerMonth", "number")}
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
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-header hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
      const created = await createPlan(token, formDataToApiPayload(form))
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
      const updated = await updatePlan(
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscription Management</h1>
        <p className="text-gray-400 text-sm mt-1">
          Manage subscription plans and billing configuration
        </p>
      </div>

      {error && (
        <div
          className="flex items-center gap-3 rounded-2xl border border-red-500/30 p-4"
          style={{ background: "hsl(0 0% 11%)" }}
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div
          className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 p-4"
          style={{ background: "hsl(0 0% 11%)" }}
        >
          <Check className="h-5 w-5 shrink-0 text-emerald-400" />
          <p className="text-sm text-emerald-300">{success}</p>
        </div>
      )}

      {/* Plans */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Subscription Plans</h2>
          <button
            onClick={() => setCreateModalOpen(true)}
            disabled={status !== "authenticated" || loading}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-header hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div
            className="rounded-2xl border border-white/10 p-8 text-center"
            style={{ background: "hsl(0 0% 11%)" }}
          >
            <p className="text-gray-400 text-sm">No plans yet. Create your first plan to get started.</p>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Billing Configuration
          </h2>
        </div>
        <div
          className="rounded-2xl border border-white/10 p-5 space-y-4"
          style={{ background: "hsl(0 0% 11%)" }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : Object.keys(billingConfig).length === 0 ? (
            <p className="text-gray-500 text-sm py-4">No billing configuration available.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(billingConfig).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-400 mb-1">
                      {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </label>
                    {CONFIG_DESCRIPTIONS[key] && (
                      <p className="text-[11px] text-gray-600 mb-1.5">
                        {CONFIG_DESCRIPTIONS[key]}
                      </p>
                    )}
                    <input
                      type="text"
                      value={value}
                      onChange={(e) =>
                        setBillingConfig((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-primary/60 transition-colors"
                    />
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                {configSuccess && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                    <Check className="h-4 w-4" />
                    Configuration saved
                  </span>
                )}
                <div className="ml-auto">
                  <button
                    onClick={handleSaveConfig}
                    disabled={savingConfig || status !== "authenticated"}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-header hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
        <p className="text-xs text-gray-600 mt-2">
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
