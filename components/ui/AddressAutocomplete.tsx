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
// this component. Load the Maps JS core with `loading=async` (no `libraries=`
// param → no "loaded without loading=async" warning), then pull Places on
// demand via importLibrary.
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

// Legacy Autocomplete's getPlace() returns snake_case address_components.
function extractAddressParts(place: google.maps.places.PlaceResult): AddressParts {
  const parts: AddressParts = {
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    lat: place.geometry?.location?.lat() ?? null,
    lng: place.geometry?.location?.lng() ?? null,
  }

  let streetNumber = ""
  let route = ""

  for (const component of place.address_components ?? []) {
    const types = component.types
    if (types.includes("street_number")) {
      streetNumber = component.long_name
    } else if (types.includes("route")) {
      route = component.long_name
    } else if (types.includes("subpremise")) {
      parts.line2 = component.long_name
    } else if (types.includes("locality") || types.includes("sublocality_level_1")) {
      parts.city = component.long_name
    } else if (types.includes("administrative_area_level_1")) {
      parts.state = component.short_name
    } else if (types.includes("postal_code")) {
      parts.zip = component.long_name
    } else if (types.includes("country")) {
      parts.country = component.short_name
    }
  }

  parts.line1 = streetNumber ? `${streetNumber} ${route}` : route

  return parts
}

/**
 * Address field with Google Places autocomplete. We render our OWN controlled
 * <input> and attach Places Autocomplete to it — rather than Google's
 * PlaceAutocompleteElement web component, whose input lives in a CLOSED shadow
 * root we can't style (it drew an un-removable blue focus outline). This input
 * uses our standard field styling, and the prediction dropdown (.pac-container)
 * is themed in globals.css.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing your address…",
  className = "",
  disabled = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [error, setError] = useState<string | null>(null)
  // True once the user typed but hasn't picked a suggestion — so the structured
  // parts (city/state/zip) aren't populated yet. Drives a nudge to select.
  const [needsSelection, setNeedsSelection] = useState(false)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError("Google Maps API key not configured")
      return
    }
    let cancelled = false

    loadPlacesLibrary()
      .then((places) => {
        if (cancelled || !inputRef.current || autocompleteRef.current) return

        const ac = new places.Autocomplete(inputRef.current, {
          fields: ["address_components", "geometry", "formatted_address"],
          componentRestrictions: { country: "us" },
          types: ["address"],
        })
        autocompleteRef.current = ac

        ac.addListener("place_changed", () => {
          const place = ac.getPlace()
          if (!place || !place.address_components) return
          const parts = extractAddressParts(place)
          onChangeRef.current(place.formatted_address ?? parts.line1)
          onSelectRef.current(parts)
          setNeedsSelection(false)
        })
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyMessage(err, "Could not load address autocomplete."))
      })

    return () => {
      cancelled = true
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current)
        autocompleteRef.current = null
      }
    }
    // Mount once; callbacks are read from refs so we never re-create it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Standard field styling — identical to the sibling City/State/ZIP inputs, so
  // the focus ring is our gold one (no stray blue shadow-DOM outline).
  const inputClass =
    "h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground " +
    "placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary " +
    className

  if (error) {
    return (
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`h-10 w-full rounded-md border border-border bg-background pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${className}`}
        />
      </div>
    )
  }

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setNeedsSelection(e.target.value.trim().length > 0)
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={inputClass}
      />
      {needsSelection && (
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a suggestion from the list to fill in city, state &amp; ZIP.
        </p>
      )}
    </div>
  )
}
