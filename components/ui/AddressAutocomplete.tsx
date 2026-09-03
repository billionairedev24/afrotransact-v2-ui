"use client"

import { useState, useRef, useEffect } from "react"
import { MapPin } from "lucide-react"
import { friendlyMessage } from "@/lib/errors"

// `google` namespace comes from @types/google.maps, surfaced via the
// `types: ["google.maps"]` entry in tsconfig.json so all *.tsx files can
// reference `google.maps.*` without further imports.
declare global {
  interface Window {
    google: typeof google
    __afroGmapsReady?: () => void
  }
}

interface AddressParts {
  line1: string
  line2: string
  city: string
  state: string
  zip: string
  country: string
  lat: number | null
  lng: number | null
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (parts: AddressParts) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

// Single in-flight promise for the Places library across every instance of
// this component. Uses the async loader pattern: load the Maps JS core with
// `loading=async` (no `libraries=` param → no "loaded without loading=async"
// warning), then pull the Places library on demand via importLibrary. That
// also gives us PlaceAutocompleteElement, the supported replacement for the
// deprecated google.maps.places.Autocomplete.
let placesPromise: Promise<google.maps.PlacesLibrary> | null = null

function loadPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  if (placesPromise) return placesPromise
  placesPromise = (async () => {
    if (!GOOGLE_MAPS_API_KEY) throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set")
    if (!window.google?.maps?.importLibrary) {
      await new Promise<void>((resolve, reject) => {
        window.__afroGmapsReady = () => resolve()
        const script = document.createElement("script")
        script.src =
          `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}` +
          `&loading=async&callback=__afroGmapsReady`
        script.async = true
        script.onerror = () => reject(new Error("Failed to load Google Maps script"))
        document.head.appendChild(script)
      })
    }
    return (await window.google.maps.importLibrary("places")) as google.maps.PlacesLibrary
  })()
  return placesPromise
}

function extractAddressParts(place: google.maps.places.Place): AddressParts {
  const parts: AddressParts = {
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    lat: place.location?.lat() ?? null,
    lng: place.location?.lng() ?? null,
  }

  let streetNumber = ""
  let route = ""

  for (const component of place.addressComponents ?? []) {
    const types = component.types
    const long = component.longText ?? ""
    const short = component.shortText ?? ""
    if (types.includes("street_number")) {
      streetNumber = long
    } else if (types.includes("route")) {
      route = long
    } else if (types.includes("subpremise")) {
      parts.line2 = long
    } else if (types.includes("locality") || types.includes("sublocality_level_1")) {
      parts.city = long
    } else if (types.includes("administrative_area_level_1")) {
      parts.state = short
    } else if (types.includes("postal_code")) {
      parts.zip = long
    } else if (types.includes("country")) {
      parts.country = short
    }
  }

  parts.line1 = streetNumber ? `${streetNumber} ${route}` : route

  return parts
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing your address…",
  className = "",
  disabled = false,
}: AddressAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  // True once the user has typed but not yet picked a suggestion — so the
  // structured parts (city/state/zip) aren't populated. Drives a hint nudging
  // them to select from the dropdown, avoiding a dead-end where they type a full
  // address, don't select, and the form fails validation with no explanation.
  const [needsSelection, setNeedsSelection] = useState(false)

  // Keep the latest callbacks in refs so the element's (once-attached) event
  // listeners always call the current props without re-creating the element.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  // Snapshot the initial value for prefill only — the element owns its text
  // after mount, so we deliberately do NOT re-sync it on every value change
  // (that would clobber what the user is typing).
  const initialValueRef = useRef(value)

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError("Google Maps API key not configured")
      return
    }
    let cancelled = false

    loadPlacesLibrary()
      .then((places) => {
        if (cancelled || !containerRef.current || elementRef.current) return

        const el = new places.PlaceAutocompleteElement({
          includedRegionCodes: ["us"],
          placeholder,
          // Drop the leading magnifier so it reads as a normal address input,
          // not a search bar (prediction still works via the dropdown).
          noInputIcon: true,
        })
        if (initialValueRef.current) el.value = initialValueRef.current
        el.style.width = "100%"

        // Free typing: keep the parent's line1 in sync as the user types, so a
        // manually entered address (not picked from the dropdown) is still
        // captured — matches the old controlled-input behavior.
        el.addEventListener("input", () => {
          const text = el.value ?? ""
          onChangeRef.current(text)
          // Typing invalidates any prior selection → parts are stale until they
          // pick again. (A programmatic prefill via el.value doesn't fire input.)
          setNeedsSelection(text.trim().length > 0)
        })

        el.addEventListener("gmp-select", async (event) => {
          try {
            const place = event.placePrediction.toPlace()
            await place.fetchFields({
              fields: ["addressComponents", "location", "formattedAddress"],
            })
            const parts = extractAddressParts(place)
            onChangeRef.current(place.formattedAddress ?? parts.line1)
            onSelectRef.current(parts)
            setNeedsSelection(false)
          } catch {
            /* selection fetch failed — leave the typed text as-is */
          }
        })

        containerRef.current.appendChild(el)
        elementRef.current = el
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyMessage(err, "Could not load address autocomplete."))
      })

    return () => {
      cancelled = true
      elementRef.current?.remove()
      elementRef.current = null
    }
    // Mount once; callbacks are read from refs so we never re-create the element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reflect disabled changes onto the live element.
  useEffect(() => {
    if (elementRef.current) elementRef.current.disabled = disabled
  }, [disabled])

  // Keep the element's text in sync when the parent changes `value` AFTER mount
  // — e.g. selecting a saved address at checkout, or switching which address is
  // being edited without remounting the form. Without this the box stays stale
  // (blank street field) while city/state/zip populate. Skip while the field is
  // focused so we never clobber what the user is actively typing: focusing the
  // element's shadow input retargets document.activeElement to the host element.
  useEffect(() => {
    const el = elementRef.current
    if (!el) return
    if (document.activeElement === el) return
    if ((el.value ?? "") !== value) el.value = value
  }, [value])

  // Fallback: no API key or the library failed to load. A plain controlled
  // input keeps the form usable (manual entry still flows through onChange).
  if (error) {
    return (
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full rounded-xl border border-border bg-muted pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors ${className}`}
        />
      </div>
    )
  }

  // The PlaceAutocompleteElement web component renders its own input inside
  // this container. gmap-*-autocomplete styling is limited to the element box;
  // we match width and the rounded/bordered look of our other fields via the
  // wrapper and the element's exposed CSS variables.
  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className={`address-autocomplete w-full ${className}`}
        data-placeholder={placeholder}
      />
      {needsSelection && (
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a suggestion from the list to fill in city, state &amp; ZIP.
        </p>
      )}
    </div>
  )
}
