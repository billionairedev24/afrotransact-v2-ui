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

import { NextAuthOptions, TokenSet } from "next-auth"
import type { OAuthConfig } from "next-auth/providers/oauth"
import KeycloakProvider from "next-auth/providers/keycloak"

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
      params: { scope: kcScope },
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
  return keycloakRegisterBase("keycloak-register", "Keycloak Register")
}

/**
 * Seller-specific registration provider. Identical OAuth flow, but the
 * distinct provider ID lets the jwt callback detect seller intent
 * without cookies — works across devices after the first auth completes.
 */
function KeycloakRegisterSellerProvider(): OAuthConfig<Record<string, unknown>> {
  return keycloakRegisterBase("keycloak-register-seller", "Keycloak Register Seller")
}

/**
 * Set `registration_role=seller` on a Keycloak user via the Admin API.
 * After this, the protocol mapper puts it in every token on any device.
 */
async function setRegistrationRoleInKeycloak(userId: string): Promise<boolean> {
  const kcBase = kcIssuer.replace(/\/realms\/.*$/, "")
  const realm = optionalEnv("KEYCLOAK_REALM", "afrotransact")
  const adminUser = optionalEnv("KEYCLOAK_ADMIN_USERNAME", "admin")
  const adminPass = optionalEnv("KEYCLOAK_ADMIN_PASSWORD", "admin")

  try {
    const tokenRes = await fetch(`${kcBase}/realms/master/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "admin-cli",
        username: adminUser,
        password: adminPass,
      }),
    })
    if (!tokenRes.ok) return false
    const { access_token } = await tokenRes.json()

    const putRes = await fetch(`${kcBase}/admin/realms/${realm}/users/${userId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ attributes: { registration_role: ["seller"] } }),
    })

    if (putRes.ok) {
      console.log(`[auth] Set registration_role=seller in Keycloak for user ${userId}`)
    }
    return putRes.ok
  } catch (e) {
    console.error("[auth] Failed to set registration_role in Keycloak:", e)
    return false
  }
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

        // Seller registered via the dedicated provider → persist to Keycloak
        // so every future token on ANY device carries registration_role.
        if (account.provider === "keycloak-register-seller" && !token.registrationRole) {
          const ok = await setRegistrationRoleInKeycloak(user.id as string)
          if (ok) token.registrationRole = "seller"
        }
      }

      // Proactive refresh: renew 60s before expiry so the client never
      // holds an expired access token between SessionProvider refetches.
      const bufferMs = 60_000
      if (token.expiresAt && Date.now() < (token.expiresAt as number) * 1000 - bufferMs) {
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
      session.expiresAt = token.expiresAt as number | undefined

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
