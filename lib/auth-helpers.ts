import { getSession } from "next-auth/react"

type SessionLike = {
  accessToken?: string
  expiresAt?: number
  error?: string
} | null

/**
 * Get a fresh Keycloak access token by triggering a server-side session refresh.
 * If the token is within 90 seconds of expiry (or already expired), a fresh
 * server round-trip is forced so the JWT callback can refresh it.
 * Returns null if the session is missing or has a RefreshTokenError
 * (the SessionGuard will force re-authentication in that case).
 */
export async function getAccessToken(): Promise<string | null> {
  let session = await getSession() as SessionLike

  if (session?.error === "RefreshTokenError") return null

  const bufferMs = 90_000
  const isStale =
    session?.expiresAt != null &&
    Date.now() > session.expiresAt * 1000 - bufferMs

  if (!session?.accessToken || isStale) {
    session = await getSession() as SessionLike
  }

  if (!session?.accessToken) return null
  if (session.error === "RefreshTokenError") return null

  return session.accessToken
}
