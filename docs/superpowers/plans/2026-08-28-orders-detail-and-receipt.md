# Orders Detail + Buyer DTO Fix + Receipt PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.
> Steps use checkbox (`- [ ]`) syntax. This plan spans TWO repos — each task states its repo.

**Goal:** Fix the blank order-summary, redesign the order detail page to Amazon-standard, and
redesign the receipt PDF (real logo, ship-to, per-seller grouping, referral-credit line, real
date) with an on-demand download endpoint.

**Architecture:** Backend fields already exist (`OrderDto` declares the summary cents;
`orders.orders` stores them). The gap is in the mapper/read path and the presentation layers.
Receipt generation lives in `refined/services/notification/pdf/receipt.go`; order detail is
`afrotransact-v2-ui/app/(main)/orders/[orderNumber]/page.tsx`.

**Repos:** `refined` (order — Java 21 GraalVM Spring Boot; notification — Go),
`afrotransact-v2-ui` (Next.js). Java build: `JAVA_HOME=/Library/Java/JavaVirtualMachines/graalvm-jdk-21/Contents/Home ./mvnw -o test`.
The 4 pre-existing `ShippingRatesAggregatorTest` failures are unrelated/expected.

Spec: `docs/superpowers/specs/2026-08-28-account-hub-and-orders-redesign.md` (Orders detail +
receipt sections). Referral-credit line renders only when > 0 (referral spec populates it).

## Global Constraints

- Brand only (gold `#FFD400`, `brand-gold-ink`, `brand-green`); no Chrome grey/blue accent.
- Java: no inline fully-qualified class names — add imports.
- No fabricated data — render only real fields; DB values are authoritative.
- Receipt brand mark renders **offline/deterministically** (embedded asset, no network fetch).
- Pickup sub-orders must never show "on the way" — use `deliveryMethod`/`pickupLocation`.

---

### Task 1: Buyer OrderDto returns the full summary breakdown (refined/order, Java)

**Files:**
- `services/order/src/main/java/com/afrotransact/order/dto/OrderDto.java` (mapper `from(Order)`)
- Test: `services/order/src/test/java/com/afrotransact/order/dto/OrderDtoTest.java` (create or extend)

**Diagnosis leads:** `OrderDto` declares `subtotalCents/taxCents/shippingCostCents/discountCents/
totalCents`. `from(Order)` sets `subtotalCents` (line ~207). Verify whether `taxCents`,
`shippingCostCents`, `discountCents`, `totalCents` are ALSO set from the entity — the blank
order-summary in the UI indicates one or more are left at 0/unset on the buyer path. The DB
row for a real order confirms the columns are populated (subtotal 3610, tax 298, shipping 0,
total 3908), so the entity has the data.

- [ ] **Step 1:** Write a failing test: build an `Order` entity with subtotal=3610, tax=298,
  shipping=0, discount=0, total=3908; assert `OrderDto.from(order)` returns all five fields
  equal to the entity's values.
- [ ] **Step 2:** Run it; expect failure on whichever field(s) `from()` omits.
- [ ] **Step 3:** Fix `from(Order)` to set every summary field from the entity
  (`order.getTaxCents()`, `getShippingCostCents()`, `getDiscountCents()`, `getTotalCents()`,
  with the same null-guard pattern as subtotal).
- [ ] **Step 4:** Run the test (pass) + the order module build
  (`JAVA_HOME=… ./mvnw -o -pl . test` in the order service; ignore the 4 known
  `ShippingRatesAggregatorTest` failures).
- [ ] **Step 5:** Commit `fix(order): populate full summary breakdown on buyer OrderDto`.

---

### Task 2: Order detail page redesign (afrotransact-v2-ui, TS)

**Files:**
- `app/(main)/orders/[orderNumber]/page.tsx` (redesign in place)
- reuse `components/orders/status.tsx` (shared status helpers)

**Interfaces:**
- Consumes: `getOrderByNumber(token, orderNumber)` → `OrderDto` (now with all summary cents
  from Task 1); `SubOrderDto.deliveryMethod` + `pickupLocation`; `getStoreById` resolver.

- [ ] **Step 1:** Two-column Amazon-standard layout matching the approved Orders preview: left
  = delivery tracker + items **grouped by seller/sub-order** (store name via `getStoreById`,
  never a UUID); right = Order Summary (subtotal, shipping [`FREE` when 0], tax, discount when
  >0, referral credit when >0, total), shipping address, payment, Download receipt button.
- [ ] **Step 2:** Pickup-aware: pickup sub-orders show pickup state + location, not "on the
  way"; mixed orders show per-group. Reuse the fulfillment-shape logic from the confirmation
  page if present.
