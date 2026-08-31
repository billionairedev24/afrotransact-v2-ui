/**
 * BFF (Backend-for-Frontend) Authentication via NextAuth + Keycloak
 *
 * Security model:
 *  - KEYCLOAK_CLIENT_SECRET has NO "NEXT_PUBLIC_" prefix → Next.js never includes it
 *    in the browser bundle. It only exists on the Node.js server process.
 *  - The OAuth Authorization Code flow runs entirely server-to-server:
 *      Browser → NextAuth API route (our server) → Keycloak (server-to-server with secret)
 *  - The browser receives only an HttpOnly session cookie. It never sees the
 *    client_secret, the raw access token, or the refresh token.
 *  - The session callback (below) filters what data is forwarded to the client.
 *  - NEVER add NEXT_PUBLIC_KEYCLOAK_CLIENT_SECRET — that would expose the secret.
 *
 * In Keycloak, the "afrotransact-web" client must be set to:
 *   Access Type = confidential  (requires a client secret)
 *   Valid Redirect URIs         = your app's domain only (never "*")
 *   PKCE Enabled                = true  (extra protection if server ever becomes public)
 */

import { NextAuthOptions, TokenSet, Session } from "next-auth"
import type { JWT } from "next-auth/jwt"
import type { OAuthConfig } from "next-auth/providers/oauth"
import KeycloakProvider from "next-auth/providers/keycloak"
import { grantSellerEntitlements } from "@/lib/keycloak-admin"
import { kcIssuerPublic, kcIssuerServer } from "@/lib/keycloak-issuers"

// Defense-in-depth: refuse to load in the browser. The secrets this module
// references (KEYCLOAK_CLIENT_SECRET, etc.) must never be bundled client-side.
if (typeof window !== "undefined") {
  throw new Error(
    "[auth] lib/auth.ts is server-only and must not be imported from the client.",
  )
}

/**
 * Reads a required env var, but does NOT throw at module-load time.
 *
 * Historically we threw from the module's top-level to fail fast. The trouble
 * is that the NextAuth route file imports this module, so a missing secret
 * prevented the module from loading at all → every request to /api/auth/*
 * (including GET /session, which doesn't actually need the secret) returned
 * a generic 500 Internal Server Error from the Node runtime, with no log
 * message and no NextAuth error JSON.
 *
 * Instead we now log a loud warning and return an empty string. The real
 * error still surfaces — just later, at the first OAuth exchange — but now
 * it comes through NextAuth's proper error path and /api/auth/session keeps
 * working for unauthenticated users.
 */
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(
      `[auth] Missing required environment variable "${name}". ` +
        "Auth will fail until it is set. See .env.local.example.",
    )
    return ""
  }
  return value
}

/** Non-sensitive config — safe to fall back to local dev defaults. */
function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback
}

if (kcIssuerPublic !== kcIssuerServer && process.env.NODE_ENV !== "test") {
  console.info(
    `[auth] Keycloak split issuers — public (browser redirects): ${kcIssuerPublic}; ` +
      `server (token/userinfo/JWKS from Next.js): ${kcIssuerServer}`,
  )
}

const kcClientId = optionalEnv("KEYCLOAK_CLIENT_ID", "afrotransact-web")
const kcClientSecret = requireEnv("KEYCLOAK_CLIENT_SECRET")
const kcScope = "openid email profile offline_access"

/**
 * Keycloak-internal realm roles that carry no application meaning. They bloat
 * the session JWT (contributing to the >4KB cookie chunking that makes
 * getServerSession() return null and bounce logged-in users to sign-in), and
 * no app guard ever checks them. Strip them so token.roles holds only the
 * actual application roles (admin/seller/buyer/…).
 */
const KEYCLOAK_INTERNAL_ROLES = new Set(["offline_access", "uma_authorization"])

function appRolesOnly(roles: string[] | undefined | null): string[] {
  if (!roles) return []
  return roles.filter(
    (r) => typeof r === "string" && r.length > 0 &&
      !KEYCLOAK_INTERNAL_ROLES.has(r) &&
      !r.startsWith("default-roles-"),
  )
}

