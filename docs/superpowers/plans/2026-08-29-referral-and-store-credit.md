# Referral & Store Credit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> Steps use checkbox (`- [ ]`). This plan spans repos — each task names its repo/service.

**Goal:** A working, config-driven referral program: every user gets a personal referral
link; when someone signs up through it, both parties get store credit; credit auto-applies
at checkout; and when referral is on, it's promoted in our emails.

**Architecture:** Config (on/off + amount) lives in the `config` service. Referral codes,
attribution, and the append-only store-credit ledger live in the `order` service. Signup
attribution flows in via a `user.registered{referralCode}` event. Redemption happens inside
checkout total computation. Emails via `notification`. Accounting books redemption as a
marketing expense.

**Repos/services:** `refined` (config[Go], order[Java], notification[Go], accounting[Java]),
`afrotransact-v2-ui` (Next.js). Java build: `JAVA_HOME=/Library/Java/JavaVirtualMachines/graalvm-jdk-21/Contents/Home ./mvnw -o test`.

Spec (authoritative — read it): `docs/superpowers/specs/2026-08-28-referral-and-store-credit.md`.

## Global Constraints

- **Money integrity:** every grant and redemption is **idempotent** and **append-only** (a
  ledger; balance = SUM(delta)). Never mutate a balance in place.
- **Guards (built in):** block self-referral (same account/email); ONE grant per referred
  user (`referred_user_id UNIQUE`); referred user must be a NEW account created via the
  referral signup; redemption never exceeds order total; credit non-transferable, no cash-out.
- **Disabled = inert:** `referral_enabled=false` → no codes promoted, no grants, no credit
  line. Existing balances remain redeemable.
- Amounts in integer cents; currency-aware (default USD).
- Java: no inline fully-qualified class names — add imports.
- Decisions (locked): trigger = referred user **signs up**; **one** admin amount, **both**
  sides receive it; redemption **auto-applies, capped at order total**.

---

### Task 1 — Config: referral settings (refined/config, Go)

**Files:** `services/config/model/referral_settings.go`, `services/config/handler/referral_settings.go`,
a migration under `services/config/migrations/`, wire the route in the config router; test.

- Settings: `{ enabled bool (default false), reward_cents int (default 500), currency string (default "USD") }`.
- `GET /api/v1/config/referral-settings` (public-readable so storefront + order can read the
  flag/amount) and admin `PUT` (admin-guarded like other settings). Follow the existing
  `pickup_settings.go` pattern exactly (model + handler + migration + registration).
- [ ] Failing test → implement model+handler+migration → test green → `go build/test ./...` → commit
  `feat(config): referral settings (enabled + reward amount)`.

### Task 2 — Admin referral settings UI + storefront flag (afrotransact-v2-ui)

**Files:** admin settings page/section; `lib/api.ts` helpers `getReferralSettings`/`updateReferralSettings`.

- Admin: a toggle (on/off) + reward amount ($) field, saving via the config PUT. Match existing
  admin settings styling.
- Storefront: `getReferralSettings()` (public) so the account hub Wallet + `?ref=` capture know
  if referral is enabled and the amount.
- [ ] tsc clean → commit `feat(admin): referral settings UI + storefront flag read`.

### Task 3 — Order: referral + store-credit schema (refined/order, Java)

