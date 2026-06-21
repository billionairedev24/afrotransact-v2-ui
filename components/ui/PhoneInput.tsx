"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AsYouType,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js"

/**
 * E.164-aware phone input.
 *
 *  - Internal value: free-form (formatted as the user types) via AsYouType.
 *  - External value (via onChange): E.164 string ("+15125551234") when valid,
 *    empty string otherwise. The empty-string normalization is intentional —
 *    submit handlers shouldn't have to special-case "partial but in progress"
 *    values, and an HTML `required` attribute will still flag empties.
 *
 * Country picker is intentionally short — covers the launch markets. Add to
 * COUNTRY_OPTIONS as we open new locales. Keeping the list narrow also keeps
 * the bundle smaller than dragging in flag-icon-css for a 250-country dropdown.
 */
const COUNTRY_OPTIONS: { value: CountryCode; label: string }[] = [
  { value: "US", label: "🇺🇸 United States" },
  { value: "CA", label: "🇨🇦 Canada" },
  { value: "GB", label: "🇬🇧 United Kingdom" },
  { value: "NG", label: "🇳🇬 Nigeria" },
  { value: "GH", label: "🇬🇭 Ghana" },
  { value: "KE", label: "🇰🇪 Kenya" },
  { value: "ZA", label: "🇿🇦 South Africa" },
  { value: "ET", label: "🇪🇹 Ethiopia" },
  { value: "EG", label: "🇪🇬 Egypt" },
  { value: "FR", label: "🇫🇷 France" },
  { value: "DE", label: "🇩🇪 Germany" },
]

const DEFAULT_COUNTRY: CountryCode = "US"

export interface PhoneInputProps {
  /** Current value as E.164 (e.g. "+15125551234"), or empty string. */
  value: string
  /** Receives E.164 when valid, empty string when invalid/partial. */
  onChange: (e164: string) => void
  defaultCountry?: CountryCode
  placeholder?: string
  required?: boolean
  disabled?: boolean
  id?: string
  name?: string
  className?: string
  ariaInvalid?: boolean
  ariaDescribedBy?: string
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry,
  placeholder,
  required,
  disabled,
  id,
  name,
  className = "",
  ariaInvalid,
  ariaDescribedBy,
}: PhoneInputProps) {
  // Country is derived from the E.164 value when present, else from
  // defaultCountry, else US. Keeping it in component state so the user can
  // change country before they finish typing.
  const initialCountry = useMemo<CountryCode>(() => {
    if (value) {
      const parsed = parsePhoneNumberFromString(value)
      if (parsed?.country) return parsed.country
    }
    return defaultCountry ?? DEFAULT_COUNTRY
  }, [value, defaultCountry])

  const [country, setCountry] = useState<CountryCode>(initialCountry)
  const [display, setDisplay] = useState<string>(() => {
    if (!value) return ""
    const parsed = parsePhoneNumberFromString(value)
    return parsed?.formatNational() ?? value
  })

  // Sync display when the parent resets the value (e.g. form clear).
  useEffect(() => {
    if (!value) {
      setDisplay("")
      return
    }
    const parsed = parsePhoneNumberFromString(value)
    if (parsed?.country && parsed.country !== country) {
      setCountry(parsed.country)
    }
    setDisplay(parsed?.formatNational() ?? value)
    // We intentionally exclude `country` from deps — country changes are
    // driven by user interaction, not by external value sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(raw: string) {
    const formatter = new AsYouType(country)
    const formatted = formatter.input(raw)
    setDisplay(formatted)
    const parsed = parsePhoneNumberFromString(formatted, country)
    onChange(parsed && parsed.isValid() ? parsed.number : "")
  }

  function handleCountry(next: CountryCode) {
    setCountry(next)
    // Re-parse the existing digits under the new country to keep E.164 truthful.
    if (display) {
      const formatter = new AsYouType(next)
      const formatted = formatter.input(display)
      setDisplay(formatted)
      const parsed = parsePhoneNumberFromString(formatted, next)
      onChange(parsed && parsed.isValid() ? parsed.number : "")
    }
  }

  const callingCode = (() => {
    try { return "+" + getCountryCallingCode(country) }
    catch { return "" }
  })()

  return (
    <div className={`flex gap-2 ${className}`}>
      <select
        aria-label="Country code"
        className="border border-border rounded px-2 py-2 bg-background text-sm shrink-0 w-[7rem] min-w-0"
        value={country}
        onChange={(e) => handleCountry(e.target.value as CountryCode)}
        disabled={disabled}
      >
        {COUNTRY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {/* Compact label: emoji flag + calling code only — full country
                name overflows in tight columns like the checkout address modal. */}
            {o.label.slice(0, 4)} {callingCodeFor(o.value)}
          </option>
        ))}
      </select>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        className="flex-1 border border-border rounded px-3 py-2 bg-background"
        value={display}
        placeholder={placeholder ?? callingCode + " 555 555 5555"}
        onChange={(e) => handleChange(e.target.value)}
        required={required}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
    </div>
  )
}

function callingCodeFor(c: CountryCode): string {
  try { return "+" + getCountryCallingCode(c) } catch { return "" }
}

/** Server-validation parity helper. Use the same library decision on the
 *  client so error messages line up with whatever the backend says. */
export function isValidE164(value: string): boolean {
  if (!value) return false
  return isValidPhoneNumber(value)
}
