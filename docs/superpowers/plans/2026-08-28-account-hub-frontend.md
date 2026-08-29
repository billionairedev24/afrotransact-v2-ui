# Account Hub (Frontend Consolidation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate every account surface into the single on-brand hub, add the Orders list
and gated diaspora stubs, and delete the now-redundant standalone routes — all frontend.

**Architecture:** `components/account/AccountClient.tsx` (already on-brand, commit `f1e2355`)
is the single host. Section components move out of `app/(main)/account/<name>/page.tsx` route
files into `components/account/sections/`, so the hub owns them and the routes can be deleted.
A small feature-flag map hides config-gated sections (Recipients, My preorders, Wallet) until
their backends land.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind, next-auth, existing
`lib/api.ts` helpers.

Spec: `docs/superpowers/specs/2026-08-28-account-hub-and-orders-redesign.md`. Backend-touching
items (Orders detail redesign, buyer OrderDto fields, receipt PDF, Reviews-to-write) are
**out of scope here** — they are the next plan.

## Global Constraints

- Single accent = brand gold `#FFD400`; `brand-gold-ink` for text/icons on light;
  `brand-green` for money/success; storefront card/border tokens. No Chrome grey, no blue accent.
- Hub swaps sections via `activeSection` state only — never `router.push`/`<Link>` to another
  account route. (Order detail is a separate page, reached from the Orders list — allowed.)
- Config-gated sections must be **absent from the rail and unreachable** when their flag is off.
- No fabricated data — every figure comes from an API.
- `npx tsc --noEmit` clean after every task; keep existing lint style.

---

### Task 1: Move section components into `components/account/sections/`

**Files:**
- Create: `components/account/sections/ProfileSection.tsx`, `SecuritySection.tsx`
  (incl. `PasswordCard`, `CloseAccountCard`), `AddressesSection.tsx`, `PaymentsSection.tsx`,
  `NotificationsSection.tsx`
- Modify: `app/(main)/account/{profile,security,addresses,payments,notifications}/page.tsx`
  (route files import the moved component and keep only the `default` route wrapper for now)
- Modify: `components/account/AccountClient.tsx` (import sections from the new location)

**Interfaces:**
- Produces: named exports `ProfileSection`, `SecuritySection`, `AddressesSection`,
  `PaymentsSection`, `NotificationsSection` from `components/account/sections/*` with identical
  signatures to today (no prop/behavior changes). `SecuritySection` still re-exports
  `PasswordCard`/`CloseAccountCard` if the route wrapper needs them.

- [ ] **Step 1:** Move each `…Section` component body verbatim into its new file under
  `components/account/sections/`, preserving imports/logic. For security, move `PasswordCard`,
  `CloseAccountCard`, and `SecuritySection`.
- [ ] **Step 2:** In each old route `page.tsx`, replace the moved component with an import from
  the new location; keep the `default` page export (still wraps the section in `AccountShell`).
- [ ] **Step 3:** Point `AccountClient.tsx` imports at `@/components/account/sections/*`.
- [ ] **Step 4:** `npx tsc --noEmit` — expect clean. Load `/account` and each `/account/<name>`
  route mentally: identical render.
- [ ] **Step 5:** Commit `refactor(account): move section components into components/account/sections`.

---

### Task 2: Extract `WishlistSection` and add it to the hub

**Files:**
- Modify: `app/(main)/account/wishlist/page.tsx` (extract the client logic into a
  `WishlistSection` component; keep a default page that renders it for now)
- Create/Modify: `components/account/sections/WishlistSection.tsx`
- Modify: `components/account/AccountClient.tsx` (register Wishlist section)

**Interfaces:**
- Produces: `export function WishlistSection()` — fetches via existing `getWishlist(token)`,
  renders saved items with Add-to-cart / Remove, brand-styled, with an empty state.

- [ ] **Step 1:** Extract the wishlist client component into `WishlistSection` (data + render),
  matching the on-brand card language used by `AddressesSection`.
- [ ] **Step 2:** Add a `wishlist` entry to the hub `SECTIONS` (icon `Heart`, after Payments,
  before Addresses per the approved hub order).
- [ ] **Step 3:** `npx tsc --noEmit` clean; wishlist renders inside the hub with no navigation.
- [ ] **Step 4:** Commit `feat(account): wishlist as a hub section`.

---

### Task 3: `OrdersSection` — paginated orders list in the hub

**Files:**
- Create: `components/account/sections/OrdersSection.tsx`
- Modify: `components/account/AccountClient.tsx` (register Orders as the first section)

**Interfaces:**
- Consumes: `getBuyerOrders(token, page, size, q?)` → `Page<OrderDto>` (exists);
  `reorderOrder(token, orderNumber)` (exists). `Page<T>` has `content`, `number`,
  `totalElements`, `size`, `totalPages`.
- Produces: `export function OrdersSection()`.

- [ ] **Step 1:** Build the list: fetch page 0 size 6; status filter chips reusing the
  `classifyStatus` grouping from `app/(main)/orders/page.tsx` (import or copy the helper);
  order cards (placed date · total · order # · status pill · first item · actions: Track,
  View order → `/orders/[orderNumber]`, Buy again, Receipt). "Write a review" shows when
  delivered; "Return an item" when eligible. Match the approved Orders preview.
