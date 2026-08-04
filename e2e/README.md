# Visual-regression harness (Playwright)

Baseline-first visual tests for the design-system / dark-mode work — see
`docs/superpowers/specs/2026-08-03-design-system-dark-mode.md` (§6). The idea:
capture **light-mode baselines of the current app**, then during the token
migration every diff is either confirmed-intended (re-baseline) or a bug.

## Run it

```bash
# App must be on http://localhost:3001 (the config auto-starts `pnpm dev` if not).
pnpm test:visual            # run + compare against committed baselines
pnpm test:visual:update     # accept the current render as the new baseline
pnpm test:visual:report     # open the HTML report (screenshots + diffs) in a browser
```

The HTML report (also written to `playwright-report/`) shows every route's
screenshot and, on a failing run, a side-by-side **expected / actual / diff**.

## What it covers

- **Public routes** (unauthenticated): home, category, PDP, cart, deals, help.
- **Authenticated routes** (admin session): account, orders, checkout, admin
  dashboard, seller dashboard.
- Screenshots are **viewport-only** (above-the-fold — the highest-value theming
  surface), with `<img>` masked, animations + motion disabled, and the promo
  popup + ticker stubbed out.

## Prerequisites

- **Backend running** (gateway `:8080`, Keycloak `:8180`) — `cd refined && docker compose up -d`.
- **A seeded Keycloak user.** The realm seeds **no** users, so create one (the
  realm password policy requires an uppercase char):

  ```bash
  KC="docker exec afrotransact-keycloak /opt/keycloak/bin/kcadm.sh"
  $KC config credentials --server http://localhost:8180 --realm master \
      --user hello@afrotransact.com --password admin
  $KC create users -r afrotransact -s username=admin@afrotransact.com \
      -s email=admin@afrotransact.com -s enabled=true -s emailVerified=true \
      -s firstName=Sammy -s lastName=Admin
  $KC set-password -r afrotransact --username admin@afrotransact.com --new-password Test1234
  for r in admin buyer seller; do $KC add-roles -r afrotransact --uusername admin@afrotransact.com --rolename $r; done
  ```

  Override creds with `TEST_USER` / `TEST_PASS` env vars. `e2e/auth.setup.ts`
  logs in once and saves the session to `e2e/.auth/admin.json` (git-ignored).

## Known limitation (follow-up)

Image-heavy **listing** routes (home / category / PDP) can flake by a few
percent because dev seed data serves **random `loremflickr` images** whose
load timing shifts card heights. `<img>` are masked and tolerance is set to 2%,
which absorbs a real palette shift (huge by comparison) but not perfectly the
card jitter. The durable fix is to **mock the catalog/promotions API** at the
network layer (`page.route`) so these pages render deterministic data — do this
before relying on them as hard gates in CI. The static/chrome-heavy routes
(account, orders, checkout, help, deals, admin/seller dashboards) are stable.

Dark-mode variants get added alongside the theme toggle (a second project /
`data-theme` state) once the migration lands.
