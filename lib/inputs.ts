/**
 * Shared input normalizers for numeric form fields.
 *
 * Why these exist: when a numeric field is rendered with value={someNumber}
 * (or starts at "0"), typing a digit at the end produces strings like "025"
 * because React/the browser don't strip the leading zero. These helpers
 * sanitize the on-change value so the UI shows what the seller actually
 * entered.
 */

/**
 * Integer-only normalizer. Discards non-digits, strips leading zeros.
 * Empty stays empty; lone "0" stays "0".
 *
 *   "" → ""    "0" → "0"    "021" → "21"    "1a2" → "12"
 */
export function normalizeInt(v: string): string {
  const cleaned = v.replace(/\D/g, "")
  if (cleaned === "") return ""
  const trimmed = cleaned.replace(/^0+/, "")
  return trimmed === "" ? "0" : trimmed
}

/**
 * Decimal-friendly normalizer. Keeps one decimal point, strips junk and
 * leading zeros while preserving "0." prefixes.
 *
 *   "" → ""    "0" → "0"    "01.5" → "1.5"    ".5" → "0.5"    "0.50" → "0.50"
 */
export function normalizeDecimal(v: string): string {
  // keep digits + first dot only
  let s = v.replace(/[^\d.]/g, "")
  const firstDot = s.indexOf(".")
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "")
  }
  if (s === "") return ""
  if (s.startsWith(".")) s = "0" + s
  // strip leading zeros, but only when followed by another digit (preserve "0.")
  s = s.replace(/^0+(?=\d)/, "")
  return s
}
