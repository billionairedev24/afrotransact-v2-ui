import { getSession } from "next-auth/react"

/**
 * Get a fresh Keycloak access token by triggering a server-side session refresh.
 * Returns null if the session is missing or has a RefreshTokenError
 * (the SessionGuard will force re-authentication in that case).
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession() as {
    accessToken?: string
    error?: string
  } | null

  if (!session?.accessToken) return null
  if (session.error === "RefreshTokenError") return null

  return session.accessToken
}
