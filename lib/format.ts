export function formatPrice(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

export function formatPriceDecimal(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount)
}

export function formatDistance(miles?: number): string {
  if (miles === undefined || miles === null) return ""
  if (miles < 0.1) return "< 0.1 mi"
  return `${miles.toFixed(1)} mi`
}

export function formatRating(rating: number): string {
  return rating.toFixed(1)
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || `${singular}s`)
}
