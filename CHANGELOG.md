# Changelog

All notable changes to AfroTransact are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
This release spans the storefront (`afrotransact-v2-ui`) and the backend services (`refined`).

## [0.4.0] - 2026-09-03

A hardening, reliability, and performance release. It closes P0 money-safety
gaps in the seller-payout and refund paths, makes cross-service events durable
(transactional outbox + dead-letter queues), tightens authorization, cuts
read-path latency on the hottest buyer surfaces, and begins carving the
overgrown order service apart. No feature changes to the buyer flow; behavior
is preserved throughout.

### Money safety (backend)

- **Seller payouts can no longer double-pay.** The nightly settlement moved the
  Stripe transfer out of the big database transaction: a batch is committed in a
  `transferring` state (excluded from re-bundling) *before* the transfer, keyed
  with a deterministic idempotency key, and a reconcile pass adopts or requeues
  any batch left stranded by a crash.
- **Admins are alerted when a payout batch fails**, with a CSV of every transfer
  in the batch attached.
- **Payouts now reconcile to the ledger** (`seller_payable` is debited when cash
  actually transfers, not just credited at sale).
- **Refunds are idempotent** — a redelivered `payment.refunded` can't
  double-count a sub-order refund.

### Event durability & reliability (backend)

- **Transactional outbox** in the payment and order services + **standardized
  dead-letter queues** across payment and accounting, so a broker blip can never
  silently drop a ledger posting or an order confirmation, and poison messages
  are quarantined instead of retried-then-skipped.
- **Accounting is order-independent** for `payment.completed` (flat events park
  and drain instead of being dropped).

### Security & authorization

- **Exact admin-role checks** (a substring test let `store-admin` /
  `admin-readonly` through); **internal endpoints are no longer externally
  reachable** through the gateway; and the storefront **CSP drops
  `'unsafe-eval'` in production**.

### Performance

- Killed the biggest N+1s: the **buy-box grid** (~120–160 queries/page → ~4–5),
  the **buyer order list**, and the **home rails** (30+ serial catalog
  round-trips → 2–3). Added catalog **HTTP caching**, ledger **composite
  indexes**, chart-of-accounts / Stripe-customer **caches**, **concurrent
  receipt-thumbnail** fetching, and configurable **Kafka consumer concurrency**.
- **PDP images** now served through `next/image` (avif/webp, sized, prioritized).

### Storefront

- **Order detail: one delivery tracker, per-item status.** Multi-seller orders
  showed a duplicate-looking timeline per seller; there is now a single
  order-level tracker, with each item showing its own fulfillment status.
- **Admin email templates page** reworked so selecting a group no longer hides
  the others, every template (including the seller-payout-failed admin alert) is
  visible, with search + UI/UX polish.
- **Admin users** now show each user's email and phone number masked with a show/hide eye toggle, so admins can reach out as needed.

### Architecture (groundwork)

- Extracted the checkout↔order boundary in code (`OrderMaterializer` seam,
  `CheckoutOrchestrator` facade, internal coupon/store-credit facades) — the
  contracts the checkout and promotions services will later be split along. No
  behavior change.

### Operational notes

- No new required secrets. One new Kafka topic
  (`platform.settings.events.DLT`); the outbox tables + indexes apply via Flyway
  on deploy. See `docs/next-release-0.4.0-config-and-secrets.md` (refined).

## [0.3.0] - 2026-09-02

Follow-up release refining the 0.2.0 work from live testing: store-credit
visibility across every surface, a reworked sign-out that reliably sticks, the
seller onboarding path unblocked, receipt/email polish, and the address
autocomplete migrated to Google's new Places API.

### Storefront (`afrotransact-v2-ui`)