// Cross-subdomain SSO: the session cookie must be scoped to the parent
// domain (`.afrotransact.com`) so it is sent to sibling apps such as
// www.inventory.afrotransact.com. Prod runs over HTTPS and uses the
// `__Secure-` cookie prefix; local dev over http must use the plain name
// with secure:false, otherwise the browser rejects the cookie.
const useSecureCookies = (process.env.NEXTAUTH_URL ?? "").startsWith("https://")
const cookiePrefix = useSecureCookies ? "__Secure-" : ""

if (!process.env.NEXTAUTH_SECRET) {
  console.error(
    "[auth] NEXTAUTH_SECRET is not set. NextAuth cannot sign session cookies.",
  )
}

/**
 * Regular Keycloak sign-in — browser hits public issuer `/auth`; server exchanges
 * the code via token/userinfo/JWKS (often the internal issuer in Docker/K8s).
 */
function keycloakLoginProvider(): OAuthConfig<Record<string, unknown>> {
  if (kcIssuerPublic === kcIssuerServer) {
    return KeycloakProvider({
      clientId: kcClientId,
      clientSecret: kcClientSecret,
      issuer: kcIssuerPublic,
      authorization: { params: { scope: kcScope } },
    }) as OAuthConfig<Record<string, unknown>>
  }

  return {
    id: "keycloak",
    name: "Keycloak",
    type: "oauth",
    issuer: kcIssuerPublic,
    clientId: kcClientId,
    clientSecret: kcClientSecret,
    authorization: {
      url: `${kcIssuerPublic}/protocol/openid-connect/auth`,
      // prompt=login forces Keycloak to show the login form on every explicit
      // sign-in, even when a Keycloak SSO session cookie (KEYCLOAK_IDENTITY)
      // still lives in the browser. Without it, clicking "Sign in" after a
      // logout silently re-authenticated the SAME user off the lingering SSO
      // cookie — so you could never switch accounts. Our /api/auth/signout
      // clears the NextAuth cookies but cannot clear Keycloak's browser SSO
      // cookie from the server side (a server-side fetch carries none of the
      // user's cookies); id_token_hint isn't available for a silent RP-logout
      // because we intentionally don't persist the id_token (see jwt() note),
      // so forcing the prompt on login is the reliable fix. Cross-subdomain
      // SSO is unaffected — that rides the shared NextAuth cookie, not KC's.
      params: { scope: kcScope, prompt: "login" },
    },
    token: {
      url: `${kcIssuerServer}/protocol/openid-connect/token`,
    },
    userinfo: {
      url: `${kcIssuerServer}/protocol/openid-connect/userinfo`,
    },
    jwks_endpoint: `${kcIssuerServer}/protocol/openid-connect/certs`,
    checks: ["pkce", "state"],
    idToken: true,
    profile(profile) {
      return {
        id: profile.sub as string,
        name: (profile.name ?? profile.preferred_username) as string,
        email: profile.email as string,
        image: profile.picture as string | undefined,
      }
    },
    style: {
      logo: "/keycloak.svg",
      bg: "#fff",
      text: "#000",
    },
  }
}

/**
 * A raw OAuth provider that points at Keycloak's /registrations endpoint
 * instead of /auth. Uses type:"oauth" to avoid OIDC auto-discovery
 * overriding the authorization URL.
 */
function keycloakRegisterBase(id: string, name: string): OAuthConfig<Record<string, unknown>> {
  return {
    id,
    name,
    type: "oauth",
    issuer: kcIssuerPublic,
    clientId: kcClientId,
    clientSecret: kcClientSecret,
    authorization: {
      url: `${kcIssuerPublic}/protocol/openid-connect/registrations`,
      params: { scope: kcScope },
    },
    token: {
      url: `${kcIssuerServer}/protocol/openid-connect/token`,
    },
    userinfo: {
      url: `${kcIssuerServer}/protocol/openid-connect/userinfo`,
    },
    jwks_endpoint: `${kcIssuerServer}/protocol/openid-connect/certs`,
    idToken: true,
    checks: ["state"],
    profile(profile) {
      return {
        id: profile.sub as string,
        name: (profile.name ?? profile.preferred_username) as string,
        email: profile.email as string,
        image: profile.picture as string | undefined,
      }
    },
  }
}

