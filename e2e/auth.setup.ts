import { test as setup, expect } from "@playwright/test"

/**
 * Logs in once through the real Keycloak flow and saves the session so the
 * authenticated visual tests don't have to drive the (slow, flaky) KC login UI
 * per-test — they reuse this storageState.
 *
 * PREREQUISITE: a Keycloak user must exist in the local realm. The realm seeds
 * NO users, so create one first (uppercase char required by the realm policy):
 *
 *   docker exec afrotransact-keycloak /opt/keycloak/bin/kcadm.sh \
 *     config credentials --server http://localhost:8180 --realm master \
 *     --user hello@afrotransact.com --password admin
 *   # then create-user + set-password Test1234 + add-roles admin,buyer,seller
 *
 * Override creds via TEST_USER / TEST_PASS env vars if needed.
 */
const authFile = "e2e/.auth/admin.json"
const USER = process.env.TEST_USER ?? "admin@afrotransact.com"
const PASS = process.env.TEST_PASS ?? "Test1234"

setup("authenticate", async ({ page }) => {
  setup.setTimeout(120_000)

  // Warm the app first so NextAuth CSRF/cookies are set, then hit the login
  // shim which client-side redirects to Keycloak.
  await page.goto("/")
  await page.goto("/auth/login?callbackUrl=/account")

  // Wait for the client-side redirect to land on the Keycloak login page.
  await page.waitForURL(/:8180\//, { timeout: 45_000 })
  await page.locator('input[name="username"]').waitFor({ state: "visible", timeout: 15_000 })

  await page.fill('input[name="username"]', USER)
  await page.fill('input[name="password"]', PASS)
  await Promise.all([
    page.waitForURL("**/account**", { timeout: 45_000 }),
    page.click('button[type="submit"], input[type="submit"]'),
  ])

  // Landing on /account (a protected route) confirms auth — an unauthenticated
  // visit would bounce to /auth/login. Confirm the session is populated, then
  // persist it.
  await expect(async () => {
    const res = await page.request.get("/api/auth/session")
    const body = await res.json()
    expect(body?.user).toBeTruthy()
  }).toPass({ timeout: 15_000 })
  await page.context().storageState({ path: authFile })
})
