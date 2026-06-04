/**
 * Keycloak issuer URLs resolved at module load.
 *
 * - `kcIssuerPublic` — matches what browsers use / what Keycloak advertises as `iss`.
 * - `kcIssuerServer` — host the Next.js process uses for tokens, JWKS, admin REST API.
 *
 * In split-horizon setups (Docker, K8s, split DNS), `KEYCLOAK_ISSUER_SERVER`
 * overrides the server-side host while keeping `KEYCLOAK_ISSUER` public-facing.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "[keycloak-issuers] This module is server-only and must not be imported from the client.",
  )
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback
}

export function normalizeRealmIssuer(v: string): string {
  return v.trim().replace(/\/+$/, "")
}

export const kcIssuerPublic = normalizeRealmIssuer(
  optionalEnv("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact"),
)

export const kcIssuerServer = normalizeRealmIssuer(
  (process.env.KEYCLOAK_ISSUER_SERVER || "").trim() || kcIssuerPublic,
)
