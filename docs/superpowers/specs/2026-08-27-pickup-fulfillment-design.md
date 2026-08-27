# Pickup & Mixed-Cart Fulfillment — Design Spec

## Problem

Every checkout charges a shipping fee (a flat ~$7.99 today, plus carrier quotes). There's no way for a buyer who is near the fulfilling location to **collect in person for free**. AfroTransact wants a **Pickup** option that attracts no shipping fee. Because a cart can contain items from more than one origin (the house + sellers), pickup must be decided **per fulfillment group**, not per order — some items may be pickup-eligible (buyer in range) while others must ship.

## Goal

Add a free **Pickup** fulfillment method, chosen **per fulfillment group (per origin/store)**, that: sets that group's shipping to $0, records `delivery_method = pickup`, follows its own **Ready-for-pickup → Picked-up** status path (no carrier label), and surfaces the **pickup address** in the buyer's notifications. Platform-controlled and binding (AfroTransact enables it; sellers don't bear shipping today).

## Decisions (from design + the approved preview)

- **Platform-controlled**: pickup is enabled in config with a pickup location (address + hours + instructions); it's a platform decision, not per-seller.
- **Per fulfillment group**: the cart already splits into sub-orders by `storeId`; each group independently offers Pickup (Free) **iff** its store has a pickup location and the buyer is within range — otherwise Pickup is shown disabled with a reason. Total shipping = Σ each group's chosen method.
- **`delivery_method`** on the sub-order (`ship` | `pickup`); pickup ⇒ `shipping_cost = 0`, location snapshot, no carrier label.
- **Fulfillment**: pickup sub-orders go **Ready-for-pickup → Picked-up**. **Admin** can mark any picked up; a **seller** can mark their own store's items picked up.
- **Notifications** branch on `delivery_method`: a pickup sub-order's confirmation + a new "Ready to collect" email show the pickup address/hours/instructions instead of shipping/tracking.
- **Nothing breaks**: this rides the existing sub-order split; order/payment/accounting splitting is unchanged; ship-only orders behave exactly as today. Pickup only appears when config enables it and the buyer is in range.

## Current-state grounding

- `OrderService.getShippingQuotes` fetches rates **per store** (`groupingBy CartItem::getStoreId`) via `ShippingRatesAggregator` (Shippo/EasyPost) + `SyntheticShippingQuotes` fallback → `ShippingQuoteResponse{ groups: ShippingQuoteGroup[] }`.
- `CheckoutRequest` carries a **single** `selectedShippingQuoteId`/`Carrier`/`Service`/`AmountCents` for the whole order (must become per-group).
- `SubOrder` has `storeId`, `shippingCostCents`, `fulfillmentStatus` (pending→dispatched→shipped→out_for_delivery→delivered, + hold) — **no `delivery_method`**, no pickup statuses.
- Config service holds platform settings; notification service (Go) branches emails by event/status.

## Architecture

A **pickup location** is configured (platform-level, later extensible per-store). Quote generation injects a synthetic **Pickup** option ($0) into the group for any store that has a pickup location and whose buyer is within range. Checkout lets the buyer choose **per group**; the selection carries `delivery_method` per group into `CheckoutRequest`. Order creation writes `delivery_method` + `shipping_cost` per sub-order and snapshots the pickup location. Fulfillment adds the pickup status path; notifications branch on `delivery_method`.

## Phasing (each phase testable; separate plan + PR)

### Phase P1 — Pickup end-to-end (backend + the single-selection case)
Delivers a working, visible Pickup option in the **current** checkout (which today makes one selection per order — correct for the house-only reality now), while laying the per-group foundation.
- **Config**: `pickup_enabled` + `pickup_location` (name, address, hours, instructions) in the config service.
- **Order — quotes**: when enabled and a store has a pickup location + the buyer is in range (v1 range: a configured radius or serviceable postal-code/region set), inject a synthetic **Pickup** option (`amountCents = 0`, quoteId `pickup:<storeId>`, carrying the address) into that store's `ShippingQuoteGroup`.
- **Order — model + checkout**: add `delivery_method` (`ship`|`pickup`) to `SubOrder` (migration). When the selected shipping quote is a `pickup:*` id, order creation sets the affected sub-order(s) `delivery_method = pickup`, `shipping_cost = 0`, and snapshots the pickup location. Ship path unchanged.
- **Range eligibility**: a small `PickupEligibilityService` (store location + buyer address → in-range boolean). v1 simple (radius or region allowlist), pluggable.
- Tests: quote injection (enabled+in-range vs disabled vs out-of-range), order creation sets delivery_method/zero-shipping for a pickup selection, ship path regression.

### Phase P2 — Mixed-cart per-group selection (checkout UI + per-group request)
- **CheckoutRequest**: widen to carry a **per-group** selection (list of `{ groupId/storeId, quoteId, deliveryMethod, amountCents }`) alongside the legacy single field (kept for back-compat).
- **Checkout UI** (v2-ui): rebuild the shipping step into the **per-fulfillment-group** selector from the approved preview — each group independently picks Pickup (Free, with the collect address) or a delivery option; Pickup disabled with a reason when out of range; order summary sums per-group shipping + shows pickup savings; a **Stripe secure-payment** trust badge. Real components (Inter/Fraunces, shadcn, brand tokens), responsive.
- Order creation applies each group's method to its sub-order.
- Tests: per-group application; a mixed cart (one pickup group + one ship group) produces the right per-sub-order `delivery_method`/`shipping_cost`.

### Phase P3 — Pickup fulfillment + notifications
- **Fulfillment statuses**: add `ready_for_pickup` and `picked_up` to the sub-order path for `delivery_method = pickup`; no carrier label is bought. **Admin** can mark any sub-order picked up; a **seller** can mark their own store's sub-orders (authorization by store ownership). Pickup orders skip the ship statuses.
- **Notifications** (Go): the order-confirmation + a new **"Ready to collect"** email branch on `delivery_method = pickup` to show the **pickup address, hours, and instructions** instead of shipping/tracking. A mixed order shows both blocks.
- Tests: status transitions + authorization; notification payload carries the pickup address for pickup sub-orders.

## Out of scope (later)
- Per-seller pickup locations + seller-managed pickup config (v1 is platform-level).
- Guest-checkout nuances beyond the existing flow.
- Real distance/geocoding beyond the v1 radius/region eligibility.

## Deploy targets
P1: `svc_config` + `svc_order`. P2: frontend. P3: `svc_order` + `svc_notification`.
