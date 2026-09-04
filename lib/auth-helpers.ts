import { getSession, signIn } from "next-auth/react"

/**
 * Auth-presence check (BFF).
 *
 * The access token no longer lives in the browser — it's held server-side and
 * attached by the /api/gw proxy. Callers historically did
 * `const token = await getAccessToken(); if (!token) …` and then passed `token`
 * to `api()`/raw fetches. That contract is preserved: this returns a truthy
 * NON-SECRET marker (the user id) when a usable session exists, and null
 * otherwise — so caller gates still work. The returned value is NOT a bearer
 * token; the proxy strips any Authorization the browser sends and re-attaches
 * the real token. Returns null on RefreshTokenError so the SessionGuard can
 * force re-authentication.
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession() as {
    error?: string
    user?: { id?: string }
  } | null

  if (!session?.user?.id) return null
  if (session.error === "RefreshTokenError") return null

  return session.user.id
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
