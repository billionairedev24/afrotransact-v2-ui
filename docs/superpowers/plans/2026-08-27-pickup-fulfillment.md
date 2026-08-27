# Pickup & Mixed-Cart Fulfillment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** A free **Pickup** fulfillment method chosen **per fulfillment group** (per store/origin): $0 shipping, `delivery_method=pickup`, Ready-for-pickup→Picked-up statuses (no carrier label), pickup address in notifications. Mixed carts pick pickup/delivery per group independently.

**Architecture:** Config holds a platform pickup location. Order-service injects a synthetic Pickup option ($0) into each store's shipping-quote group when pickup is enabled and the buyer is in range; checkout selects per group; order creation writes `delivery_method`/`shipping_cost` per sub-order; fulfillment adds pickup statuses; notifications branch on `delivery_method`.

**Tech Stack:** refined — Java 21 (Graal) Spring Boot services `config`, `order`; Go `notification`. Frontend — Next.js 16 + React 19 + TS + Tailwind/shadcn (`afrotransact-v2-ui`). Build: `./mvnw -o` (Java, `JAVA_HOME=/Library/Java/JavaVirtualMachines/graalvm-jdk-21/Contents/Home`), `go build/test` (Go), `npx tsc --noEmit` (frontend).

## Global Constraints
- Money = integer cents (`long`/`BIGINT`). Package `com.afrotransact.<svc>`. NO inline FQNs.
- Ship-only orders must behave **exactly as today** (regression guard on every order/quote change).
- Pickup appears ONLY when config `pickup_enabled` AND the store has a pickup location AND the buyer is in range; otherwise Pickup is absent or shown disabled with a reason.
- Pickup sub-order ⇒ `shipping_cost_cents = 0`, `delivery_method = "pickup"`, pickup-location snapshot, no carrier label bought.
- Brand tokens only on the frontend (Inter/Fraunces, gold/green/black, shadcn, the checkout card/radio pattern); match the approved preview; responsive; light+dark; a genuine "Powered by Stripe" secure-payment badge.
- Admin can mark any pickup sub-order picked up; a seller can mark ONLY their own store's sub-orders (authorization by store ownership).

## Execution order
Backend (refined) first — config → order model/eligibility → quote injection → per-group checkout/order-creation → fulfillment statuses → notification — then the frontend checkout UI (v2-ui), which consumes the per-group quotes + request. Two branches: `feat/pickup-fulfillment` (refined), `feat/pickup-checkout-ui` (v2-ui).

---

### Task 1 — Config: platform pickup settings
**Repo:** refined `services/config`.
**Files:** the config model/endpoint that serves platform settings; add `pickup_enabled` (bool) + `pickup_location` (name, line1, line2, city, region, postalCode, country, hours, instructions). Admin-settable via the existing config admin endpoint; served on the public/config read the order + frontend already consume.
- [ ] Add the settings (migration/seed if config is DB-backed, or the settings model). Default `pickup_enabled=false`, empty location.
- [ ] Expose on the config read endpoints order-service + frontend use.
- [ ] Test: settings round-trip (set → read).
- [ ] Commit `feat(config): platform pickup settings (enabled + location)`.

### Task 2 — Order: `delivery_method` + pickup snapshot on SubOrder
**Repo:** refined `services/order`.
**Files:** `model/SubOrder.java`, a Flyway migration.
- [ ] Migration: add `delivery_method VARCHAR(10) NOT NULL DEFAULT 'ship' CHECK (delivery_method IN ('ship','pickup'))` and nullable pickup snapshot columns (`pickup_location_json` TEXT or discrete columns) to `sub_orders`.
- [ ] Entity: `deliveryMethod` (default "ship") + pickup snapshot field(s).
- [ ] Test (Testcontainers if the module has it, else mapping test): default is "ship"; pickup value persists.
- [ ] Commit `feat(order): delivery_method + pickup snapshot on sub-order`.

### Task 3 — Order: pickup eligibility + config client
**Repo:** refined `services/order`.
**Files:** `PickupEligibilityService` (new), a client/read for the config pickup settings.
- [ ] `PickupSettings` fetch (from config service — reuse the existing config client pattern in order). `PickupEligibilityService.isEligible(storeId, buyerAddress) -> {eligible, reason, location}`: eligible when pickup_enabled + a pickup location exists for the store (v1: the single platform location applies to the house store; sellers out-of-scope location = not eligible) + buyer within range. **v1 range**: a configured radius (miles) OR a serviceable postal-code/region allowlist — pick the simplest that the address data supports; document it; pluggable.
- [ ] Test: eligible (enabled + location + in range), not-enabled, no-location, out-of-range (each returns the right reason).
- [ ] Commit `feat(order): pickup eligibility service + config settings client`.

### Task 4 — Order: inject Pickup option into shipping quotes (per group)
**Repo:** refined `services/order`.
**Files:** `OrderService.getShippingQuotes` (~L533) / `ShippingRatesAggregator` — quotes already group per `storeId`.
- [ ] For each store group, if `PickupEligibilityService.isEligible`, prepend a synthetic Pickup `ShippingQuoteOption` (`quoteId="pickup:"+storeId`, carrier/serviceName "Pickup"/"Collect in person", `amountCents=0`, an ETA/"ready in ~2h") carrying the pickup address (add fields to the option DTO if needed, or a parallel map in the response). When enabled-but-out-of-range, include a disabled marker + reason (or a `shipmentHints`/eligibility field the UI reads) so the UI can show "Pickup unavailable — <reason>".
- [ ] ALL existing carrier/synthetic options remain unchanged (ship path regression).
- [ ] Test: enabled+in-range group has a `pickup:*` $0 option; disabled/out-of-range does not (or carries the reason); existing options untouched.
- [ ] Commit `feat(order): inject free Pickup option into per-store shipping quotes`.

