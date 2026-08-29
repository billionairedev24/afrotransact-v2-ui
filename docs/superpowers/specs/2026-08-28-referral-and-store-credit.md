# Referral & Store Credit — Design Spec

**Date:** 2026-08-28
**Status:** Approved design (defaults signed off) — ready for implementation planning
**Repos:** `refined` (config, order, user-profile, notification, accounting), `afrotransact-v2-ui`
**Risk:** money-critical — real credit that reduces charges. Final review on the most capable model.

Companion: [Account Hub & Orders Redesign](./2026-08-28-account-hub-and-orders-redesign.md)
(owns the Wallet hub section UI and the receipt referral-credit line).

---

## Goal

Ship a working, config-driven referral program: every user gets a personal referral link;
when someone signs up through it, both parties receive store credit; that credit
auto-applies at checkout; and when referral is on, it's promoted in our emails.

## Approved decisions

- **Trigger:** credit is granted when the referred user **signs up** through a referral link.
- **Amount:** admin sets **one amount**; **both** referrer and referred user receive it.
- **Redemption:** credit **auto-applies** at checkout, **capped at the order total** (no cash-out).
- **Config-driven:** admin toggles referral **on/off** and sets the **amount**.
- **Emails:** when referral is on, inject a referral block (link + reward) into our emails.

## Global Constraints

- **Money integrity:** every credit grant and redemption is **idempotent** and **append-only**
  (a ledger, never a mutable balance edited in place). Balance = sum of entries.
- **Guards (built in, not optional):** block self-referral (same account/email); **one grant
  per referred user**; referred user must be a **new** account created via the referral
  signup; redemption never exceeds order total; credit is non-transferable, no cash-out.
- **Disabled = inert:** when `referral_enabled` is false, no codes are promoted, no grants
  occur, no credit line shows. Existing balances remain redeemable (product may choose to
  freeze — default: still redeemable).
- **Java:** no inline fully-qualified class names; add imports.
- **Amounts in integer cents**, currency-aware (default USD).

---

## Architecture

Housing decision: **referral + store-credit ledger live in the `order` service** (it owns
checkout totals and already emits Kafka events accounting consumes), with **signup
attribution flowing from registration as an event**. Config lives in the `config` service.
No new microservice.

```
config svc ── referral_enabled, referral_reward_cents ──▶ order svc (reads at grant/redeem)
                                                          + admin UI toggle/amount

register (gateway/user-profile) ── user.registered{userId, referralCode?} ─▶ order svc
    order svc: validate code → guards → grant credit to referrer + referred (ledger) → emit
        referral.credit_granted → notification (email "you earned $X")

storefront ?ref=CODE ─▶ cookie atx_ref ─▶ included in register payload

checkout (order svc): total computed → auto-apply min(balance, total) → debit ledger →
    store store_credit_applied_cents on order → totals/receipt reflect it → accounting books
    it as a promotional/marketing expense (via enriched payment.completed)

cancel/refund ─▶ reverse the redeemed credit back to balance (ledger reversal entry)
```

### Data model (new migrations in `order` service)

- `referral.codes(user_id UUID PK, code TEXT UNIQUE, created_at TIMESTAMPTZ)` — minted on
  first request (Wallet/referral view). Code = readable slug + short random suffix.
- `referral.referrals(id UUID PK, referrer_user_id UUID, referred_user_id UUID UNIQUE,
  code TEXT, reward_cents INT, currency TEXT, status TEXT, created_at)` —
  `referred_user_id UNIQUE` enforces one grant per referred user. status: `granted` /
  `reversed`.
- `store_credit.entries(id UUID PK, user_id UUID, delta_cents INT, reason TEXT,
  ref_type TEXT, ref_id TEXT, order_number TEXT NULL, idempotency_key TEXT UNIQUE,
  created_at)` — append-only. `reason` ∈ {`referral_referrer`, `referral_referred`,
  `checkout_redeem`, `refund_reverse`, `admin_adjust`}. Balance = `SUM(delta_cents)`.
- `orders.orders` gains `store_credit_applied_cents INT NOT NULL DEFAULT 0`.

Idempotency keys: grant uses `referral:<referredUserId>` (per side, suffixed `:referrer` /
`:referred`); redeem uses `redeem:<orderNumber>`; reversal uses `reverse:<orderNumber>`.

### Config (config service, follows `pickup_settings.go` pattern)

- `referral_settings`: `{ enabled bool, reward_cents int, currency string }`.
- Migration + model + handler + admin endpoint (GET/PUT). Admin UI: a toggle + amount field.
- Default: `enabled=false`, `reward_cents=500` ($5), `currency=USD`.

### Signup attribution

1. **Frontend:** any landing with `?ref=<code>` sets cookie `atx_ref` (30-day, lax). The
   register form includes `atx_ref` as `referralCode` in the payload.
