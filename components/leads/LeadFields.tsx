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

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Check } from "lucide-react"
import { PhoneInput, isValidE164 } from "@/components/ui/PhoneInput"
import { getCategories, type CategoryRef, type CaptureLeadInput } from "@/lib/api"

export type LeadFieldsVoice = "admin" | "self"

export interface LeadFieldsValues extends CaptureLeadInput {
  categories?: string
}

export interface LeadFieldsProps {
  voice: LeadFieldsVoice
  initial?: Partial<LeadFieldsValues>
  /** Locked fields render read-only — the lead's email is fixed by the link. */
  lockedFields?: Array<keyof LeadFieldsValues>
  onSubmit: (values: LeadFieldsValues & { website?: string }) => Promise<void>
  onEmailBlur?: (email: string) => void
  duplicateWarning?: string | null
  submitLabel: string
  /** Clear and refocus after a save — only sensible when capturing in a queue. */
  resetAfterSubmit?: boolean
  includeHoneypot?: boolean
}

const EMPTY: LeadFieldsValues = {
  firstName: "", lastName: "", email: "", phone: "",
  businessName: "", sells: "", categories: "", city: "", notes: "",
}

export function LeadFields({
  voice,
  initial,
  lockedFields = [],
  onSubmit,
  onEmailBlur,
  duplicateWarning,
  submitLabel,
  resetAfterSubmit = false,
  includeHoneypot = false,
}: LeadFieldsProps) {
  const [values, setValues] = useState<LeadFieldsValues>({ ...EMPTY, ...initial })
  const [picked, setPicked] = useState<string[]>(
    initial?.categories ? initial.categories.split(",").map((c) => c.trim()).filter(Boolean) : [],
  )
  const [honeypot, setHoneypot] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Categories are a nicety: if the catalog call fails the rest of the form
    // still works, and the free-text line still captures what they sell.
    getCategories({ revalidate: 3600 }).then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (initial) setValues((v) => ({ ...v, ...initial }))
  }, [initial])

  const isLocked = (k: keyof LeadFieldsValues) => lockedFields.includes(k)
  const you = voice === "self"

  function set<K extends keyof LeadFieldsValues>(key: K, value: LeadFieldsValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: "" }))
  }

  function toggleCategory(name: string) {
    setPicked((cur) =>
      cur.includes(name) ? cur.filter((c) => c !== name) : [...cur, name],
    )
    if (errors.categories) setErrors((e) => ({ ...e, categories: "" }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!values.firstName.trim()) next.firstName = "Enter a first name"
    if (!values.lastName.trim()) next.lastName = "Enter a last name"
    if (!values.email.trim()) next.email = "Enter an email address"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      next.email = "That email address doesn't look right"
    }
    // Phone is optional, but a half-typed number is worse than none: it looks
    // captured and cannot be called.
    if (values.phone && !isValidE164(values.phone)) {
      next.phone = "Enter a complete phone number, including the country code"
    }
    if (values.businessName && values.businessName.trim().length < 2) {
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
        categories: picked.join(", "),
        website: includeHoneypot ? honeypot : undefined,
      })
      if (resetAfterSubmit) {
        setValues(EMPTY)
        setPicked([])
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

  const topLevel = useMemo(
    () => categories.filter((c) => !c.parentId).slice(0, 14),
    [categories],
  )

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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lead-phone" className={label}>
            Phone <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <PhoneInput
            id="lead-phone"
            value={values.phone ?? ""}
            onChange={(e164) => set("phone", e164)}
            ariaInvalid={!!errors.phone}
          />
          <Err name="phone" />
        </div>
        <div>
          <label htmlFor="lead-city" className={label}>
            City <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="lead-city" value={values.city}
            onChange={(e) => set("city", e.target.value)}
            className={fieldOk}
            autoComplete="address-level2" autoCapitalize="words"
          />
        </div>
      </div>

      <div>
        <label htmlFor="lead-business" className={label}>
          Business name <span className="font-normal text-muted-foreground">(optional)</span>
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

      {topLevel.length > 0 && (
        <fieldset>
          <legend className={label}>
            {you ? "What do you sell?" : "What do they sell?"}
          </legend>
          <div className="flex flex-wrap gap-2">
            {topLevel.map((c) => {
              const on = picked.includes(c.name)
              return (
                <button
                  key={c.id} type="button"
                  onClick={() => toggleCategory(c.name)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                  {c.name}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor="lead-sells" className={label}>
          {you ? "Anything else you sell" : "Anything else they sell"}{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="lead-sells" value={values.sells}
          onChange={(e) => set("sells", e.target.value)}
          className={fieldOk}
          placeholder="Jollof spice blends, dried fish"
        />
      </div>

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
