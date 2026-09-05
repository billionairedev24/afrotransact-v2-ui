/**
 * Server-only, best-effort IP → location for the account "active devices" view.
 * Uses a free, keyless geolocation API, caches results in-process, and returns
 * null on any failure or for private/local IPs (which don't geolocate). Never
 * throws — a missing location just shows the raw IP.
 */

export interface GeoLocation {
  city?: string
  region?: string
  country?: string
  countryCode?: string
}

const cache = new Map<string, GeoLocation | null>()

function isPrivateIp(ip: string): boolean {
  if (!ip) return true
  const v = ip.replace(/^::ffff:/, "")
  if (v === "127.0.0.1" || v === "::1" || v === "0.0.0.0") return true
  if (v.startsWith("10.") || v.startsWith("192.168.")) return true
  const m = v.match(/^172\.(\d+)\./)
  if (m) {
    const n = Number(m[1])
    if (n >= 16 && n <= 31) return true
  }
  // IPv6 unique-local / link-local
  if (/^f[cd]/i.test(v) || /^fe80/i.test(v)) return true
  return false
}

export async function lookupGeo(ip: string | undefined | null): Promise<GeoLocation | null> {
  if (!ip || isPrivateIp(ip)) return null
  if (cache.has(ip)) return cache.get(ip) ?? null
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { "User-Agent": "AfroTransact/1.0 (account-devices)" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    })
    if (!res.ok) {
      cache.set(ip, null)
      return null
    }
    const j = (await res.json()) as Record<string, unknown>
    if (j.error) {
      cache.set(ip, null)
      return null
    }
    const geo: GeoLocation = {
      city: (j.city as string) || undefined,
      region: (j.region as string) || undefined,
      country: (j.country_name as string) || undefined,
      countryCode: ((j.country_code as string) || (j.country as string)) || undefined,
    }
    cache.set(ip, geo)
    return geo
  } catch {
    cache.set(ip, null)
    return null
  }
}

/** "City, Region, US" — the friendliest non-empty subset available. */
export function formatGeo(geo: GeoLocation | null | undefined): string {
  if (!geo) return ""
  return [geo.city, geo.region, geo.countryCode].filter(Boolean).join(", ")
}
