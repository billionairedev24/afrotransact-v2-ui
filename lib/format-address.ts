/**
 * The order service stores `shipping_address` as a JSON blob (it captures a
 * snapshot at checkout time so the buyer's later address edits don't rewrite
 * the historical record). Buyer-facing pages render the structured address
 * via dedicated components, but admin/seller order views were leaking the
 * raw JSON string. This helper parses + formats it into a human-readable
 * block, with safe fallbacks if the field is null, plain text, or malformed.
 */

export interface ShippingAddressSnapshot {
  fullName?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  phone?: string
}

export function parseShippingAddress(raw: unknown): ShippingAddressSnapshot | null {
  if (raw == null) return null
  if (typeof raw === "object") return raw as ShippingAddressSnapshot
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === "object") return parsed as ShippingAddressSnapshot
  } catch {
    /* not JSON — fall through */
  }
  return null
}

/**
 * Returns formatted lines for display. Empty/missing fields are skipped so we
 * never render an empty line. If the raw value can't be parsed, falls back to
 * the original string (so legacy plain-text addresses still render).
 */
export function formatShippingAddressLines(raw: unknown): string[] {
  const addr = parseShippingAddress(raw)
  if (!addr) {
    if (typeof raw === "string" && raw.trim()) return [raw.trim()]
    return []
  }
  const lines: string[] = []
  if (addr.fullName) lines.push(addr.fullName)
  if (addr.line1) lines.push(addr.line1)
  if (addr.line2) lines.push(addr.line2)
  const cityState = [addr.city, addr.state].filter(Boolean).join(", ")
  const cityStateZip = [cityState, addr.zip].filter(Boolean).join(" ")
  if (cityStateZip) lines.push(cityStateZip)
  if (addr.country && addr.country.toUpperCase() !== "US") lines.push(addr.country)
  if (addr.phone) lines.push(addr.phone)
  return lines
}
