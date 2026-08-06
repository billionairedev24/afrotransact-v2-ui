import { defineConfig, devices } from "@playwright/test"

/**
 * Visual-regression harness for the design-system / dark-mode work.
 * See docs/superpowers/specs/2026-08-03-design-system-dark-mode.md (§6).
 *
 * Baseline-first: run this against the CURRENT app to capture light baselines
 * BEFORE any token migration; afterwards every diff is measured against them.
 *
 * Local run:
 *   pnpm test:visual              # run, compare to committed baselines
 *   pnpm test:visual:update       # accept current render as new baseline
 *   pnpm exec playwright show-report   # browse screenshots + diffs
 *
 * Requires the app on http://localhost:3001 (auto-started via webServer if not
 * already running) and a seeded Keycloak user (see e2e/auth.setup.ts).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 60_000,
  expect: {
    // Product images are random (loremflickr in dev) and are masked out, but
    // allow a small tolerance for anti-aliasing/font hinting differences.
    // 0.02 absorbs product-card/image jitter on listing pages; a real palette
    // shift (what we guard against) changes a far larger fraction of pixels.
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" },
  },
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    // Stop CSS + carousel motion so screenshots are deterministic.
    reducedMotion: "reduce",
  },
  projects: [
    // 1. Log in once and persist the session for the authed project.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3001",
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
