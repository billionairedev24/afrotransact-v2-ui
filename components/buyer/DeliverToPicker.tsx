"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin, X, Loader2 } from "lucide-react"

import { geocodePostalCode, reverseGeocode } from "@/lib/api"
import { useBuyerLocation } from "@/stores/buyer-location"
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
          // Save coords immediately so geo-filtered search + PDP eligibility
          // work regardless of whether reverse-geocode succeeds. We then try
          // to enrich with a postal code; failure is silent — the user keeps
          // the click-to-change pill, which now shows "Near you".
          const baseLoc = {
            postalCode: undefined as string | undefined,
            country: "US",
            state: null as string | null,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }
          try {
            const r = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
            if (cancelled) return
            if (r.ok && r.postalCode) {
              setLocation({
                postalCode: r.postalCode,
                country: r.country ?? "US",
                state: r.state ?? null,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              })
              return
            }
          } catch {
            // fall through to coord-only save
          }
          if (!cancelled) setLocation(baseLoc)
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
            {location ? (location.postalCode || "Near you") : "Select"}
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
    if (!postalCode.trim()) {
      setErr("Postal code is required.")
      return
    }
    setSubmitting(true)
    try {
      const geo = await geocodePostalCode(postalCode.trim(), country)
      if (!geo.ok) {
        // Save without coords — eligibility falls back to "unknown" but
        // still lets the buyer shop. Country/state region matching works.
        onSave({
          postalCode: postalCode.trim(),
          country,
          state: state.trim() || null,
        })
        return
      }
      onSave({
        postalCode: postalCode.trim(),
        country,
        state: state.trim() || null,
        lat: geo.lat ?? null,
        lng: geo.lng ?? null,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save location.")
    } finally {
      setSubmitting(false)
    }
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