export const authOptions: NextAuthOptions = {
  // TWO providers: login + registration. Buyer and seller both register through
  // the SAME provider — seller intent is no longer a Keycloak param/attribute
  // set at registration; it's an app cookie the post-login SellerIntentProvider
  // turns into a durable grant. Removing the 3rd (seller) provider removes a
  // whole class of NextAuth "state cookie created for a different provider"
  // OAuthCallback errors; the login↔register race is covered by
  // /api/auth/reset-oauth-state.
  providers: [
    keycloakLoginProvider(),
    keycloakRegisterBase("keycloak-register", "Keycloak Register"),
  ],

  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Share the session cookie across every *.afrotransact.com subdomain so a
  // single sign-in works on both the main web app and the inventory app
  // (www.inventory.afrotransact.com). Both apps use an IDENTICAL cookie name
  // pattern + secret + Keycloak client, so they read the same cookie.
  //
  // In prod (HTTPS) the browser requires the `__Secure-` prefix and secure:true;
  // in local dev (http://localhost) it requires the plain name, secure:false,
  // and no cross-site domain (a `.afrotransact.com` Domain would be rejected on
  // localhost), so the parent-domain scope is only applied when secure.
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        domain: useSecureCookies ? ".afrotransact.com" : undefined,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookies,
      },
    },
  },

  callbacks: {
    async jwt({ token, account, user, profile, trigger }): Promise<any> {
      if (account && user) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        // NOTE: we intentionally do NOT persist the id_token in the session JWT.
        // Keycloak's access + refresh + id tokens together push the encrypted
        // NextAuth cookie past the 4 KB single-cookie limit, so it gets chunked
        // — and chunked cookies make getServerSession() flaky in Server
        // Components (it returns null → the /admin guard bounces an authenticated
        // admin to the login page). SSO logout still works via the refresh-token
        // revocation in the signOut event + client_id on the browser logout.
        token.expiresAt = account.expires_at
        token.id = user.id

        const claims = profile as Record<string, unknown> | undefined
        // Keycloak SSO session id — lets the account "active devices" view flag
        // which session is the current one and revoke the others.
        if (typeof claims?.sid === "string") token.sid = claims.sid
        const flatRoles = claims?.realm_roles as string[] | undefined
        const nestedRoles = (claims?.realm_access as { roles?: string[] })?.roles
        // Only the actual application roles — strip Keycloak-internal roles so
        // the session cookie stays small enough not to chunk.
        token.roles = appRolesOnly(flatRoles ?? nestedRoles)

        token.registrationRole = claims?.registration_role as string | undefined
        // Email verification is now enforced at the APP level (a gate on
        // checkout / seller go-live), not by blocking Keycloak login. Carry the
        // claim so the app can gate. It refreshes to true on the next token
        // refresh after the user clicks their verification link.
        token.emailVerified = claims?.email_verified === true

        // Belt-and-suspenders: if a user already carries the durable
        // `registration_role=seller` attribute (written by /api/auth/grant-seller)
        // but somehow lacks the seller realm role, grant it on login. New
        // self-service sellers are granted by the post-login SellerIntentProvider;
        // this just heals any account whose role and attribute drifted.
        const roles = token.roles as string[] | undefined
        const needsSellerGrant =
          token.registrationRole === "seller" && !roles?.includes("seller")
        if (needsSellerGrant) {
          const { registrationOk, realmRoleOk } = await grantSellerEntitlements(user.id as string)
          if (registrationOk || realmRoleOk) token.registrationRole = "seller"
        }
      }

      // Client called useSession().update() — e.g. the verify-email banner's
      // "I've verified" button. Force a fresh token so email_verified / roles
      // update immediately instead of waiting out the access-token lifespan.
      if (trigger === "update" && token.refreshToken) {
        try {
          return await refreshAccessToken(token)
        } catch {
          token.error = "RefreshTokenError"
          return token
        }
      }

      // Refresh ~60s BEFORE expiry so an active user's requests always carry a
      // valid token — they should never surface a 401. (An idle user whose
      // refresh token has expired past Keycloak's SSO idle TTL falls through to
      // the refresh below, which fails and sets error=RefreshTokenError → the
      // SessionGuard performs a full sign-out.)
      const EXPIRY_BUFFER_MS = 60_000
      if (token.expiresAt && Date.now() < token.expiresAt * 1000 - EXPIRY_BUFFER_MS) {
        return token
      }

      // Access token expired (or within the refresh buffer) — try to refresh it
      if (token.refreshToken) {
        try {
          return await refreshAccessToken(token)
        } catch {
          token.error = "RefreshTokenError"
          return token
        }
      }

      return token
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.error = token.error
      session.sid = token.sid

      if (token.id) {
        session.user.id = token.id
      }
      if (token.email) {
        session.user.email = token.email
      }
      if (token.name) {
        session.user.name = token.name
      }
      session.user.roles = token.roles ?? []
      session.user.registrationRole = token.registrationRole
      session.user.emailVerified = token.emailVerified === true

      return session
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },

  events: {
    async signIn({ user }) {
      // Optionally publish sign-in event to gateway/Kafka
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
      try {
        await fetch(`${apiUrl}/api/v1/events/user-signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {
          // Non-critical — don't block sign-in if event publish fails
        })
      } catch {
        // Silently ignore event publishing failures
      }
    },

    async signOut(message: { session: Session; token: JWT }) {
      // Revoke the refresh token server-side so Keycloak's SSO session
      // is fully terminated even if the browser redirect fails.
      const token = message.token
      if (token?.refreshToken) {
        try {
          await fetch(`${kcIssuerServer}/protocol/openid-connect/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: optionalEnv("KEYCLOAK_CLIENT_ID", "afrotransact-web"),
              client_secret: requireEnv("KEYCLOAK_CLIENT_SECRET"),
              refresh_token: String(token.refreshToken),
            }),
          })
        } catch {
          // Best-effort — the browser redirect to Keycloak logout is the primary mechanism
        }
      }
    },
  },
}

