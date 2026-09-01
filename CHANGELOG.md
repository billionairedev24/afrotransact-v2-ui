# Changelog

All notable changes to AfroTransact are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
This release spans the storefront (`afrotransact-v2-ui`) and the backend services (`refined`).

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

[0.2.0]: https://github.com/billionairedev24/afrotransact-v2-ui/compare/v0.1.0...v0.2.0
