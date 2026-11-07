"use client"

/**
 * The seller-lead fields, shared by the admin console and the lead's own
 * registration page.
 *
 * The two contexts differ in voice, not in data. An admin is recording someone
 * else ("What do they sell?"); the lead is describing themselves ("What do you
 * sell?"). Same fields, same validation, second person swapped — so copy never
 * drifts between the two surfaces, and a lead is never shown a form that talks
 * about them in the third person.
 */

import { useEffect, useRef, useState } from "react"
import { Loader2, Check } from "lucide-react"
import { PhoneInput, isValidE164 } from "@/components/ui/PhoneInput"
import type { CaptureLeadInput } from "@/lib/api"

export type LeadFieldsVoice = "admin" | "self"

export interface LeadFieldsValues extends CaptureLeadInput {
  categories?: string
}

export interface LeadFieldsProps {
  voice: LeadFieldsVoice
  initial?: Partial<LeadFieldsValues>
  /** Locked fields render read-only — the lead's email is fixed by the link. */
  lockedFields?: Array<keyof LeadFieldsValues>
  /** Fields beyond name and email that must be filled in. The lead's own page
   *  asks for everything; booth capture stays deliberately minimal, because a
   *  queue of people is the wrong moment to insist on a full record. */
  requiredFields?: Array<keyof LeadFieldsValues>
  onSubmit: (values: LeadFieldsValues & { website?: string }) => Promise<void>
  onEmailBlur?: (email: string) => void
  duplicateWarning?: string | null
  submitLabel: string
  /** Clear and refocus after a save — only sensible when capturing in a queue. */
  resetAfterSubmit?: boolean
  includeHoneypot?: boolean
}

/**
 * What a seller sells, as a short fixed list rather than the live catalog
 * taxonomy.
 *
 * The catalog has thirteen roots, several of them duplicates and most of them
 * grocery subcategories — accurate for merchandising, useless to someone
 * describing their own business at a stand. These five plus a fallback cover
 * what we actually need to route a lead, and "Services" and "Other" each ask
 * for a line of detail so the answer stays meaningful.
 */
const SELLS_OPTIONS = ["Groceries", "Fashion", "Books", "Electronics", "Services", "Other"] as const

/** Options whose answer is meaningless without a line of detail. */
const SELLS_NEEDS_DETAIL: Record<string, string> = {
  Services: "What kind of service?",
  Other: "What do you sell?",
}

const EMPTY: LeadFieldsValues = {
  firstName: "", lastName: "", email: "", phone: "",
  businessName: "", sells: "", categories: "", city: "", notes: "",
}

