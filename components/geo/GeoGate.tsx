"use client"

/**
 * GeoGate wraps the buyer-facing storefront and reacts to the buyer's
 * resolved service zone:
 *
 *  - enabled     → renders children unchanged.
 *  - coming_soon → sticky yellow banner + waitlist modal; children still render
 *                  (browse OK) but cart/checkout self-block via useCartEligibility.
 *  - disabled    → full-page "not available yet" panel with waitlist + change-
 *  not_serviced    location link. Children are replaced entirely.
 *  - unresolved  → pass children through (default-allow during loading; don't
 *                  flash the gate before resolution).
 *
 * Country / subdivision display names come from `country-state-city`, which
 * is already a dependency.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Country, State } from "country-state-city"
import { useBuyerLocation } from "@/stores/buyer-location"
import { joinWaitlist } from "@/lib/waitlist"
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog"

type GateStatus = "enabled" | "coming_soon" | "disabled" | "not_serviced"

function displayName(countryCode: string | undefined, subdivisionCode: string | null | undefined): string {
  if (!countryCode) return "your region"
  const country = Country.getCountryByCode(countryCode)
  const cName = country?.name ?? countryCode
  if (subdivisionCode) {
    const state = State.getStateByCodeAndCountry(subdivisionCode, countryCode)
    if (state?.name) return `${state.name}, ${cName}`
  }
  return cName
}

interface WaitlistFormProps {
  countryCode: string
  subdivisionCode?: string | null
  countryLabel: string
  onDone?: () => void
}

function WaitlistForm({ countryCode, subdivisionCode, countryLabel, onDone }: WaitlistFormProps) {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ existing: boolean } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const res = await joinWaitlist({ email, countryCode, subdivisionCode })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setDone({ existing: res.existing })
    onDone?.()
  }

  if (done) {
    return (
      <p className="text-sm text-gray-700">
        {done.existing
          ? `You're already on the list for ${countryLabel}. We'll email you when we go live.`
          : `Thanks — we'll email you when we go live in ${countryLabel}.`}
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="text-sm font-medium text-gray-800" htmlFor="waitlist-email">
        Your email
      </label>
      <input
        id="waitlist-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary/60"
        placeholder="you@example.com"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={busy || !email}
        className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Join the waitlist"}
      </button>
    </form>
  )
}

export function GeoGate({ children }: { children: ReactNode }) {
  const resolvedZone = useBuyerLocation((s) => s.resolvedZone)
  const location = useBuyerLocation((s) => s.location)
  const refreshResolvedZone = useBuyerLocation((s) => s.refreshResolvedZone)
  const [modalOpen, setModalOpen] = useState(false)

  // Re-resolve the buyer's zone on mount so admin-side status flips
  // (enable → disable) propagate without requiring the buyer to clear
  // localStorage or re-pick their location.
  useEffect(() => {
    void refreshResolvedZone()
  }, [refreshResolvedZone])

  const status: GateStatus | null = useMemo(() => {
    if (!resolvedZone) return null
    const s = resolvedZone.status
    if (s === "enabled" || s === "coming_soon" || s === "disabled" || s === "not_serviced") {
      return s
    }
    return null
  }, [resolvedZone])

  // Pull the country/state code from the resolved zone first (most accurate),
  // falling back to what the buyer typed into the location picker.
  const countryCode = resolvedZone?.zone?.countryCode || location?.country || ""
  const subdivisionCode = resolvedZone?.zone?.subdivisionCode || location?.state || null
  const label = displayName(countryCode, subdivisionCode)

  // Default-allow during loading or for enabled zones.
  if (!status || status === "enabled") {
    return <>{children}</>
  }

  if (status === "coming_soon") {
    return (
      <>
        <div className="sticky top-0 z-30 w-full bg-yellow-100 text-yellow-900 border-b border-yellow-300">
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-4 px-4 py-2 text-sm">
            <span>
              AfroTransact is launching soon in <strong>{label}</strong>.
            </span>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="font-semibold underline underline-offset-2 hover:text-yellow-950"
            >
              Join the waitlist
            </button>
          </div>
        </div>
        {children}
        <Dialog open={modalOpen} onClose={() => setModalOpen(false)} className="max-w-md w-full">
          <DialogHeader onClose={() => setModalOpen(false)}>Join the {label} waitlist</DialogHeader>
          <DialogBody>
            <p className="mb-4 text-sm text-gray-700">
              We&apos;ll email you the moment AfroTransact goes live in {label}.
            </p>
            <WaitlistForm
              countryCode={countryCode}
              subdivisionCode={subdivisionCode}
              countryLabel={label}
            />
          </DialogBody>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-input bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Close
            </button>
          </DialogFooter>
        </Dialog>
      </>
    )
  }

  return <DisabledZonePanel countryCode={countryCode} subdivisionCode={subdivisionCode} label={label} />
}

function DisabledZonePanel({
  countryCode,
  subdivisionCode,
  label,
}: {
  countryCode: string
  subdivisionCode: string | null
  label: string
}) {
  const [submitted, setSubmitted] = useState(false)
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full rounded-2xl border border-input bg-white p-8 shadow-sm text-center">
        {!submitted ? (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              AfroTransact is not yet available in {label}.
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              Drop your email and we&apos;ll let you know the moment we launch in your area.
            </p>
            <WaitlistForm
              countryCode={countryCode}
              subdivisionCode={subdivisionCode}
              countryLabel={label}
              onDone={() => setSubmitted(true)}
            />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              You&apos;re on the list.
            </h1>
            <p className="text-sm text-gray-600">
              We&apos;ll email you the moment AfroTransact goes live in {label}.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