**Files:** Flyway migration in `services/order/src/main/resources/db/migration/` (next V##);
JPA entities + repositories.

- Tables (schemas `referral`, `store_credit`): `referral.codes(user_id PK, code UNIQUE, created_at)`;
  `referral.referrals(id PK, referrer_user_id, referred_user_id UNIQUE, code, reward_cents,
  currency, status, created_at)`; `store_credit.entries(id PK, user_id, delta_cents, reason,
  ref_type, ref_id, order_number NULL, idempotency_key UNIQUE, created_at)`.
- Entities + repos; a `StoreCreditService.balanceOf(userId)` = `SUM(delta_cents)`.
- [ ] Migration test / repo test → build → commit `feat(order): referral + store-credit schema`.

### Task 4 — Order: referral code + Wallet read endpoints (refined/order, Java)

**Files:** `ReferralService`, `StoreCreditService`, controller endpoints; tests.

- `GET /api/v1/referral/me` (buyer) → `{ enabled, code, link, rewardCents, currency, referredCount }`;
  mints a stable code (readable slug + short suffix) on first call when enabled.
- `GET /api/v1/store-credit/me` (buyer) → `{ balanceCents, currency, entries[] }`.
- Reads `referral_enabled`/`reward_cents` from the config service (add a config-client call).
- [ ] Tests (mint idempotent; disabled → no code) → build → commit `feat(order): referral/me + store-credit/me`.

### Task 5 — Wallet section (real data) + `?ref=` capture (afrotransact-v2-ui)

**Files:** `components/account/sections/WalletSection.tsx` (replace coming-soon with real data);
a small `?ref=` capture hook; `lib/api.ts` helpers.

- Wallet: fetch `store-credit/me` + `referral/me`; render balance hero, ledger list, referral link
  + Copy/Share. Hidden/empty when `enabled=false`.
- `?ref=<code>` on any landing → cookie `atx_ref` (30-day, lax); included in the register payload.
- [ ] tsc clean → commit `feat(account): wallet real data + referral link + ?ref capture`.

### Task 6 — Grant on signup (refined: register path + order consumer, Java/Go)

**Files:** register path (gateway `/auth/register` → user-profile) emits `user.registered{userId,
email, referralCode?}`; order Kafka consumer for `user.registered`.

- Consumer: no code / disabled → ignore. Resolve `referralCode` → referrer; ignore if not found,
  self-referral (referrer==referred or same email), or `referred_user_id` already granted
  (idempotent). Else insert referral row + TWO `store_credit.entries` (referrer + referred, each
  `reward_cents`) atomically; emit `referral.credit_granted` per side.
- [ ] Tests: grant idempotency (replay → one grant); self-referral blocked; disabled → no grant;
  amount honored. Build → commit `feat(referral): grant credit to both sides on referral signup`.

### Task 7 — Emails: "you earned" + referral promo block (refined/notification, Go)

**Files:** `services/notification/consumer` (handle `referral.credit_granted`), `templates/`.

- New branded "You earned $X in credit" email on `referral.credit_granted`.
- When `referral_enabled`, inject a referral block (user's link + "Give $X, get $X") into the
  shared email footer/promo area (`templates/defaults.go`), flag-gated.
- [ ] go build/test → commit `feat(notification): referral earned email + promo block`.

### Task 8 — Checkout redemption + receipt line + refund reversal (refined/order, Java)

**Files:** `OrderService` checkout total path; migration adding `orders.store_credit_applied_cents`;
receipt/DTO; refund path.

- In the quote/checkout total: if enabled and balance>0, `applied = min(balance, orderTotalCents)`
  (AFTER coupons + tax, per the shared order-of-operations); surface `storeCreditAppliedCents` in the
  quote response. On order creation, within one tx insert a `checkout_redeem` entry
  (`delta=-applied`, idempotency `redeem:<orderNumber>`) + set `store_credit_applied_cents`.
- Refund/cancel → `refund_reverse` entry (`delta=+applied`, idempotency `reverse:<orderNumber>`).
- Surface `referralCreditCents`/`storeCreditAppliedCents` on OrderDto + receipt (the receipt renderer
  already has the line).
- [ ] Tests: cap at total; buy-now applies; single-tx; refund reverses exactly once. Build → commit
  `feat(order): auto-apply store credit at checkout + refund reversal`.

### Task 9 — Accounting: book redemption as marketing expense (refined/accounting, Java)

**Files:** accounting `PaymentEventConsumer` (or wherever enriched payment.completed is consumed).

- The enriched `payment.completed` event carries `storeCreditAppliedCents`; post a marketing/
  promotional-expense leg so the ledger stays balanced (mirror coupon-discount handling).
- [ ] Test: a store-credit redemption keeps the ledger balanced. Build → commit
  `feat(accounting): book store-credit redemption as marketing expense`.

---

## Prod config to flag on completion
- The order service reads referral settings from config — ensure the config route is reachable.
- Any new internal calls reuse existing internal-secret wiring; list any new env in the report.

## Self-Review notes
- Ledger is append-only; balance derived; idempotency keys on every entry.
- Redemption applies AFTER coupons + tax, capped at total (shared order-of-operations with coupons).
- Disabled flag makes the whole feature inert.
- Money-critical: final review on the most capable model; adversarial verification of the grant +
  redemption + refund-reversal math.
