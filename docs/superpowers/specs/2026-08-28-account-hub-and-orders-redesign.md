# Account Hub & Orders Redesign — Design Spec

**Date:** 2026-08-28
**Status:** Approved design (previews signed off) — ready for implementation planning
**Repos:** `afrotransact-v2-ui` (frontend), `refined` (order + notification services)

Companion spec: [Referral & Store Credit](./2026-08-28-referral-and-store-credit.md). This
spec references the referral-credit line in the receipt and the Wallet hub section, but
does not implement referral; it only leaves the seams.

---

## Goal

Turn "My Account" into a single, on-brand hub, and replace the non-standard order pages
with a paginated list and an Amazon-standard detail, backed by a receipt PDF redesign.
Wire communications to the real backend, gate diaspora features behind config, and delete
the dead code the consolidation makes redundant.

## Approved previews

- Account hub — `artifact/ddc0caa7-e086-4a8c-b761-d26692be90aa`
- Orders (list + detail) — `artifact/a43a585c-eb5e-4244-b820-58e3b7fdbd76`
- Receipt PDF — `artifact/a8a19efc-4e21-4868-a546-414e047da101`

## Global Constraints

- **Theme:** brand gold `#FFD400` as the single accent, `brand-gold-ink` for text/icons on
  light, `brand-green #067457` for money/success, storefront card/border tokens. No Chrome
  greys, no blue-as-accent (blue only as a neutral status tone for "Shipped").
- **One page:** the hub swaps sections via client state (`activeSection`) — never
  `router.push`/`<Link>` to another account route. Order *detail* is the one allowed
  drill-in (its own page), same as Amazon.
- **Java:** no inline fully-qualified class names — add imports (per repo convention).
- **No fabricated data:** every figure shown comes from the API; never invent totals.
- **Config-gated features stay hidden when off** — Recipients and My-preorders must not
  render at all unless their flag/feature is active.

---

## Architecture

### Frontend (afrotransact-v2-ui)

**Hub shell** — `components/account/AccountClient.tsx` (already re-skinned on-brand in
commit `f1e2355`) is the single host. Sections are plain components it renders by state.

**Section components move out of route files.** Today each section lives inside an
`app/(main)/account/<name>/page.tsx` that exports *both* a `…Section` component (reused by
the hub) and a route `default`. Move each `…Section` into
`components/account/sections/<Name>Section.tsx`. The hub imports from there. The standalone
routes and `AccountShell` are then deleted (see Dead Code).

**Final hub sections (in order):**

| Section | Source | Notes |
|---|---|---|
| Orders | new `OrdersSection` | paginated list (below); "View order" → `/orders/[orderNumber]` |
| Recipients | new `RecipientsSection` | **config-gated**; hidden unless `recipients_enabled` |
| My preorders | new `PreordersSection` | **feature-gated**; hidden unless preorder active *and* user has pledges. Stub returns empty until the Preorder feature wires it |
| Followed sellers | *out of scope here* | deferred; no backend yet (tracked in backlog) |
| Reviews to write | new `ReviewsToWriteSection` | backend exists (`review` svc) |
| Wallet & credit | new `WalletSection` | **referral spec** owns the data; renders empty state until then |
| Wishlist | existing wishlist logic | moved into hub as a section |
| Addresses | `AddressesSection` | moved |
| Payments | `PaymentsSection` | moved |
| Profile | `ProfileSection` | moved |
| Login & security | `SecuritySection` | moved |
| Communications | `NotificationsSection` | rewired (below) |

> **Ordering of build:** Orders, Reviews-to-write, Communications, Wishlist, and the moves
> are Phase 1 (no heavy backend). Recipients/Preorders are gated stubs in Phase 1. Wallet is
> a stub until the Referral spec lands.

### Feature gating

Read flags from the `config` service (it already has `feature.go` /
`platform_features.go`). Add three flags:

- `recipients_enabled` (bool, default **false**)
- `referral_enabled` (bool — owned by Referral spec)
- preorder-active is read from the existing preorder/campaign state, not a new flag.

Frontend fetches flags once (server component or a small `useFeatureFlags` hook) and the hub
filters `SECTIONS` by flag before render. A gated-off section is absent from the rail and
has no reachable panel.

---

## Orders redesign

### Orders list (`OrdersSection` in hub + standalone `/orders` kept as a thin page)

- **Paginated.** Use existing `getBuyerOrders(token, page, size, q?)` which already returns
  `Page<OrderDto>`. Render page controls (Prev / numbered / Next) and "Showing X–Y of N"
  from the `Page` metadata (`number`, `totalElements`, `size`).
- Status filter chips: All / Order placed / Shipped / Delivered / Cancelled & refunded —
  reuse the existing `classifyStatus` grouping already in `app/(main)/orders/page.tsx`.
- Order card: placed date · total · order # · status pill · first item row(s) · action row
  (Track, View order, Buy again, Receipt PDF; plus Write a review when delivered, Return
  when eligible).
- Default page size 6 (matches preview). Preserve current filter/page in the URL query so
  refresh/bookmark works (`?status=&page=`), without client-side route navigation inside the
  hub — the standalone `/orders` page owns the query; the hub section can start at page 0.

### Order detail (`/orders/[orderNumber]/page.tsx` — redesign in place)

- Two-column Amazon-standard layout: left = delivery tracker + items grouped by seller;
  right = order summary + shipping address + payment + Download receipt.