- [ ] **Step 2:** Pagination controls (Prev / numbered / Next) + "Showing X–Y of N" from the
  `Page` metadata. Keep page/filter in local state (the hub section starts at page 0; the
  standalone `/orders` page keeps URL query).
- [ ] **Step 3:** Register `orders` as the first hub section (icon `Package`).
- [ ] **Step 4:** Test — a mocked `Page` with `totalElements > size` renders pager and
  "Showing" line; empty state when `content` is empty. `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `feat(account): paginated orders list as a hub section`.

---

### Task 4: Feature-flag gating + gated stub sections (Recipients, My preorders, Wallet)

**Files:**
- Create: `lib/account-features.ts` (flag reads), `components/account/sections/RecipientsSection.tsx`,
  `PreordersSection.tsx`, `WalletSection.tsx`
- Modify: `components/account/AccountClient.tsx` (filter `SECTIONS` by flag)

**Interfaces:**
- Produces: `getAccountFeatureFlags()` returning `{ recipientsEnabled: boolean;
  referralEnabled: boolean; preorderActive: boolean }`. Default **all false** until the config
  keys exist; read from the existing storefront feature fetch when the keys are present
  (`effectiveFeatures["recipients_enabled"]`, `["referral_enabled"]`). No new backend call if a
  flags source already loads in layout — otherwise a single fetch.
- Each stub section renders the approved layout but is only mounted when its flag is on; when
  off it is filtered out of `SECTIONS` entirely (no rail item, no panel).

- [ ] **Step 1:** Implement `getAccountFeatureFlags()` (client hook or server prop) — defaults
  off; reads known keys if available.
- [ ] **Step 2:** Build `RecipientsSection`, `PreordersSection`, `WalletSection` as on-brand
  components matching their previews, each rendering an empty/loading state (no live data yet —
  data arrives in later plans). They must not call unbuilt endpoints; render static empty state.
- [ ] **Step 3:** In `AccountClient`, compute the visible section list = `SECTIONS.filter(flag)`.
  Recipients gated on `recipientsEnabled`; My preorders on `preorderActive`; Wallet on
  `referralEnabled`. Deep-link hash to a gated-off section falls back to `profile`.
- [ ] **Step 4:** Test — with all flags false, none of the three appear in the rail and their
  hashes fall back; with a flag forced true, the section mounts. `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `feat(account): config-gated Recipients/Preorders/Wallet stubs`.

---

### Task 5: Communications — verify save + hidden SMS/WhatsApp rows

**Files:**
- Modify: `components/account/sections/NotificationsSection.tsx`

**Interfaces:**
- Consumes: `getUserProfile(token)` (preferences JSON) and the preferences update helper
  (`PUT /me/preferences`). Categories stay exactly: `order_updates`, `promotions`,
  `product_reviews`, `seller_updates`, `newsletter`.

- [ ] **Step 1:** Confirm each toggle persists via `PUT /me/preferences`, **merging** into the
  existing `preferences.notifications` object (never clobber other preference keys). If the
  current code replaces the blob, fix it to merge.
- [ ] **Step 2:** Add `SMS alerts` and `WhatsApp alerts` rows behind a local
  `COMMS_CHANNELS_SMS_WHATSAPP = false` constant — rendered only when true (hidden now,
  no backend). Leave a one-line comment that flipping the constant + backend enables them.
- [ ] **Step 3:** Test — toggling a category PUTs the right key and preserves siblings; SMS/
  WhatsApp rows absent while the constant is false. `npx tsc --noEmit` clean.
- [ ] **Step 4:** Commit `feat(account): verify comms persistence + hidden sms/whatsapp rows`.

---

### Task 6: Dead-code removal

**Files (delete after confirming no inbound references):**
- `app/(main)/o/[orderNumber]/page.tsx` (unlinked 16-line page)
- `app/(main)/account/{profile,security,addresses,payments,notifications,settings}/page.tsx`
- `components/account/AccountShell.tsx`
- Fold `app/(main)/account/wishlist/page.tsx` into the hub (remove the route unless an external
  deep-link needs it; if kept, it renders `WishlistSection` inside the shell — but prefer removal)

- [ ] **Step 1:** `grep` the repo for inbound references to each deletion target (routes,
  `<Link href>`, `router.push`, `AccountShell` imports). Anything still referencing them must
  be repointed to the hub (`/account#<section>`) first.
- [ ] **Step 2:** Delete the confirmed-dead files. Remove now-unused imports/helpers surfaced by
  the deletions.
- [ ] **Step 3:** `npx tsc --noEmit` clean; `next build` (or `next lint`) passes; the hub still
  renders every section; `/account/<name>` deep links either redirect to `/account#<name>` or
  are intentionally gone (state which).
- [ ] **Step 4:** Commit `chore(account): remove standalone account routes, AccountShell, /o page`.

---

## Self-Review notes

- Section move (Task 1) must not change any section's data/handlers — pure relocation.
- Gated sections (Task 4) must be truly absent when off (assert no rail item), not just hidden.
- Deletion (Task 6) runs last, after the hub imports from `sections/`, so nothing is removed
  while still referenced.
- Reviews-to-write, Orders **detail**, buyer OrderDto fields, and the receipt PDF are the next
  plan (they need backend) — not here.
