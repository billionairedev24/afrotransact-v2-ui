import { test, expect, type Page } from "@playwright/test"

/**
 * Visual-regression baselines over the key surfaces, in the CURRENT (light)
 * theme. This is the anchor for the dark-mode token migration: after the
 * migration, every light-mode diff is reviewed and either confirmed-intended
 * (re-baseline) or a bug. Dark-theme variants get added when the toggle lands.
 *
 * Product images are random in dev (loremflickr), so all <img> are masked.
 */

// Dismiss dynamic overlays (promo email popup) so they don't flake screenshots.
async function settle(page: Page) {
  const noThanks = page.getByRole("button", { name: /no thanks/i })
  try {
    await noThanks.click({ timeout: 3000 })
  } catch {
    /* popup not shown this run — fine */
  }
  await page.waitForLoadState("networkidle").catch(() => {})
  // Wait for web fonts so text metrics are stable across runs.
  await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready)
}

async function shoot(page: Page, name: string) {
  await settle(page)
  // Viewport-only (not fullPage): the above-the-fold chrome (header/nav/hero/
  // first section) is the highest-value theming surface and is deterministic.
  // Full-page coverage over dynamic grids/rails is follow-up tuning (see README).
  await expect(page).toHaveScreenshot(`${name}.png`, {
    mask: [page.locator("img")],
  })
}

// Suppress non-deterministic marketing chrome — the delayed popup overlay (its
// backdrop covers ~half the page) and the animated scrolling ticker — so
// screenshots are stable. Static promos (HERO/FOOTER) are left intact.
test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/public\/promotions\?placement=(POPUP|TICKER)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ promotions: [] }),
    }),
  )
})

const PUBLIC_ROUTES: { name: string; path: string }[] = [
  { name: "home", path: "/" },
  { name: "category-food-grocery", path: "/category/food-grocery" },
  { name: "pdp", path: "/product/manupa-egusi-seeds-1lb" },
  { name: "cart", path: "/cart" },
  { name: "deals", path: "/deals" },
  { name: "help", path: "/help" },
]

const AUTHED_ROUTES: { name: string; path: string }[] = [
  { name: "account", path: "/account" },
  { name: "orders", path: "/orders" },
  { name: "checkout", path: "/checkout" },
  { name: "admin-dashboard", path: "/admin" },
  { name: "seller-dashboard", path: "/dashboard" },
]

test.describe("visual — public (unauthenticated)", () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  for (const r of PUBLIC_ROUTES) {
    test(`light: ${r.name}`, async ({ page }) => {
      await page.goto(r.path)
      await shoot(page, `light-${r.name}`)
    })
  }
})

test.describe("visual — authenticated (admin)", () => {
  test.use({ storageState: "e2e/.auth/admin.json" })
  for (const r of AUTHED_ROUTES) {
    test(`light: ${r.name}`, async ({ page }) => {
      await page.goto(r.path)
      await shoot(page, `light-${r.name}`)
    })
  }
})
