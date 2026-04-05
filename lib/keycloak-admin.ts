/**
 * Keycloak Admin API helpers (server-only).
 * Used by NextAuth callbacks and /api/auth/become-seller.
 */

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback
}

/**
 * Obtains an admin token via the afrotransact-admin-api service account
 * (client_credentials grant, afrotransact realm). Scoped to manage-users only.
 * No master realm credentials are used.
 */
async function getKeycloakAdminAccessToken(): Promise<string | null> {
  const kcIssuer = optionalEnv("KEYCLOAK_ISSUER", "http://localhost:8180/realms/afrotransact")

  try {
    const tokenRes = await fetch(`${kcIssuer}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: optionalEnv("KEYCLOAK_ADMIN_API_CLIENT_ID", "afrotransact-admin-api"),
        client_secret: optionalEnv("KEYCLOAK_ADMIN_API_SECRET", "afrotransact-admin-api-secret"),
      }),
    })
    if (!tokenRes.ok) {
      if (process.env.NODE_ENV === "development") {
        const t = await tokenRes.text().catch(() => "")
        console.error("[keycloak-admin] Admin token fetch failed", tokenRes.status, t.slice(0, 200))
      }
      return null
    }
    const { access_token } = (await tokenRes.json()) as { access_token?: string }
    return access_token ?? null
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[keycloak-admin] Admin token fetch error", err)
    }
    return null
  }
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
    if (process.env.NODE_ENV === "development") {
      console.error("[keycloak-admin] No admin token — check KEYCLOAK_ADMIN_API_CLIENT_ID, KEYCLOAK_ADMIN_API_SECRET, and that the afrotransact-admin-api service account exists with manage-users role.")
    }
    return false
  }

  try {
    const getRes = await fetch(`${kcBase}/admin/realms/${realm}/users/${userId}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!getRes.ok) {
      if (process.env.NODE_ENV === "development") {
        const t = await getRes.text().catch(() => "")
        console.error("[keycloak-admin] GET user failed", getRes.status, t.slice(0, 200))
      }
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
    if (!putRes.ok && process.env.NODE_ENV === "development") {
      const t = await putRes.text().catch(() => "")
      console.error("[keycloak-admin] PUT user failed", putRes.status, t.slice(0, 300))
    }
    return putRes.ok
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[keycloak-admin] setRegistrationRoleSeller", e)
    }
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
      if (process.env.NODE_ENV === "development") {
        const t = await roleRes.text().catch(() => "")
        console.error(
          `[keycloak-admin] Realm role "${roleName}" missing or not readable (${roleRes.status}). Create it in Keycloak: Realm → Roles → Add role. `,
          t.slice(0, 200),
        )
      }
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
    if (!mapRes.ok && process.env.NODE_ENV === "development") {
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
