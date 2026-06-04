/**
 * When a seller is allowed past the SSR gate into /dashboard routes.
 *
 * Seller service onboarding statuses include: started, in_progress, submitted,
 * under_review, approved, rejected, needs_action, suspended.
 * Include legacy/alias strings used elsewhere in the UI (`completed`, `active`).
 */
export function isSellerDashboardOnboardingReady(status: unknown): boolean {
  const s = typeof status === "string" ? status.trim().toLowerCase() : ""
  return s === "approved" || s === "completed" || s === "active"
}

/**
 * Safe JSON read for `/api/v1/seller/me` which returns **204 No Content**
 * when the user has no seller row (instead of JSON). `res.ok` is still true for 204,
 * so `res.json()` would throw unless handled.
 */
export async function parseSellerMeResponse(
  res: Response,
): Promise<Record<string, unknown> | null> {
  if (res.status === 204) return null
  if (!res.ok) return null
  const text = await res.text().catch(() => "")
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return null
  }
}