export function LeadFields({
  voice,
  initial,
  lockedFields = [],
  requiredFields = [],
  onSubmit,
  onEmailBlur,
  duplicateWarning,
  submitLabel,
  resetAfterSubmit = false,
  includeHoneypot = false,
}: LeadFieldsProps) {
  const [values, setValues] = useState<LeadFieldsValues>({ ...EMPTY, ...initial })
  const [sellsKind, setSellsKind] = useState<string>(initial?.categories?.trim() ?? "")
  const [honeypot, setHoneypot] = useState("")
  // PhoneInput reports "" for anything that is not a complete, valid number,
  // so without this an invalid entry is indistinguishable from an empty field
  // and the person is told to "enter a phone number" while staring at one.
  const [phoneTyped, setPhoneTyped] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initial) {
      setValues((v) => ({ ...v, ...initial }))
      if (initial.categories) setSellsKind(initial.categories.trim())
    }
  }, [initial])

  const isLocked = (k: keyof LeadFieldsValues) => lockedFields.includes(k)
  const isRequired = (k: keyof LeadFieldsValues) => requiredFields.includes(k)
  /** Renders "(optional)" only where a field genuinely is. */
  const optional = (k: keyof LeadFieldsValues) =>
    isRequired(k) ? null : <span className="font-normal text-muted-foreground">(optional)</span>
  const you = voice === "self"

  function set<K extends keyof LeadFieldsValues>(key: K, value: LeadFieldsValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: "" }))
  }

  function pickSellsKind(kind: string) {
    setSellsKind(kind)
    // The detail line belongs to the previous choice; keep it only while the
    // choice still asks for one.
    if (!SELLS_NEEDS_DETAIL[kind]) setValues((v) => ({ ...v, sells: "" }))
    setErrors((e) => ({ ...e, categories: "", sells: "" }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!values.firstName.trim()) next.firstName = "Enter a first name"
    if (!values.lastName.trim()) next.lastName = "Enter a last name"
    if (!values.email.trim()) next.email = "Enter an email address"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      next.email = "That email address doesn't look right"
    }
    // A half-typed number is worse than none: it looks captured and cannot be
    // called. isValidE164 only passes a complete number, so this covers both
    // "missing" and "half entered".
    if (!values.phone?.trim()) {
      if (phoneTyped) {
        // Digits are present but they are not a real number — a wrong area or
        // exchange code, or too few digits.
        next.phone = "That number doesn't look right. Check the digits and the country."
      } else if (isRequired("phone")) {
        next.phone = "Enter a phone number"
      }
    } else if (!isValidE164(values.phone)) {
      next.phone = "Enter a complete phone number, including the country code"
    }
    if (isRequired("city") && !values.city?.trim()) {
      next.city = "Enter a city"
    }
    if (isRequired("categories") && !sellsKind) {
      next.categories = you ? "Choose what you sell" : "Choose what they sell"
    }
    // "Services" or "Other" on its own tells us nothing — the detail line is
    // the actual answer, so it is required whenever one of those is chosen.
    if (SELLS_NEEDS_DETAIL[sellsKind] && !values.sells?.trim()) {
      next.sells = sellsKind === "Services"
        ? "Say what kind of service"
        : "Say what you sell"
    }
    if (isRequired("businessName") && !values.businessName?.trim()) {
      next.businessName = "Enter a business name"
    } else if (values.businessName && values.businessName.trim().length < 2) {
      next.businessName = "Enter the full business name"
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) {
      // Move the person to the first thing that needs fixing rather than
      // leaving them to hunt for red text on a phone.
      const firstError = document.querySelector<HTMLElement>("[data-field-error='true']")
      firstError?.scrollIntoView({ block: "center", behavior: "smooth" })
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        ...values,
        categories: sellsKind,
        website: includeHoneypot ? honeypot : undefined,
      })
      if (resetAfterSubmit) {
        setValues(EMPTY)
        setSellsKind("")
        setHoneypot("")
        firstFieldRef.current?.focus()
      }
    } catch {
      // Keep every value: the caller surfaces the error, and retyping a lead
      // you already took is the one unacceptable outcome.
    } finally {
      setSaving(false)
    }
  }

  const field =
    "h-12 w-full rounded-lg border bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
  const fieldOk = `${field} border-border focus:border-primary`
  const fieldBad = `${field} border-rose-400 focus:border-rose-500 focus:ring-rose-200`
  const label = "mb-1.5 block text-sm font-medium text-foreground"
  const lockedCls = "h-12 w-full rounded-lg border border-border bg-muted px-3 text-base text-muted-foreground"

  function Err({ name }: { name: string }) {
    if (!errors[name]) return null
    return (
      <p data-field-error="true" className="mt-1.5 text-sm text-rose-700">{errors[name]}</p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="lead-first" className={label}>First name</label>
          <input
            id="lead-first" ref={firstFieldRef} value={values.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            className={errors.firstName ? fieldBad : fieldOk}
            autoComplete="given-name" autoCapitalize="words"
            aria-invalid={!!errors.firstName}
          />
          <Err name="firstName" />
        </div>
        <div>
          <label htmlFor="lead-last" className={label}>Last name</label>
          <input
            id="lead-last" value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            className={errors.lastName ? fieldBad : fieldOk}
            autoComplete="family-name" autoCapitalize="words"
            aria-invalid={!!errors.lastName}
          />
          <Err name="lastName" />
        </div>
      </div>

      <div>
        <label htmlFor="lead-email" className={label}>Email</label>
        {isLocked("email") ? (
          <div className={lockedCls + " flex items-center"}>{values.email}</div>
        ) : (
          <input
            id="lead-email" type="email" inputMode="email" value={values.email}
            onChange={(e) => set("email", e.target.value)}
            onBlur={(e) => onEmailBlur?.(e.target.value)}
            className={errors.email ? fieldBad : fieldOk}
            autoComplete="email" autoCapitalize="none"
            aria-invalid={!!errors.email}
          />
        )}
        <Err name="email" />
        {duplicateWarning && !errors.email && (
          <p className="mt-1.5 text-sm text-amber-800">{duplicateWarning}</p>
        )}
      </div>

      {/* Sized to their content rather than split down the middle: a phone
          number and a city name are both short, and stretching them to half the
          card each made the row look empty. */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0">
          <label htmlFor="lead-phone" className={label}>
            Phone {optional("phone")}
          </label>
          {/* PhoneInput styles its own select/input, so match them to the rest
              of this form here rather than restyling a component used by
              checkout and seller onboarding too. */}
          <PhoneInput
            id="lead-phone"
            value={values.phone ?? ""}
            onChange={(e164, meta) => { set("phone", e164); setPhoneTyped(meta.hasInput) }}
            ariaInvalid={!!errors.phone}
            className="min-w-0 [&_select]:h-12 [&_select]:rounded-lg [&_input]:h-12 [&_input]:w-[10.5rem] [&_input]:rounded-lg [&_input]:text-base [&_input]:px-3"
          />
          <Err name="phone" />
        </div>
        <div className="min-w-0 flex-1 sm:max-w-[13rem]">
          <label htmlFor="lead-city" className={label}>
            City {optional("city")}
          </label>
          <input
            id="lead-city" value={values.city}
            onChange={(e) => set("city", e.target.value)}
            className={errors.city ? fieldBad : fieldOk}
            autoComplete="address-level2" autoCapitalize="words"
            aria-invalid={!!errors.city}
          />
          <Err name="city" />
        </div>
      </div>

      <div>
        <label htmlFor="lead-business" className={label}>
          Business name {optional("businessName")}
        </label>
        <input
          id="lead-business" value={values.businessName}
          onChange={(e) => set("businessName", e.target.value)}
          className={errors.businessName ? fieldBad : fieldOk}
          autoCapitalize="words" aria-invalid={!!errors.businessName}
          placeholder="Amara Foods"
        />
        <Err name="businessName" />
      </div>

      <div>
        <label htmlFor="lead-sells-kind" className={label}>
          {you ? "What do you sell?" : "What do they sell?"} {optional("categories")}
        </label>
        <select
          id="lead-sells-kind"
          value={sellsKind}
          onChange={(e) => pickSellsKind(e.target.value)}
          aria-invalid={!!errors.categories}
          className={`${errors.categories ? fieldBad : fieldOk} appearance-none bg-background pr-9`}
        >
          <option value="">Choose one…</option>
          {SELLS_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <Err name="categories" />
      </div>

      {SELLS_NEEDS_DETAIL[sellsKind] && (
        <div>
          <label htmlFor="lead-sells" className={label}>
            {SELLS_NEEDS_DETAIL[sellsKind]}
          </label>
          <input
            id="lead-sells"
            value={values.sells}
            onChange={(e) => set("sells", e.target.value)}
            className={errors.sells ? fieldBad : fieldOk}
            aria-invalid={!!errors.sells}
            placeholder={sellsKind === "Services" ? "Tailoring, catering, braiding" : "Handmade jewellery"}
          />
          <Err name="sells" />
        </div>
      )}

      {voice === "admin" && (
        <div>
          <label htmlFor="lead-notes" className={label}>
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="lead-notes" value={values.notes} rows={3}
            onChange={(e) => set("notes", e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="What you talked about"
          />
        </div>
      )}

      {includeHoneypot && (
        <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
          <label htmlFor="lead-website">Website</label>
          <input
            id="lead-website" tabIndex={-1} autoComplete="off"
            value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving && <Loader2 className="h-5 w-5 animate-spin" />}
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  )
}