**Auth & sign-out**
- Reworked sign-out to be reliable and final. It now lands on a dedicated,
  inert `/auth/signed-out` page that is exempt from every
  auto-re-authentication path (the session guard, the post-login seller
  redirect, and the login page's auto sign-in), so a still-warm Keycloak SSO
  can no longer silently re-log the user in and bounce them back into the app.
- Converted the remaining sign-out controls (seller onboarding header, seller
  dashboard shell) from button + click handlers to real links — the synthetic
  click was unreliable and silently did nothing.
- Automatic re-auth call sites (seller onboarding, order detail) now go through
  a guarded sign-in wrapper that stands down during a short post-sign-out
  window, as defense in depth.
- Auto-recovery from the transient "We couldn't sign you in" (OAuth
  state-mismatch) error caused by two overlapping sign-in flows sharing one
  NextAuth state cookie: the login page now silently retries once instead of
  dead-ending.

**Store credit visibility**
- Order detail page shows "Store credit applied" and "You paid" (card charge =
  total − credit).
- Admin orders list Total column reflects the amount actually charged when
  house-funded store credit was applied (gross struck through), matching the
  order drawer and the customer receipt.

**Seller onboarding**
- Fixed the storefront landing-page "flash" before the locked onboarding
  screen — a signed-in seller now sees a brief redirect spinner instead of the
  home page painting and being yanked away.

**Address autocomplete (all address fields)**
- Migrated the shared address field from the deprecated
  `google.maps.places.Autocomplete` to the supported `PlaceAutocompleteElement`,
  loaded via the async `importLibrary` pattern (clears both the "loaded without
  loading=async" and the Autocomplete-deprecation console warnings). One shared
  component, so onboarding, the seller store, checkout, and admin pickup are all
  migrated at once.
- Rendered as a normal bordered address input (no search-bar magnifier),
  matching its sibling fields, with inline prediction and prefill preserved.
- Added `https://places.googleapis.com` to the CSP `connect-src` so the new
  Places API requests are not blocked.
- Hid the scrollbar on the "Add a new address" checkout modal.

**Other**
- Deliver-to label prefers city/state over a bare postal code.

### `order-service`
- The downloaded PDF receipt now includes redeemed store credit and the amount
  charged. The order service builds the `ReceiptData` it sends to the
  notification service and was omitting `store_credit_applied_cents`.

### `notification-service`
- Emailed PDF receipts render product thumbnails again: some CDN WebP images
  decode to 16-bit depth, which gofpdf rejects, so the thumbnail silently
  vanished — they are now re-encoded to 8-bit before embedding.
- Emailed receipt and confirmation show "Store credit applied" and "Amount
  charged" rows when house-funded credit is redeemed.
- Email footer uses branded Instagram / LinkedIn / WhatsApp icons, referenced
  via the environment-aware base URL (localhost in dev, the prod domain in
  prod) instead of a hardcoded domain.
- Internal admin order alert shows the order date only (no clock time).

### `seller-service`
- Unblocked seller onboarding start, which was returning 500 with a duplicate-
  key violation on `uk_sellers_business_name_ci`. The case-insensitive unique
  indexes on `business_name` and `contact_email` are now PARTIAL (excluding
  blank/NULL), so a new seller row created before the business name is entered
  no longer collides with another blank-name row (migration `V27`).

### Keycloak theme
- The email-verification link now shows "Verification successful — Your email
  address has been verified" instead of the generic "Your account has been
  updated."
- Removed the duplicate second "Email verified" app screen after verification —
  the Keycloak success page now continues straight to sign-in.

### Email brand assets
- Added Instagram (gradient), LinkedIn, and WhatsApp brand-icon PNGs under the
  storefront's `public/brand/` for the email footer (served from the
  storefront domain).

### Deployment notes
- The CSP change (`places.googleapis.com`) ships with the storefront build — no
  secret.
- The Google Maps API key was rotated: set the new value in
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (local `.env.local` + prod secret) or maps
  won't load. "Places API (New)" must be enabled on the Google Cloud project
  and present in the key's API-restriction allowlist.
- `seller-service` migration `V27` runs automatically on deploy (Flyway).
- The email footer icons must be deployed with the storefront (committed to
  `public/brand/`), and `notification-service` needs `APP_BASE_URL` /
  `FRONTEND_URL` set to the prod storefront URL (already required for existing
  footer links).

## [0.2.0] - 2026-09-01

### Added
- **Referrals & Wallet (store credit).** Refer-a-friend links with `?ref` capture at sign-up; both parties earn store credit on a successful, abuse-guarded signup. A Wallet in the account area shows real balance and history. Store credit applies at checkout (no double-spend), reverses on refunds, and books in accounting as house contra-revenue. Admin controls for enable/amount/max-per-user, plus a "referral earned" email.
- **Mixed-cart pickup fulfillment.** Buyers can choose store pickup per seller alongside shipping in one cart; real buyer→store distance at checkout, with pickup coordinates auto-geocoded from the store address in admin.
- **Coupon stacking.** Apply multiple coupons per order with admin-configurable limits, surfaced in the checkout UI.
- **Account → Login & Security.** Active-devices view (device, location, last activity) with one-click remote sign-out of other devices.
- **Returns.** Real return-photo upload.

### Changed
- **Mandatory email verification.** Accounts (buyer and seller) must verify their email before using the app, enforced by an app-side verify gate.
- **Sign-out** now fully clears the app session *and* the Keycloak SSO cookie, enabling real account switching (no silent auto-login); remote sign-out of other devices now takes effect within ~1–2 minutes.
- **Checkout & payments.** Card entry moved into the sticky order summary; one clear order-level delivery fee; store credit applied and the exact charge shown.
- **Search.** Precise matching — short queries no longer surface unrelated products.
- **Deliver-to** shows the city name (e.g. "Georgetown, TX") instead of a bare ZIP.
- **Account** — comprehensive, editable profile (name, phone, member-since); removed unused sections.
- **Platform** — upgraded Keycloak 26.2.5 → 26.7.3 and retired the custom event-listener SPI (verification & seller onboarding are now app-side); bumped Next.js to 16.3.3.
- **UI polish** — redesigned listing pagination and seller strip; steadier top bars; WebP receipt thumbnails.

### Fixed
- Intermittent "We couldn't sign you in" (OAuth state-cookie) errors on login and registration.
- "Save this card" wiped entered card details; a false "Placing order…" spinner appeared when toggling it.
- Sheet/drawer overlays: fixed an extra gap above the close button (overlays now portal to `<body>` so parent layout spacing can't shift them) and hid the scrollbar while keeping scroll smooth.
- Server-side validation across data-entry forms; malformed emails rejected at registration with inline errors (no stuck spinners).
- `login_sessions` migration version collision (V10 → V13); stale shipping/invite tests.

### Security
- Email-verification gate blocks all app access until verified (buyer and seller).
- Full clean sign-out clears the Keycloak SSO cookie, so a signed-out device cannot be silently re-authenticated.
- Remote sign-out of other devices; shortened access-token lifespan (300s → 60s) for faster revocation.

### Deployment notes
- Ship the storefront and Keycloak together — the app-side verify gate must be live when the realm switches to the app-enforced model.
- The Keycloak realm update runs automatically on deploy via `import-realm.sh` (`verifyEmail=false`, remove the retired SPI listener/action, shorter access-token lifespan).
- No new secrets required; SMTP is already configured.

[0.3.0]: https://github.com/billionairedev24/afrotransact-v2-ui/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/billionairedev24/afrotransact-v2-ui/compare/v0.1.0...v0.2.0