- **Fix the blank summary.** Root cause: the buyer `OrderDto` from
  `GET /api/v1/orders/{orderNumber}` does not surface the breakdown even though
  `orders.orders` stores `subtotal_cents`, `shipping_cost_cents`, `tax_cents`,
  `total_cents`, `discount_cents`. **Backend task:** ensure `OrderDto` includes
  `subtotalCents`, `shippingCostCents`, `taxCents`, `discountCents`, `totalCents` for the
  buyer endpoint. Frontend renders each line; show "FREE" when `shippingCostCents === 0`,
  and render the discount and referral-credit lines only when > 0.
- Delivery tracker: for **pickup** sub-orders show pickup state, not "on the way" (reuse the
  `deliveryMethod`/`pickupLocation` already on `SubOrderDto`). Mixed orders show per-group.
- Items grouped by seller/sub-order with the store name (never a UUID — reuse the
  `getStoreById` resolver pattern from checkout).

### Receipt PDF redesign (`refined/services/notification/pdf/receipt.go`)

Match the approved receipt preview. Changes to the existing generator:

1. **Add Ship-to block** beside Bill-to. Extend `ReceiptData` with `ShipToName`,
   `ShipToAddress []string`, `ShipToPhone`. Populate from the order's shipping-address
   snapshot in the consumer.
2. **Group items by seller.** Extend `ReceiptItem` with `SoldBy string` (or pass grouped
   sections); render a store header row before each group. House items read "Sold & shipped
   by AfroTransact".
3. **Referral-credit line** in totals: add `ReferralCreditCents int` to `ReceiptData`, render
   in brand green as `−$X.XX` when > 0 (below discount, above the gold rule). Referral spec
   populates it; default 0 → line omitted.
4. **Real date.** Resolve the `TODO(receipt-time)`: fix `formatCustomerDateTime` upstream (tz
   = America/Chicago, correct parse) and render the actual order date. Keep `dateOnly` only
   as a fallback.
5. **✓ PAID badge** in the header meta and a **social footer** (Instagram / LinkedIn /
   WhatsApp) matching `templates/defaults.go`.
6. **Use the real logo, not a text wordmark.** Today the header renders the string
   "AfroTransact" in gold. Bundle the brand logo `email-logo-white.png` (the same white
   logo the emails use, `afrotransact-v2-ui/public/brand/email-logo-white.png`) into the
   notification service via `//go:embed`, register it with gofpdf, and draw it on the black
   header band (height ~10–12mm, left-aligned). No network fetch for the brand mark — it must
   render offline/deterministically. Keep the text wordmark only as a fallback if image
   registration fails. (Product thumbnails may still be fetched over HTTP as today.)
7. Keep the working parts: black/gold header, green totals, thumbnails, advertorial band.

The receipt is generated in the notification consumer and attached to order/payment emails;
also expose it for **on-demand download** from the order detail + list ("Receipt (PDF)").
**Backend task:** add an authenticated endpoint (order service or notification service) that
returns the receipt PDF for an order the caller owns; the frontend button hits it.

---

## Communications — wire to the real backend (no new backend)

The backend already works: `user-profile` stores a preferences JSON blob
(`PUT /me/preferences`), and the notification consumer's `categoryEnabled` gate already
suppresses sends for opted-out categories. The only real categories are:

`order_updates`, `promotions`, `product_reviews`, `seller_updates`, `newsletter`.

- `NotificationsSection` renders exactly these five toggles, mapped to those keys, and
  persists via `PUT /me/preferences` (merge into the existing `preferences.notifications`
  object; never clobber other preference keys).
- **Remove** "Notify family on delivery" (not applicable).
- Add **SMS alerts** and **WhatsApp alerts** rows but render them **hidden/disabled** behind
  a `commsChannels.smsWhatsApp` flag defaulted off (no backend yet, out of scope) — present
  in code so enabling is a one-line flip, invisible to users now.
- `order_updates` is transactional; show it but note it can't be fully disabled for critical
  delivery mail if product decides so (default: allow toggle, backend already honors it).

---

## Dead code removal

Verified candidates (confirm no inbound refs at implementation time, then delete):

- `app/(main)/o/[orderNumber]/page.tsx` — 16-line page, **not linked anywhere**. Remove
  (add a redirect to `/orders/[orderNumber]` only if any external link relies on `/o/`).
- Standalone account routes once sections are moved to `components/account/sections/`:
  `app/(main)/account/{profile,security,addresses,payments,notifications,settings}/page.tsx`
  and `components/account/AccountShell.tsx`. Keep `app/(main)/account/page.tsx` (the hub
  host) and `app/(main)/account/wishlist/*` only if any external deep-link needs it;
  otherwise fold wishlist into the hub and remove the route.
- Any now-unused imports/helpers left behind by the moves (run the typechecker + a
  dead-export scan; remove what's unreferenced).

Removal is its own reviewed task **after** the hub imports from the new section locations, so
nothing is deleted while still referenced.

---

## Testing

- **Frontend:** section-switching stays on one route (assert no navigation); gated sections
  absent when flag off; orders list paginates (mock `Page` with `totalElements > size`);
  order detail renders subtotal/shipping/tax/total from the DTO; pickup order shows pickup
  copy, not "on the way"; comms toggles PUT the correct category keys and merge preferences.
- **Backend (order):** `OrderDto` for the buyer endpoint includes the five cents fields;
  a delivered order exposes review eligibility.
- **Backend (notification):** `GenerateReceipt` golden test covers ship-to, multi-seller
  grouping, referral-credit line (0 → omitted, >0 → rendered), and real date; the on-demand
  receipt endpoint authorizes ownership.

## Out of scope (this spec)

- Referral/wallet logic (separate spec) — only the seams (credit line, Wallet stub).
- Followed sellers (no backend; backlog).
- Recipients backend (flag-gated stub only; full build later).
- SMS/WhatsApp backend.
