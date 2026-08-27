export function money(cents: number): string {
  const abs = Math.abs(cents) / 100
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return cents < 0 ? `−$${formatted}` : `$${formatted}`
}

/**
 * Local calendar date as `YYYY-MM-DD`. The accounting API's date params are
 * date-based (`parseStart`/`parseEnd` accept a bare date; `/opex` takes a
 * `LocalDate`). `Date.toISOString()` must NOT be used — it emits a
 * `Z`-suffixed instant the backend's `LocalDateTime.parse`/`LocalDate` cannot
 * parse (400/500). This formats the *local* calendar day instead.
 */
export function toLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