### Task 5 — Order: per-group selection + apply pickup on order creation
**Repo:** refined `services/order`.
**Files:** `dto/CheckoutRequest.java`, the checkout/order-creation service.
- [ ] Widen `CheckoutRequest` with a per-group selection list `groupSelections: [{ storeId, quoteId, deliveryMethod, amountCents }]` (KEEP the legacy single `selectedShipping*` fields for back-compat; if only the legacy field is sent, apply it to all groups as today).
- [ ] Order creation: for each sub-order, resolve its group's selection; if `deliveryMethod=="pickup"` (or a `pickup:*` quoteId) → set `delivery_method="pickup"`, `shipping_cost_cents=0`, snapshot the pickup location, and DO NOT buy a carrier label; else the existing ship path (unchanged). Order total shipping = Σ per-sub-order shipping.
- [ ] Test: a mixed cart (one pickup group + one ship group) → the pickup sub-order has delivery_method=pickup + $0 + snapshot; the ship sub-order unchanged; a legacy single-selection request still works (regression).
- [ ] Commit `feat(order): per-group shipping selection + pickup application on checkout`.

### Task 6 — Order: pickup fulfillment statuses + marking
**Repo:** refined `services/order`.
**Files:** the fulfillment-transition service/controller.
- [ ] For `delivery_method="pickup"` sub-orders, the status path is `pending → ready_for_pickup → picked_up` (no shipped/out_for_delivery/delivered). Add the transitions; pickup orders never enter the ship statuses; no label purchase.
- [ ] Marking: **admin** can mark any pickup sub-order `ready_for_pickup`/`picked_up`; a **seller** can mark ONLY sub-orders whose `storeId` they own (authorize via the existing seller-ownership check). 
- [ ] Emit the fulfillment event (the notification consumer keys off it) with `delivery_method` + pickup context.
- [ ] Test: valid pickup transitions; a seller marking another store's sub-order is rejected; a ship sub-order can't take pickup statuses.
- [ ] Commit `feat(order): pickup fulfillment statuses + admin/seller marking`.

### Task 7 — Notification: pickup address in emails
**Repo:** refined `services/notification` (Go).
**Files:** the order-confirmation + fulfillment consumers/templates.
- [ ] Branch on `delivery_method`: a pickup sub-order's **order-confirmation** shows the **pickup address/hours/instructions** instead of shipping/tracking; add a **"Ready to collect"** email fired on the `ready_for_pickup` transition with the address. A mixed order shows both a ship block (tracking) and a pickup block (address).
- [ ] The events from Task 6 carry the pickup address; the consumer renders it. Reuse the existing dedup/idempotency pattern (`claimOrSkip`) so no duplicate emails.
- [ ] Test (Go): pickup event → email contains the pickup address; ship event unchanged; mixed shows both.
- [ ] Commit `feat(notification): pickup address in confirmation + ready-to-collect email`.

### Task 8 — Frontend: mixed-cart checkout UI (v2-ui)
**Repo:** `afrotransact-v2-ui`, branch `feat/pickup-checkout-ui`.
**Files:** `app/(main)/checkout/CheckoutClientV2.tsx` (the shipping step) + new components; the API types for the widened quotes + `CheckoutRequest`.
- [ ] Rebuild the shipping step into the **per-fulfillment-group** selector from the approved preview (`/dev/pickup-preview` on `feat/pickup-checkout-preview` is the reference): each group (store/origin) is a card with its items, a proximity/range chip, and radio options — **Pickup (Free)** with the collect address (when eligible) or delivery options; Pickup **disabled with the reason** when out of range. Order summary breaks shipping out **per group**, sums the total, shows pickup savings, and includes a genuine **"Payments secured by Stripe"** badge. Mobile sticky bar. Real Inter/Fraunces + shadcn + brand tokens + the existing checkout card/radio pattern (`rounded-xl border`, `accent-brand-gold`).
- [ ] Wire the selection into the widened per-group `CheckoutRequest.groupSelections`. Reuse the existing quote fetch (now returning pickup options); keep the flow working when pickup is absent (ship-only) — no regression.
- [ ] Gate: `npx tsc --noEmit` clean; live walkthrough on localhost:3001 (a mixed cart shows per-group pickup/delivery; selecting pickup zeroes that group's shipping).
- [ ] Commit `feat(checkout): mixed-cart per-group pickup & delivery selection`.

## Exit criteria
- Config exposes pickup settings; order injects a free Pickup option per eligible store group; checkout lets the buyer choose pickup/delivery **per group**; order creation writes `delivery_method`/$0-shipping/snapshot per sub-order; pickup sub-orders follow Ready-for-pickup→Picked-up (admin + owning-seller mark); notifications carry the pickup address. Ship-only path unchanged throughout. Deploy: `svc_config`, `svc_order`, `svc_notification`, frontend.

## Self-review
- Spec coverage: config (T1), model (T2), eligibility (T3), quote injection (T4), per-group checkout+application (T5), fulfillment (T6), notifications (T7), UI (T8). All spec sections covered.
- Regression: every task that touches quotes/order/fulfillment asserts the ship-only path is unchanged; `CheckoutRequest` keeps the legacy field.
- Cross-service interfaces named (pickup `quoteId="pickup:<storeId>"`, `delivery_method` values, `groupSelections` shape) so tasks compose.
