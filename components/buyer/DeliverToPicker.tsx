"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin, X, Loader2 } from "lucide-react"

/* Geocoding now happens entirely client-side via Google Maps (NEXT_PUBLIC
   key) with BigDataCloud/Zippopotam.us as key-free fallbacks. No backend
   round-trip needed. */
import { useBuyerLocation, type BuyerLocation } from "@/stores/buyer-location"

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

type Resolved = { postalCode?: string; country?: string; state?: string | null; city?: string | null }

function pickComponent(comps: Array<{ types: string[]; short_name: string; long_name: string }>, type: string, useLong = false): string | undefined {
  const m = comps.find((c) => c.types.includes(type))
  return m ? (useLong ? m.long_name : m.short_name) : undefined
}

/** Reverse geocode (lat,lng → address) using Google directly. Returns null on failure. */
async function googleReverseGeocode(lat: number, lng: number): Promise<Resolved | null> {
  if (!GOOGLE_KEY) return null
  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=postal_code&key=${GOOGLE_KEY}`,
    ).then((res) => res.json() as Promise<{ status: string; results: Array<{ address_components: Array<{ types: string[]; short_name: string; long_name: string }> }> }>)
    if (r.status !== "OK" || !r.results.length) return null
    const comps = r.results[0].address_components
    return {
      postalCode: pickComponent(comps, "postal_code"),
      country: pickComponent(comps, "country"),
      state: pickComponent(comps, "administrative_area_level_1") ?? null,
      city: pickComponent(comps, "locality", true) ?? pickComponent(comps, "postal_town", true) ?? null,
    }
  } catch {
    return null
  }
}

/** Forward geocode (postal+country → coords + city/state) using Google directly. */
async function googleForwardGeocode(postalCode: string, country: string): Promise<{ lat: number; lng: number; state: string | null; city: string | null } | null> {
  if (!GOOGLE_KEY) return null
  try {
    const components = `postal_code:${postalCode}|country:${country}`
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?components=${encodeURIComponent(components)}&key=${GOOGLE_KEY}`,
    ).then((res) => res.json() as Promise<{ status: string; results: Array<{ geometry: { location: { lat: number; lng: number } }; address_components: Array<{ types: string[]; short_name: string; long_name: string }> }> }>)
    if (r.status !== "OK" || !r.results.length) return null
    const top = r.results[0]
    const comps = top.address_components
    return {
      lat: top.geometry.location.lat,
      lng: top.geometry.location.lng,
      state: pickComponent(comps, "administrative_area_level_1") ?? null,
      city: pickComponent(comps, "locality", true) ?? pickComponent(comps, "postal_town", true) ?? null,
    }
  } catch {
    return null
  }
}

function locationLabel(loc: BuyerLocation): string {
  if (loc.postalCode) return loc.postalCode
  if (loc.city && loc.state) return `${loc.city}, ${loc.state}`
  if (loc.city) return loc.city
  if (loc.state) return loc.state
  return "Near you"
}
import { cn } from "@/lib/utils"

/**
 * "Deliver to" header pill, Amazon-style. Click → modal. Empty selection on
 * first visit → modal pops automatically once per browser (prompted flag).
 *
 * Only supports US ZIP + country picker for v1. Adding more countries is a
 * matter of widening the country select.
 */
const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "NG", label: "Nigeria" },
]

