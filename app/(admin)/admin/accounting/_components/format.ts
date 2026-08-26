export function money(cents: number): string {
  const abs = Math.abs(cents) / 100
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return cents < 0 ? `−$${formatted}` : `$${formatted}`
}
