"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  // True while a value change is this component's own doing, so the sync
  // effect below can ignore the echo.
  const selfEmitted = useRef(false)

  function emit(e164: string) {
    selfEmitted.current = true
    onChange(e164)
  }
  const [display, setDisplay] = useState<string>(() => {
    if (!value) return ""
    const parsed = parsePhoneNumberFromString(value)
    return parsed?.formatNational() ?? value
  })

  // Sync display when the parent genuinely changes the value from outside
  // (prefill, form clear) — NEVER when it is just echoing back what this
  // component itself emitted.
  //
  // That distinction matters: handleChange reports "" for any number that is
  // not yet valid, so backspacing one digit off a complete number pushes "" to
  // the parent, which lands back here as a changed `value`. Without this guard
  // the effect read that as a reset and wiped the entire field, so a single
  // backspace deleted the whole number.
  useEffect(() => {
    if (selfEmitted.current) {
      selfEmitted.current = false
      return
    }
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
    const prevDigits = display.replace(/\D/g, "")
    const nextDigits = raw.replace(/\D/g, "")
    let digits = nextDigits

    // Deleting a formatting character has to delete a digit.
    //
    // Backspacing "(543)" removes only the ")", leaving the digits unchanged.
    // Re-running the formatter puts the ")" straight back, so the field looks
    // frozen and the number can never be cleared. When the text got shorter but
    // the digits did not, drop a digit — that is what the person was reaching
    // for.
    if (raw.length < display.length && nextDigits === prevDigits) {
      digits = digits.slice(0, -1)
    }

    const formatted = digits ? new AsYouType(country).input(digits) : ""
    setDisplay(formatted)
    const parsed = parsePhoneNumberFromString(formatted, country)
    emit(parsed && parsed.isValid() ? parsed.number : "")
  }

  function handleCountry(next: CountryCode) {
    setCountry(next)
    // Re-parse the existing digits under the new country to keep E.164 truthful.
    if (display) {
      const formatter = new AsYouType(next)
      const formatted = formatter.input(display)
      setDisplay(formatted)
      const parsed = parsePhoneNumberFromString(formatted, next)
      emit(parsed && parsed.isValid() ? parsed.number : "")
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
        // min-w-0 lets the number field shrink below its intrinsic width.
        // Without it a flex item refuses to go narrower than its content, so in
        // any constrained container (a grid cell, a narrow column) this input
        // overflows and lands on top of whatever sits beside it.
        className="flex-1 min-w-0 border border-border rounded px-3 py-2 bg-background"
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

/**
 * Normalize a possibly-bare number to E.164, using `country` as the default
 * region. A legacy phone saved without a country ("5125551234") becomes
 * "+15125551234" under country "US" — i.e. we respect the address country as
 * the phone's country code. An already-E.164 value ("+44…") keeps its own
 * country. Returns "" when the number can't be parsed to a valid one.
 */
export function normalizeToE164(value: string, country: string = DEFAULT_COUNTRY): string {
  if (!value) return ""
  const parsed = parsePhoneNumberFromString(value.trim(), country as CountryCode)
  return parsed && parsed.isValid() ? parsed.number : ""
}