2. **Register path** (gateway `/auth/register` → user-profile): accept optional
   `referralCode`; after the account is created, emit `user.registered{ userId, email,
   referralCode }`.
3. **Order svc consumer** on `user.registered`:
   - no code, or `referral_enabled=false` → ignore.
   - resolve `referralCode` → referrer user; if not found, or `referrer == referred`, or
     emails match → ignore (self-referral / bad code).
   - if `referred_user_id` already in `referral.referrals` → ignore (idempotent).
   - else insert referral row + two `store_credit.entries` (referrer + referred, each
     `reward_cents`) atomically; emit `referral.credit_granted` for each side.

### Checkout redemption (order service)

- In the quote/checkout total computation: if `referral_enabled` and balance > 0, compute
  `applied = min(balance, orderTotalCents)`; surface it as a `storeCreditAppliedCents` line
  in the quote response so the frontend shows it (auto-applied, read-only).
- On order creation: within the same transaction that persists the order, insert a
  `checkout_redeem` entry (`delta = -applied`, idempotency `redeem:<orderNumber>`) and set
  `orders.store_credit_applied_cents = applied`. Never let the order persist with a redeem
  entry that isn't reflected on the order (single tx).
- Buy-now uses the same path (credit applies to the ephemeral order total).
- **Refund/cancel:** the existing refund flow reverses the redeemed credit — insert
  `refund_reverse` (`delta = +applied`, idempotency `reverse:<orderNumber>`).

### Accounting

Store-credit redemption reduces cash collected; book it as a **promotional/marketing
expense** (platform-funded), mirroring how coupon discounts are handled today. The enriched
`payment.completed` event order emits must include `storeCreditAppliedCents` so the
accounting consumer posts the marketing-expense leg and the ledger stays balanced. Referral
grants themselves are a liability accrual (credit owed) — book on `referral.credit_granted`
if product wants accrual accounting; **default: expense at redemption only** (simpler, matches
coupon treatment). Confirm with accounting owner during planning.

### Emails (notification service)

- When `referral_enabled`, add a **referral block** to the shared email footer/promo area
  (`templates/defaults.go`) — user's link + "Give $X, get $X" copy. Gate on the flag.
- New transactional email **"You earned $X in credit"** on `referral.credit_granted`
  (branded, same header/footer/social as other emails).

### Frontend (afrotransact-v2-ui)

- **Wallet & credit** hub section: `GET /api/v1/store-credit/me` (balance + entries) and
  `GET /api/v1/referral/me` (code, link, reward, referredCount). Renders the balance hero,
  the transaction list, and the referral link with Copy / Share. Hidden entirely when
  `referral_enabled` is false.
- **Referral capture:** a small client hook reads `?ref=` on landing and writes `atx_ref`.
- **Checkout:** render the auto-applied `storeCreditAppliedCents` as a green credit line in
  the order summary (read-only), consistent with the receipt.
- **Referral page** (`/referral`) updated to pull the real link + reward from the API instead
  of static copy.

---

## API surface (order service, buyer-authenticated)

- `GET /api/v1/referral/me` → `{ enabled, code, link, rewardCents, currency, referredCount }`
  (mints code on first call when enabled).
- `GET /api/v1/store-credit/me` → `{ balanceCents, currency, entries: [{ deltaCents, reason,
  orderNumber, createdAt }] }`.
- Redemption is internal to checkout (no public redeem endpoint — auto-applied).
- Admin (config svc): `GET/PUT` referral settings.

---

## Phasing (within this spec)

- **B1 — Config + admin:** referral settings (flag + amount) in config svc + admin toggle UI.
- **B2 — Codes + Wallet read:** code minting, `referral/me` + `store-credit/me`, Wallet UI,
  `?ref=` capture. No grants yet.
- **B3 — Grant on signup:** register emits `user.registered{referralCode}`; order consumer
  grants both sides with all guards; "you earned" email.
- **B4 — Redemption:** checkout auto-applies credit, order column + migration, totals +
  receipt line, refund reversal.
- **B5 — Emails + accounting:** referral promo block in emails (flag-gated); accounting books
  redemption as marketing expense.

## Testing (money-critical — expand coverage)

- Grant idempotency (replay `user.registered` → one grant); self-referral blocked; same-email
  blocked; disabled flag → no grant; config amount honored; one-grant-per-referred-user.
- Redemption caps at order total; balance never negative; buy-now path applies credit; single
  transaction (order + redeem entry commit together or not at all).
- Refund reverses exactly the redeemed amount; double-refund is idempotent.
- Accounting stays balanced with a store-credit redemption in the mix.
- Frontend: Wallet hidden when disabled; credit line shows at checkout; `?ref=` sets cookie
  and reaches register.

## Out of scope

- Cash-out / withdrawal of credit.
- Tiered/percentage rewards, referral leaderboards, expiry (can be added later — schema leaves
  room via `reason`/`status`).
- SMS/WhatsApp referral sharing (channels out of scope).
