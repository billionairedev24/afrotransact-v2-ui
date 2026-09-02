import { getSession, signIn } from "next-auth/react"

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

/** True while the short-lived sign-out marker cookie (set by /api/auth/signout)
 *  is present. Read-only — never clears it, so every auto-signIn site observes
 *  it for the whole window; it self-expires via Max-Age. */
export function isSignedOutRecently(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie.split(";").some((c) => c.trim().startsWith("atx-signed-out="))
}

/**
 * signIn("keycloak") for AUTOMATIC re-auth triggers (a component discovering the
 * access token has gone, e.g. a token-loss guard) — NOT for user-initiated
 * "Sign in" buttons. It refuses to fire while the sign-out marker is present.
 *
 * This closes the sign-out race: sign-out clears the app session and redirects
 * through Keycloak's end-session, but the Keycloak SSO cookie takes a beat to
 * clear. Any auto-signIn firing in that beat (the seller onboarding page and the
 * order page both re-auth on token loss) reaches Keycloak while the SSO is still
 * alive and gets a NEW session silently — bouncing the user right back in. With
 * this guard, those automatic re-auths stand down until the marker expires, so
 * the sign-out sticks. Returns true if it initiated sign-in, false if suppressed.
 */
export function autoSignInKeycloak(options?: { callbackUrl?: string }): boolean {
  if (isSignedOutRecently()) return false
  void signIn("keycloak", options)
  return true
}
