/** YYYY-MM-DD in the user's local timezone (matches `<input type="date">`). */
export function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function localYmdToday(): string {
  return localYmd(new Date())
}

export function localYmdDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return localYmd(d)
}