- [ ] **Step 3:** Verify the summary renders real numbers (no blanks) against a Task-1 DTO.
  `npx tsc --noEmit` clean.
- [ ] **Step 4:** Commit `feat(orders): amazon-standard order detail with real summary`.

---

### Task 3: Receipt PDF redesign (refined/notification, Go)

**Files:**
- `services/notification/pdf/receipt.go`
- Bundle asset: copy `afrotransact-v2-ui/public/brand/email-logo-white.png` into
  `services/notification/pdf/assets/` (or an `embed` package) and `//go:embed` it.
- Test: `services/notification/pdf/receipt_test.go` (golden/smoke)

- [ ] **Step 1:** Embed the real logo via `//go:embed`; draw it on the black header band
  (height ~10–12mm, left-aligned) replacing the text wordmark. Keep the text wordmark ONLY as
  a fallback if image registration fails. No network fetch for the brand mark.
- [ ] **Step 2:** Add Ship-to block beside Bill-to (`ReceiptData.ShipToName/ShipToAddress[]/
  ShipToPhone`, populated by the consumer from the order's shipping snapshot).
- [ ] **Step 3:** Group items by seller — add `SoldBy` to `ReceiptItem` (or grouped sections);
  render a store header before each group; house items read "Sold & shipped by AfroTransact".
- [ ] **Step 4:** Add `ReferralCreditCents` to `ReceiptData`; render a green `−$X.XX` line when
  > 0 (below discount, above the gold rule); omit when 0. Add a ✓ PAID badge + social footer
  (Instagram/LinkedIn/WhatsApp) matching `templates/defaults.go`.
- [ ] **Step 5:** Resolve the `TODO(receipt-time)`: render the real order date (fix
  `formatCustomerDateTime` tz/parse), keep `dateOnly` as fallback only.
- [ ] **Step 6:** Test: generate a receipt with ship-to, two sellers, a referral credit >0 and
  =0, and assert the PDF bytes are produced and non-empty (+ any golden assertions the repo
  supports). `go test ./services/notification/...` for the pdf package.
- [ ] **Step 7:** Commit `feat(notification): redesign receipt pdf (logo, ship-to, per-seller, credit)`.

---

### Task 4: On-demand receipt download endpoint + wire the button (refined + UI)

**Files:**
- refined: a buyer-authenticated endpoint returning the receipt PDF for an order the caller
  owns (order service `OrderController`, or notification service). Reuses `GenerateReceipt`.
- UI: `lib/api.ts` (helper) + replace the disabled "Receipt (PDF)" placeholder in
  `components/account/sections/OrdersSection.tsx` and the order detail page with a working
  download.

- [ ] **Step 1:** Add `GET /api/v1/orders/{orderNumber}/receipt` (owner-only; 403 for
  non-owners) returning `application/pdf`. Build `ReceiptData` from the order + shipping
  snapshot; call `GenerateReceipt`.
- [ ] **Step 2:** UI helper `downloadReceipt(token, orderNumber)` → fetch blob → trigger
  download. Wire both the list and detail buttons; remove the disabled placeholder.
- [ ] **Step 3:** Tests: owner gets 200 pdf, non-owner 403. `npx tsc --noEmit` clean.
- [ ] **Step 4:** Commit `feat(orders): on-demand receipt pdf download`.

---

### Task 5: Reviews-to-write (refined/review Python + UI)

**Files:**
- refined `services/review`: a buyer endpoint listing purchased-but-unreviewed items (reuse the
  existing eligibility logic — `reviews.py` already has `/eligibility/{product_id}` and a
  `CreateReviewRequest`).
- UI: `components/account/sections/ReviewsToWriteSection.tsx` + register in the hub.

- [ ] **Step 1:** Add `GET /api/v1/reviews/pending` (buyer) → delivered items not yet reviewed.
- [ ] **Step 2:** Build `ReviewsToWriteSection` (on-brand): list pending items with a star
  picker → submit via existing create-review path. Register in the hub `SECTIONS` after
  `preorders`, before `wallet` (always visible; empty state when nothing pending).
- [ ] **Step 3:** Tests + `npx tsc --noEmit` clean.
- [ ] **Step 4:** Commit `feat(reviews): reviews-to-write hub section + pending endpoint`.

---

## Self-Review notes

- Task 1 is a diagnosis-first task — write the failing test before assuming which fields are
  unset.
- Task 2 depends on Task 1's DTO fields; Task 4 depends on Task 3's `GenerateReceipt` shape.
- Receipt logo must be embedded (no network) — verify the PDF renders with the asset bundled.
- Money figures come only from the DTO/entity — never recompute or fabricate in the UI.
