"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react"

import { getAccessToken } from "@/lib/auth-helpers"
import { friendlyMessage } from "@/lib/errors"
import {
  getOpenBusinessTypeChange,
  submitBusinessTypeChange,
  withdrawBusinessTypeChange,
  type BusinessTypeChangeRequestDto,
} from "@/lib/api"

// Forward-looking list. Today onboarding only ships `goods`, but the change-
// request flow exists precisely so sellers can move into newly-supported
// regulated categories once we accept them. Keep this list in sync with the
// onboarding step-1 select.
const BUSINESS_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "goods", label: "Goods (general)" },
  { value: "groceries", label: "Groceries" },
  { value: "food_prepared", label: "Prepared food" },
  { value: "alcohol", label: "Alcohol" },
  { value: "regulated_electronics", label: "Regulated electronics" },
  { value: "health_beauty", label: "Health & beauty" },
  { value: "fashion", label: "Fashion" },
  { value: "services", label: "Services" },
]

const ENTITY_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "individual", label: "Individual / sole proprietor" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "nonprofit", label: "Non-profit" },
]

export default function BusinessTypeChangePage() {
  const [open, setOpen] = useState<BusinessTypeChangeRequestDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newBusinessType, setNewBusinessType] = useState("")
  const [newEntityType, setNewEntityType] = useState("")
  const [justification, setJustification] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const token = await getAccessToken()
        if (!token) {
          if (!cancelled) setLoading(false)
          return
        }
        const r = await getOpenBusinessTypeChange(token)
        if (!cancelled) setOpen(r)
      } catch (e) {
        if (!cancelled) setError(friendlyMessage(e, "Failed to load request status"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (justification.trim().length < 20) {
      setError("Please explain why you're changing what you sell (at least 20 characters).")
      return
    }
    if (!newBusinessType) {
      setError("Pick a new business type.")
      return
    }
    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in.")
      const created = await submitBusinessTypeChange(token, {
        newBusinessType,
        newEntityType: newEntityType || undefined,
        justification: justification.trim(),
      })
      setOpen(created)
      setJustification("")
      setNewBusinessType("")
      setNewEntityType("")
    } catch (e) {
      setError(friendlyMessage(e, "Could not submit request."))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleWithdraw() {
    if (!open) return
    if (!confirm("Withdraw this request? You can resubmit afterwards.")) return
    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not signed in.")
      await withdrawBusinessTypeChange(token, open.id)
      setOpen(null)
    } catch (e) {
      setError(friendlyMessage(e, "Could not withdraw request."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link
          href="/dashboard/store"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Store Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Change what you sell</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The "What you sell" answer drives KYC, regulatory rules, and your
          Stripe Connect business profile. Changing it requires admin
          re-validation — submit a request below.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : open ? (
        <OpenRequestCard request={open} onWithdraw={handleWithdraw} submitting={submitting} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-md p-6">
          <div>
            <label className="block text-sm font-medium mb-1">New business type *</label>
            <select
              className="w-full border border-border rounded px-3 py-2 bg-background"
              value={newBusinessType}
              onChange={(e) => setNewBusinessType(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {BUSINESS_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              New entity type <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <select
              className="w-full border border-border rounded px-3 py-2 bg-background"
              value={newEntityType}
              onChange={(e) => setNewEntityType(e.target.value)}
            >
              <option value="">Keep current</option>
              {ENTITY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Pick this only if the new business type forces a different legal
              entity (e.g. moving into alcohol may require LLC).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Why are you changing? *
            </label>
            <textarea
              className="w-full border border-border rounded px-3 py-2 bg-background min-h-[120px]"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              minLength={20}
              maxLength={4000}
              required
              placeholder="Tell our review team what you're moving into and why."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Minimum 20 characters. {justification.length}/4000.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="bg-foreground text-background px-4 py-2 rounded font-medium disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit for review"}
            </button>
            <Link
              href="/dashboard/store"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </main>
  )
}

function OpenRequestCard({
  request,
  onWithdraw,
  submitting,
}: {
  request: BusinessTypeChangeRequestDto
  onWithdraw: () => void
  submitting: boolean
}) {
  const isPending = request.status === "pending"
  const needsInfo = request.status === "needs_more_info"
  return (
    <div className="bg-card border border-border rounded-md p-6 space-y-4">
      <div className="flex items-center gap-2">
        {needsInfo ? (
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        ) : isPending ? (
          <Clock className="h-5 w-5 text-blue-500" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        )}
        <h2 className="text-lg font-semibold">
          {needsInfo
            ? "We need more info"
            : isPending
              ? "Under review"
              : request.status.replace(/_/g, " ")}
        </h2>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">From</dt>
          <dd className="font-medium">{request.currentBusinessType}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">To</dt>
          <dd className="font-medium">{request.newBusinessType}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Your justification</dt>
          <dd className="font-medium whitespace-pre-wrap">{request.justification}</dd>
        </div>
        {needsInfo && request.infoRequest && (
          <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded p-3">
            <dt className="text-amber-800 font-medium">Admin needs the following:</dt>
            <dd className="text-amber-900 whitespace-pre-wrap mt-1">{request.infoRequest}</dd>
          </div>
        )}
      </dl>

      <div className="pt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onWithdraw}
          disabled={submitting}
          className="text-sm text-red-600 hover:underline disabled:opacity-50 inline-flex items-center gap-1"
        >
          <XCircle className="h-4 w-4" /> Withdraw request
        </button>
      </div>
    </div>
  )
}
