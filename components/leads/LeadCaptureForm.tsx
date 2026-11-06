"use client"

/**
 * Booth capture form, shared by the admin page and the public link page.
 *
 * Designed for one situation: standing at a conference stand with a phone in
 * one hand and roughly twenty seconds of someone's attention. That drives every
 * choice here —
 *   - inputs are 16px so iOS never zooms on focus (a zoomed form costs a tap to
 *     escape, and the next person is already waiting)
 *   - controls are 48px tall, comfortably thumb-sized
 *   - the submit button sits at the bottom of the flow, where a thumb rests
 *   - on success the form clears and focus returns to First name, so the next
 *     capture starts immediately with no navigation
 *   - on failure nothing is cleared: conference wifi drops constantly and
 *     retyping a lead you already took is the one unacceptable outcome
 */

import { useRef, useState } from "react"
import { Loader2, Check } from "lucide-react"
import type { CaptureLeadInput } from "@/lib/api"

export interface LeadCaptureFormProps {
  onSubmit: (data: CaptureLeadInput & { website?: string }) => Promise<void>
  /** Called when the email loses focus, so the caller can warn about duplicates. */
  onEmailBlur?: (email: string) => void
  duplicateWarning?: string | null
  submitLabel?: string
  /** Public page renders the bot honeypot; the admin page has no need for it. */
  includeHoneypot?: boolean
}

const EMPTY: CaptureLeadInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  businessName: "",
  sells: "",
  city: "",
  notes: "",
}

export function LeadCaptureForm({
  onSubmit,
  onEmailBlur,
  duplicateWarning,
  submitLabel = "Save lead",
  includeHoneypot = false,
}: LeadCaptureFormProps) {
  const [values, setValues] = useState<CaptureLeadInput>(EMPTY)
  const [honeypot, setHoneypot] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof CaptureLeadInput>(key: K, value: CaptureLeadInput[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: "" }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!values.firstName.trim()) next.firstName = "First name is required"
    if (!values.lastName.trim()) next.lastName = "Last name is required"
    if (!values.email.trim()) next.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = "Enter a valid email address"
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await onSubmit({ ...values, website: includeHoneypot ? honeypot : undefined })
      // Success: wipe and hand focus back for the next person in the queue.
      setValues(EMPTY)
      setHoneypot("")
      firstFieldRef.current?.focus()
    } catch {
      // Deliberately keep every value — the caller surfaces the error.
    } finally {
      setSaving(false)
    }
  }

  const field =
    "h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/15"
  const label = "mb-1.5 block text-sm font-medium text-foreground"
  const errorText = "mt-1 text-sm text-rose-700"

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="lead-first" className={label}>First name</label>
          <input
            id="lead-first"
            ref={firstFieldRef}
            value={values.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            className={field}
            autoComplete="given-name"
            autoCapitalize="words"
            aria-invalid={!!errors.firstName}
          />
          {errors.firstName && <p className={errorText}>{errors.firstName}</p>}
        </div>
        <div>
          <label htmlFor="lead-last" className={label}>Last name</label>
          <input
            id="lead-last"
            value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            className={field}
            autoComplete="family-name"
            autoCapitalize="words"
            aria-invalid={!!errors.lastName}
          />
          {errors.lastName && <p className={errorText}>{errors.lastName}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="lead-email" className={label}>Email</label>
        <input
          id="lead-email"
          type="email"
          inputMode="email"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          onBlur={(e) => onEmailBlur?.(e.target.value)}
          className={field}
          autoComplete="email"
          autoCapitalize="none"
          aria-invalid={!!errors.email}
        />
        {errors.email && <p className={errorText}>{errors.email}</p>}
        {duplicateWarning && !errors.email && (
          <p className="mt-1 text-sm text-amber-800">{duplicateWarning}</p>
        )}
      </div>

      <div>
        <label htmlFor="lead-phone" className={label}>Phone</label>
        <input
          id="lead-phone"
          type="tel"
          inputMode="tel"
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
          className={field}
          autoComplete="tel"
        />
      </div>

      <div>
        <label htmlFor="lead-business" className={label}>Business name</label>
        <input
          id="lead-business"
          value={values.businessName}
          onChange={(e) => set("businessName", e.target.value)}
          className={field}
          autoCapitalize="words"
        />
      </div>

      <div>
        <label htmlFor="lead-sells" className={label}>What they sell</label>
        <input
          id="lead-sells"
          value={values.sells}
          onChange={(e) => set("sells", e.target.value)}
          className={field}
          placeholder="Jollof spice blends, dried fish"
        />
      </div>

      <div>
        <label htmlFor="lead-city" className={label}>City</label>
        <input
          id="lead-city"
          value={values.city}
          onChange={(e) => set("city", e.target.value)}
          className={field}
          autoComplete="address-level2"
          autoCapitalize="words"
        />
      </div>

      <div>
        <label htmlFor="lead-notes" className={label}>Notes</label>
        <textarea
          id="lead-notes"
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/15"
          placeholder="What you talked about"
        />
      </div>

      {includeHoneypot && (
        // Off-screen rather than display:none — some bots skip hidden inputs.
        <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
          <label htmlFor="lead-website">Website</label>
          <input
            id="lead-website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-base font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  )
}