export function DeliverToPicker() {
  const location = useBuyerLocation((s) => s.location)
  const prompted = useBuyerLocation((s) => s.prompted)
  const markPrompted = useBuyerLocation((s) => s.markPrompted)
  const setLocation = useBuyerLocation((s) => s.setLocation)

  const [open, setOpen] = useState(false)

  // First-visit auto-detect: ask the browser for GPS, reverse-geocode to a
  // postal code, and save silently. If the user denies or it fails, fall
  // back to popping the picker modal so they can type a ZIP. Either way
  // they can click the header pill to change later.
  const popped = useRef(false)
  useEffect(() => {
    if (popped.current) return
    if (prompted || location) return
    popped.current = true
    let cancelled = false
    const fallback = window.setTimeout(() => {
      if (!cancelled) setOpen(true)
    }, 4000)
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          window.clearTimeout(fallback)
          if (cancelled) return
          // First try our seller-side endpoint (Google Maps if configured),
          // then fall back to BigDataCloud's key-free client endpoint so we
          // can still resolve city/state when Google isn't wired up. Whatever
          // succeeds gets saved with city/state; if both fail we save the
          // raw coords so geo-filtered search still works.
          const { latitude: lat, longitude: lng } = pos.coords
          let resolved: Resolved | null = null
          // 1. Google directly (uses NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
          resolved = await googleReverseGeocode(lat, lng)
          // 2. BigDataCloud key-free fallback
          if (!resolved) {
            try {
              const bdc = await fetch(
                `https://api-bdc.io/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
              ).then((r) => r.json() as Promise<{ postcode?: string; countryCode?: string; principalSubdivisionCode?: string; city?: string; locality?: string }>)
              if (bdc) {
                resolved = {
                  postalCode: bdc.postcode || undefined,
                  country: bdc.countryCode || "US",
                  // BDC returns "US-TX" — strip prefix to match our shape.
                  state: bdc.principalSubdivisionCode?.split("-").pop() || null,
                  city: bdc.city || bdc.locality || null,
                }
              }
            } catch { /* fall through to coord-only */ }
          }
          if (cancelled) return
          setLocation({
            postalCode: resolved?.postalCode,
            country: resolved?.country ?? "US",
            state: resolved?.state ?? null,
            city: resolved?.city ?? null,
            lat,
            lng,
          })
        },
        () => {
          window.clearTimeout(fallback)
          if (!cancelled) setOpen(true)
        },
        { timeout: 3500, maximumAge: 60_000 },
      )
    } else {
      window.clearTimeout(fallback)
      setOpen(true)
    }
    return () => {
      cancelled = true
      window.clearTimeout(fallback)
    }
  }, [prompted, location, setLocation])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
        aria-label="Choose delivery location"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[10px] text-white/60">Deliver to</span>
          <span className="font-semibold text-white">
            {location ? (locationLabel(location)) : "Select"}
          </span>
        </span>
      </button>
      {open && (
        <DeliverToModal
          initial={location}
          onClose={() => {
            markPrompted()
            setOpen(false)
          }}
          onSave={(loc) => {
            setLocation(loc)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function DeliverToModal({
  initial,
  onClose,
  onSave,
}: {
  initial: ReturnType<typeof useBuyerLocation.getState>["location"]
  onClose: () => void
  onSave: (loc: NonNullable<ReturnType<typeof useBuyerLocation.getState>["location"]>) => void
}) {
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? "")
  const [country, setCountry] = useState(initial?.country ?? "US")
  const [state, setState] = useState(initial?.state ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const code = postalCode.trim()
    if (!code) {
      setErr("Postal code is required.")
      return
    }
    setSubmitting(true)
    try {
      let lat: number | null = null
      let lng: number | null = null
      let city: string | null = null
      let resolvedState: string | null = state.trim() || null

      // 1. Google directly with the NEXT_PUBLIC_ key.
      const g = await googleForwardGeocode(code, country)
      if (g) {
        lat = g.lat
        lng = g.lng
        city = g.city
        if (!resolvedState) resolvedState = g.state
      }
      // 2. Zippopotam.us for US ZIPs (key-free fallback).
      if (lat == null && country === "US") {
        try {
          const z = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(code)}`).then((r) => r.ok ? r.json() : null) as
            | { places?: Array<{ latitude: string; longitude: string; "place name": string; "state abbreviation": string }> }
            | null
          const place = z?.places?.[0]
          if (place) {
            lat = parseFloat(place.latitude)
            lng = parseFloat(place.longitude)
            city = place["place name"]
            if (!resolvedState) resolvedState = place["state abbreviation"]
          }
        } catch { /* keep going */ }
      }

      onSave({
        postalCode: code,
        country,
        state: resolvedState,
        city,
        lat,
        lng,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save location.")
    } finally {
      setSubmitting(false)
    }
  }

  async function useCurrentLocation() {
    setErr(null)
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErr("Your browser doesn't support geolocation.")
      return
    }
    setSubmitting(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        let resolved: Resolved | null = await googleReverseGeocode(lat, lng)
        if (!resolved) {
          try {
            const bdc = await fetch(
              `https://api-bdc.io/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
            ).then((r) => r.json() as Promise<{ postcode?: string; countryCode?: string; principalSubdivisionCode?: string; city?: string; locality?: string }>)
            if (bdc) {
              resolved = {
                postalCode: bdc.postcode || undefined,
                country: bdc.countryCode || "US",
                state: bdc.principalSubdivisionCode?.split("-").pop() || null,
                city: bdc.city || bdc.locality || null,
              }
            }
          } catch { /* nothing */ }
        }
        onSave({
          postalCode: resolved?.postalCode,
          country: resolved?.country ?? "US",
          state: resolved?.state ?? null,
          city: resolved?.city ?? null,
          lat,
          lng,
        })
      },
      (err) => {
        setSubmitting(false)
        setErr(err.code === err.PERMISSION_DENIED
          ? "Location permission denied. Enable it in your browser settings or enter a ZIP."
          : "Couldn't read your location. Try entering a ZIP instead.")
      },
      { timeout: 6000, maximumAge: 60_000, enableHighAccuracy: false },
    )
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <form
        onSubmit={save}
        className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden"
      >
        <header className="flex items-start justify-between gap-3 px-6 py-5 border-b border-gray-200">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-orange-600">
              <MapPin className="h-3 w-3" /> Deliver to
            </div>
            <h2 className="text-lg font-bold text-gray-900">Choose your delivery location</h2>
            <p className="text-sm text-gray-600">
              We use this to show only items that ship to you and to give you
              accurate delivery dates at checkout.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-6 py-5 space-y-4">
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
            Use my current location
          </button>
          <div className="text-center text-[11px] uppercase tracking-wider text-gray-400">or enter a ZIP</div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-sm"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                {country === "US" ? "ZIP code" : "Postal code"}
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder={country === "US" ? "78701" : "Postal"}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                State <span className="font-medium normal-case text-gray-500">(opt.)</span>
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="TX"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          {err && (
            <p className="text-xs text-red-600">{err}</p>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Skip
          </button>
          <button
            type="submit"
            disabled={submitting || !postalCode.trim()}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-bold bg-[#F5C518] hover:bg-[#E5B100] text-gray-900 disabled:opacity-50",
              submitting && "inline-flex items-center gap-2",
            )}
          >
            {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
            Save
          </button>
        </footer>
      </form>
    </div>
  )
}
