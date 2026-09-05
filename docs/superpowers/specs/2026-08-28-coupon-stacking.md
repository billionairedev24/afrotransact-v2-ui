# Coupon Stacking — Design Spec

**Date:** 2026-08-28
**Status:** Approved design (preview signed off) — ready for implementation planning
**Repos:** `refined` (order, config, notification), `afrotransact-v2-ui`
**Risk:** money-affecting — controls how much discount a cart can accumulate. Careful review.

Companion: [Referral & Store Credit](./2026-08-28-referral-and-store-credit.md) — coupons and
referral credit both reduce the amount charged; the **order of operations** below is shared.

---

## Goal

Let a buyer apply more than one coupon at checkout, up to an **admin-configurable maximum
(default 2)**, through a clean "Have another coupon?" flow — while guaranteeing the platform
can never over-discount below cost.

## Approved preview

- Checkout coupon stacking — `artifact/6dbb6796-ba38-4b5f-b94e-9b20f88a9e30`

## Current state (what exists)

- `CheckoutRequest` already carries `List<String> couponCodes` (an inline FQN,
  `java.util.List` — **fix to an import** while here).
- `OrderService` (~L1582–1646) loops the codes but **applies only the first usable one, then
  `break`s** — it is a fallback list, not stacking. Discount is assigned, not accumulated.
- Coupons target `items` (reduce subtotal) or `shipping`. Redemption is recorded on **payment
  success** (`materializePaidOrder`), not at checkout — abandoned carts don't burn coupons.
- Auto-apply email-bound coupon runs only when no manual coupon was applied.
- `coupons_enabled` is a zone/region feature flag (already respected).

## Global Constraints

- **Never over-discount.** Total item-discount can never exceed the item subtotal; shipping
  discount never exceeds shipping. Running totals clamp at 0.
- **Sequential application** on the running (already-reduced) subtotal — a second percentage
  coupon discounts the reduced amount, not the original. This is the margin protection.
- **Max N is enforced server-side**, not just in the UI. The UI cap is convenience; the order
  service is the source of truth and rejects the (N+1)th.
- **Idempotent redemption**, per code, on payment success (unchanged model, extended to
  multiple codes).
- **Java:** no inline FQNs (fix the existing `java.util.List` one).
- Amounts in integer cents.

---

## Architecture

### Config (config service, `platform_features` / a small setting)

- `max_stackable_coupons` (int, default **2**). Admin sets it; 1 effectively disables
  stacking. Read by the order service at checkout and surfaced to the storefront (so the UI
  knows how many inputs to allow).
- Expose via the existing feature/settings surface the storefront already reads, alongside
  `coupons_enabled`.

### Coupon model (order service)

- Add `stackable BOOLEAN NOT NULL DEFAULT true` to the coupon entity (+ migration). A coupon
  marked `stackable=false` is **exclusive**: it can be the only coupon on the order. Existing
  coupons default to stackable so today's behavior (single coupon) still works.
- Admin/seller coupon CRUD forms gain the `stackable` toggle.

### Stacking algorithm (OrderService checkout total)

Replace the break-on-first loop with an accumulator:

```
max      = config.max_stackable_coupons   (default 2)
running  = subtotalCents
itemDisc = 0
shipDisc = 0
appliedCodes = []                          # ordered, de-duplicated (uppercased)
for code in dedupe(request.couponCodes):
    if len(appliedCodes) >= max: break     # server-side cap
    r = couponService.applyCoupon(code, ..., running, shippingCents, ..., record=false)
    if r == null: continue                 # invalid/ineligible → skip (surface error to UI)
    if coupon.exclusive and appliedCodes not empty: skip (reject: "can't combine")
    if any applied coupon exclusive:        reject further
    if r.target == 'shipping':
        d = min(max(0, r.discountCents), shippingCents - shipDisc)
        shipDisc += d
    else:
        d = min(max(0, r.discountCents), running)   # never below 0
        itemDisc += d
        running  -= d                        # sequential
    if d > 0 or r.target == 'shipping': appliedCodes.append(code)
discountCents = itemDisc
shippingCents = originalShipping - shipDisc
# auto-apply email coupon counts toward `max` and only if room remains and not exclusive
```

- `applyCoupon` is called with the **running** subtotal so eligibility/percentage math
  reflects prior coupons. Per-coupon minimum-spend is evaluated against the **original**
  subtotal (lenient, matches buyer expectation), but the discount is computed on the running
  amount.
- Tax stays computed on the post-discount subtotal (unchanged): `tax = round(max(0, subtotal
  - itemDisc) * rate)`.

### Order of operations at checkout (shared with referral spec)

1. **Deals** (line-item deal pricing) — already in item prices.
2. **Coupons** — stacked per above, reduce subtotal (and/or shipping).
3. **Tax** — on the discounted subtotal.
4. **Referral / store credit** — applied last, to the **final total** (post-tax), capped at
   that total. Coupons and credit never combine into a negative charge.

### Persistence + receipt

- Persist the **list** of applied coupon codes and each code's discount on the order/session
  (today only a singular `couponCode`/`discountCents` is stored). Add `orders.coupon_codes`
  (text[] or a child table) + keep the aggregate `discount_cents`. Redemption on payment
  success records **each** applied code (`recordCouponRedemption` per code).
- Receipt PDF: render **one line per applied coupon** (code + −amount) instead of a single
  coupon line. (Receipt redesign spec already adds the multi-line totals area.)

### Validate endpoint (order service)

- `POST /api/v1/coupons/validate` gains awareness of already-applied codes: accept
  `appliedCodes: string[]` (and the running subtotal) so it returns the **incremental**
  discount the new code would add, and rejects with a clear reason when the code is a
  duplicate, is exclusive, would exceed `max_stackable_coupons`, or isn't eligible.
- Response reuses `ValidateCouponResponse` (+ maybe `stackable`, `reason`).

### Frontend (CheckoutClientV2)

- Replace the single coupon field with the approved stacking UX:
  - Applied coupons render as green chips (code · what it does · −amount · remove).
  - One input + **Apply**; after applying, a **"＋ Have another coupon?"** control reveals the
    next input, up to `max_stackable_coupons`.
  - At the cap: hide the add control, show "You've applied the maximum of N coupons."
  - Inline, specific errors (invalid / already applied / can't be combined / max reached).
  - Order summary shows combined "Coupon savings" (or per-coupon lines) + a "You're saving
    $X" line.
- Validate each newly entered code against the backend **with the current applied set** so the
  displayed discount matches what checkout will actually compute. Never compute final money
  client-side as authoritative — the order service recomputes and is the source of truth.
- `max_stackable_coupons` comes from the same feature/config fetch as `coupons_enabled`.

---

## Testing (money-affecting)

- Two stackable coupons accumulate **sequentially** (2nd discounts the reduced subtotal);
  totals match hand-computed values.
- Cap enforced server-side: 3 codes with max=2 → only 2 applied; the storefront cap and the
  server cap agree.
- Exclusive coupon: can't combine (either direction); rejected with reason.
- Duplicate code ignored/rejected; casing normalized.
- Over-discount impossible: coupons totalling > subtotal clamp to subtotal; shipping coupon
  clamps to shipping; total never negative.
- Referral credit applies after tax on the post-coupon total, capped — combined with coupons
  never goes negative.
- Redemption records **every** applied code once, on payment success; abandoned checkout burns
  nothing; buy-now path stacks identically.
- Receipt shows one line per coupon.

## Out of scope

- Per-category / per-seller stacking rules beyond `stackable`/exclusive (future).
- Coupon-on-coupon "best combination" auto-optimization — we apply in the order entered.
