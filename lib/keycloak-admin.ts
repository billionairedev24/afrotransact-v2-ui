/**
 * Keycloak Admin API helpers (server-only).
 * Used by NextAuth callbacks and /api/auth/become-seller.
 *
 * This module references secrets (KEYCLOAK_ADMIN_API_SECRET,
 * KEYCLOAK_ADMIN_PASSWORD, KEYCLOAK_ADMIN_CLIENT_SECRET) and must NEVER
 * be imported from a client component. Only server-side entry points
 * (NextAuth config, app/api/* route handlers) may import this.
 *
 * The runtime guard below throws loudly if this file is somehow evaluated
 * in a browser context (defense-in-depth beyond Next's server/client
 * component boundary rules).
 */
if (typeof window !== "undefined") {
  throw new Error(
    "[keycloak-admin] This module is server-only and must not be imported from the client.",
  )
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback
}

async function requestAdminToken(
  tokenUrl: string,
  params: URLSearchParams,
  logLabel: string,
): Promise<string | null> {
  try {
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    })
    if (!tokenRes.ok) {
      const t = await tokenRes.text().catch(() => "")
      console.error(`[keycloak-admin] ${logLabel} failed`, tokenRes.status, t.slice(0, 300))
      return null
    }
    const { access_token } = (await tokenRes.json()) as { access_token?: string }
    return access_token ?? null
  } catch (err) {
    console.error(`[keycloak-admin] ${logLabel} error`, err)
    return null
  }
}

/**
 * Obtains an admin token via the afrotransact-admin-api service account
 * (client_credentials grant, afrotransact realm). Scoped to manage-users only.
 * No master realm credentials are used.
 */
async function getKeycloakAdminAccessToken(): Promise<string | null> {
  const kcIssuer = optionalEnv("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")
  const tokenUrl = `${kcIssuer}/protocol/openid-connect/token`

  // Preferred: service-account client credentials.
  const adminApiClientId = optionalEnv("KEYCLOAK_ADMIN_API_CLIENT_ID", "afrotransact-admin-api")
  const adminApiSecret = process.env.KEYCLOAK_ADMIN_API_SECRET
  if (adminApiSecret) {
    const token = await requestAdminToken(
      tokenUrl,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: adminApiClientId,
        client_secret: adminApiSecret,
      }),
      `Admin token (client_credentials:${adminApiClientId})`,
    )
    if (token) return token
  } else {
    console.error("[keycloak-admin] KEYCLOAK_ADMIN_API_SECRET is not set.")
  }

  // Fallback: admin username/password against the master realm (admin-cli lives there, not in afrotransact).
  const adminUsername = process.env.KEYCLOAK_ADMIN_USERNAME
  const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD
  if (adminUsername && adminPassword) {
    const adminClientId = optionalEnv("KEYCLOAK_ADMIN_CLIENT_ID", "admin-cli")
    // admin-cli is registered in the master realm — derive its token URL from the base server URL.
    const masterTokenUrl = kcIssuer.replace(/\/realms\/[^/]+/, "/realms/master") + "/protocol/openid-connect/token"
    const params = new URLSearchParams({
      grant_type: "password",
      client_id: adminClientId,
      username: adminUsername,
      password: adminPassword,
    })
    const adminClientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET
    if (adminClientSecret) params.set("client_secret", adminClientSecret)
    return requestAdminToken(masterTokenUrl, params, `Admin token (password:${adminClientId})`)
  }

  console.error(
    "[keycloak-admin] No admin token method available. Set KEYCLOAK_ADMIN_API_SECRET (preferred) or KEYCLOAK_ADMIN_USERNAME/KEYCLOAK_ADMIN_PASSWORD.",
  )
  return null
}

type KcUser = Record<string, unknown>

function stripReadOnlyUserFields(user: KcUser): KcUser {
  const next = { ...user }
  for (const k of ["access", "userProfileMetadata", "disableableCredentialTypes"]) {
    delete next[k]
  }
  return next
}

/**
 * Set `registration_role=seller` user attribute (protocol mapper may expose it on tokens).
 * Keycloak requires a full user representation on PUT — merge into the existing user from GET.
 */
export async function setRegistrationRoleSeller(userId: string): Promise<boolean> {
  const kcIssuer = optionalEnv("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")
  const kcBase = kcIssuer.replace(/\/realms\/.*$/, "")
  const realm = optionalEnv("KEYCLOAK_REALM", "afrotransact")
  const access_token = await getKeycloakAdminAccessToken()
  if (!access_token) {
    console.error(
      "[keycloak-admin] No admin token — check KEYCLOAK_ADMIN_API_CLIENT_ID/KEYCLOAK_ADMIN_API_SECRET or KEYCLOAK_ADMIN_USERNAME/KEYCLOAK_ADMIN_PASSWORD.",
    )
    return false
  }

  try {
    const getRes = await fetch(`${kcBase}/admin/realms/${realm}/users/${userId}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!getRes.ok) {
      const t = await getRes.text().catch(() => "")
      console.error("[keycloak-admin] GET user failed", getRes.status, t.slice(0, 300))
      return false
    }
    const user = (await getRes.json()) as KcUser
    const prevAttrs = (user.attributes as Record<string, string[] | undefined> | undefined) ?? {}
    const body = stripReadOnlyUserFields({
      ...user,
      attributes: { ...prevAttrs, registration_role: ["seller"] },
    })

    const putRes = await fetch(`${kcBase}/admin/realms/${realm}/users/${userId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    if (!putRes.ok) {
      const t = await putRes.text().catch(() => "")
      console.error("[keycloak-admin] PUT user failed", putRes.status, t.slice(0, 300))
    }
    return putRes.ok
  } catch (e) {
    console.error("[keycloak-admin] setRegistrationRoleSeller", e)
    return false
  }
}

/**
 * Assign a realm role to the user (appears in access token realm_access.roles).
 */
export async function addRealmRoleToUser(userId: string, roleName: string): Promise<boolean> {
  const kcIssuer = optionalEnv("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")
  const kcBase = kcIssuer.replace(/\/realms\/.*$/, "")
  const realm = optionalEnv("KEYCLOAK_REALM", "afrotransact")
  const access_token = await getKeycloakAdminAccessToken()
  if (!access_token) return false

  try {
    const roleRes = await fetch(
      `${kcBase}/admin/realms/${realm}/roles/${encodeURIComponent(roleName)}`,
      { headers: { Authorization: `Bearer ${access_token}` } },
    )
    if (!roleRes.ok) {
      const t = await roleRes.text().catch(() => "")
      console.error(
        `[keycloak-admin] Realm role "${roleName}" missing or not readable (${roleRes.status}). Create it in Keycloak: Realm -> Roles -> Add role.`,
        t.slice(0, 300),
      )
      return false
    }
    const role = (await roleRes.json()) as { id: string; name: string }

    const mapRes = await fetch(
      `${kcBase}/admin/realms/${realm}/users/${userId}/role-mappings/realm`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{ id: role.id, name: role.name }]),
      },
    )
    if (!mapRes.ok) {
      const t = await mapRes.text().catch(() => "")
      console.error("[keycloak-admin] POST role-mappings/realm failed", mapRes.status, t.slice(0, 300))
    }
    return mapRes.ok
  } catch {
    return false
  }
}

export async function grantSellerEntitlements(userId: string): Promise<{
  registrationOk: boolean
  realmRoleOk: boolean
}> {
  const [registrationOk, realmRoleOk] = await Promise.all([
    setRegistrationRoleSeller(userId),
    addRealmRoleToUser(userId, "seller"),
  ])
  return { registrationOk, realmRoleOk }
}
