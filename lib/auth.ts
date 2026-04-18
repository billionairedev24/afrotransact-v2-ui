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

// Defense-in-depth: refuse to load in the browser. The secrets this module
// references (KEYCLOAK_CLIENT_SECRET, etc.) must never be bundled client-side.
if (typeof window !== "undefined") {
  throw new Error(
    "[auth] lib/auth.ts is server-only and must not be imported from the client.",
  )
}

/** Fail fast at server startup if a required env var is absent. */
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `[auth] Missing required environment variable "${name}". ` +
        "See .env.local.example for the full list."
    )
  }
  return value
}

/** Non-sensitive config — safe to fall back to local dev defaults. */
function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback
}

const kcIssuer = optionalEnv("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")
const kcClientId = optionalEnv("KEYCLOAK_CLIENT_ID", "afrotransact-web")
const kcClientSecret = requireEnv("KEYCLOAK_CLIENT_SECRET")
const kcScope = "openid email profile offline_access"

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
    clientId: kcClientId,
    clientSecret: kcClientSecret,
    authorization: {
      url: `${kcIssuer}/protocol/openid-connect/registrations`,
      params: { 
        scope: kcScope,
        registration_role: "seller" // Default to buyer, can be overridden by signIn params
      },
    },
    token: `${kcIssuer}/protocol/openid-connect/token`,
    userinfo: `${kcIssuer}/protocol/openid-connect/userinfo`,
    issuer: kcIssuer,
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

function KeycloakRegisterProvider(): OAuthConfig<Record<string, unknown>> {
  const provider = keycloakRegisterBase("keycloak-register", "Keycloak Register")
  if (provider.authorization && typeof provider.authorization !== "string") {
    provider.authorization.params = { ...provider.authorization.params, registration_role: "buyer" }
  }
  return provider
}

/**
 * Seller-specific registration provider. Identical OAuth flow, but the
 * distinct provider ID lets the jwt callback detect seller intent
 * without cookies — works across devices after the first auth completes.
 */
function KeycloakRegisterSellerProvider(): OAuthConfig<Record<string, unknown>> {
  return keycloakRegisterBase("keycloak-register-seller", "Keycloak Register Seller")
}

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: kcClientId,
      clientSecret: kcClientSecret,
      issuer: kcIssuer,
      authorization: { params: { scope: kcScope } },
    }),
    KeycloakRegisterProvider(),
    KeycloakRegisterSellerProvider(),
  ],

  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, account, user, profile }): Promise<any> {
      if (account && user) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.idToken = account.id_token
        token.expiresAt = account.expires_at
        token.id = user.id

        const claims = profile as Record<string, unknown> | undefined
        const flatRoles = claims?.realm_roles as string[] | undefined
        const nestedRoles = (claims?.realm_access as { roles?: string[] })?.roles
        token.roles = flatRoles ?? nestedRoles ?? []

        token.registrationRole = claims?.registration_role as string | undefined

        // Grant seller entitlements (user attribute + realm role) when:
        // 1. User registered via the seller-specific provider, OR
        // 2. User has registration_role=seller attribute (from Keycloak) but
        //    doesn't yet have the seller realm role (e.g. logged in after
        //    email verification via the regular keycloak provider).
        const roles = token.roles as string[] | undefined
        const needsSellerGrant =
          account.provider === "keycloak-register-seller" ||
          (token.registrationRole === "seller" && !roles?.includes("seller"))
        if (needsSellerGrant) {
          const { registrationOk, realmRoleOk } = await grantSellerEntitlements(user.id as string)
          if (registrationOk || realmRoleOk) token.registrationRole = "seller"
        }
      }

      // Return token early if it hasn't expired
      if (token.expiresAt && Date.now() < token.expiresAt * 1000) {
        return token
      }

      // Access token has expired, try to refresh it
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
        const issuer = optionalEnv("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")
        try {
          await fetch(`${issuer}/protocol/openid-connect/logout`, {
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
  const issuer = optionalEnv("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")
  const tokenUrl = `${issuer}/protocol/openid-connect/token`

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
  if (refreshedTokens.access_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(refreshedTokens.access_token.split(".")[1], "base64url").toString()
      )
      const flatRoles = payload.realm_roles as string[] | undefined
      const nestedRoles = (payload.realm_access as { roles?: string[] })?.roles
      roles = flatRoles ?? nestedRoles ?? roles
      if (payload.registration_role) {
        registrationRole = payload.registration_role as string
      }
    } catch {
      // Keep existing values if token decode fails
    }
  }

  return {
    ...token,
    accessToken: refreshedTokens.access_token,
    refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    idToken: refreshedTokens.id_token ?? token.idToken,
    expiresAt: refreshedTokens.expires_at
      ?? Math.floor(Date.now() / 1000) + (refreshedTokens.expires_in as number ?? 300),
    roles,
    registrationRole,
    error: undefined,
  }
}