async function refreshAccessToken(token: {
  refreshToken?: string
  accessToken?: string
  expiresAt?: number
  [key: string]: unknown
}) {
  const tokenUrl = `${kcIssuerServer}/protocol/openid-connect/token`

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: optionalEnv("KEYCLOAK_CLIENT_ID", "afrotransact-web"),
      client_secret: requireEnv("KEYCLOAK_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: token.refreshToken!,
    }),
  })

  const refreshedTokens: TokenSet = await response.json()

  if (!response.ok) {
    throw new Error("Failed to refresh access token")
  }

  let roles = token.roles as string[] | undefined
  let registrationRole = token.registrationRole as string | undefined
  let emailVerified = token.emailVerified as boolean | undefined
  if (refreshedTokens.access_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(refreshedTokens.access_token.split(".")[1], "base64url").toString()
      )
      const flatRoles = payload.realm_roles as string[] | undefined
      const nestedRoles = (payload.realm_access as { roles?: string[] })?.roles
      const fresh = flatRoles ?? nestedRoles
      if (fresh) roles = appRolesOnly(fresh)
      if (payload.registration_role) {
        registrationRole = payload.registration_role as string
      }
      // Picks up email_verified=true after the user clicks their verify link,
      // so the app-level verification gate lifts on the next refresh.
      if (typeof payload.email_verified === "boolean") {
        emailVerified = payload.email_verified
      }
    } catch {
      // Keep existing values if token decode fails
    }
  }

  return {
    ...token,
    accessToken: refreshedTokens.access_token,
    refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    // id_token intentionally not persisted — see the jwt() callback note.
    idToken: undefined,
    expiresAt: refreshedTokens.expires_at
      ?? Math.floor(Date.now() / 1000) + (refreshedTokens.expires_in as number ?? 300),
    roles,
    registrationRole,
    emailVerified,
    error: undefined,
  }
}
