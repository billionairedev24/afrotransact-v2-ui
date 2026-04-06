import { ApiError } from "@/lib/api"

/**
 * Logs a caught error with context.
 * Call this in every catch block — the actual technical details
 * are already logged at source in api.ts, but this adds caller context.
 */
export function logError(err: unknown, context: string): void {
  if (err instanceof ApiError) {
    // Already logged at source; add context without re-logging the full error
    console.error(`[${context}] API ${err.status} on ${err.path}`)
  } else {
    console.error(`[${context}]`, err)
  }
}

/**
 * Returns a user-safe error message.
 * Never exposes ApiError.body/.path/.status (raw backend internals) to the user.
 * Use this whenever building a string to display in the UI.
 *
 * @param err     The caught error
 * @param fallback A friendly message to show the user, e.g. "Could not load orders."
 */
export function friendlyMessage(err: unknown, fallback: string): string {
  // ApiError.message contains "API /path returned 500: …" — never show that
  if (err instanceof ApiError) return fallback
  // Plain Error objects from our own code may have safe messages; use fallback to be safe
  return fallback
}
