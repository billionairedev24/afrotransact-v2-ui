# Accounting — Account-Scoped Reporting & Admin Dashboard (Phase D1) — Design Spec

## Problem

Phases A–C made the ledger correct (discounts, real Stripe fees, reconciliation, operating expenses) but everything is reported **platform-wide and blended**. The admin accounting UI is the old Overview / Journal / Trial-Balance tabs — it cannot show one account's figures. AfroTransact is house-first today (we sell our own products) but has built for sellers and will onboard them; the accounting must **differentiate by account** and be ready for sellers, without blending them together.

## Goal

Make every accounting view **scoped to a single account** — the **House** (AfroTransact first-party), a **specific seller**, or a consolidated **All accounts** — behind a redesigned, on-brand admin dashboard. The ledger already tags every posting with `journal_lines.seller_id` and carries per-party accounts (`accounts.party_kind` / `party_id`, `seller_payable:<uuid>`), so this is a **reporting + UI layer**, not a ledger change.

## Scope

**Phase D1 (this spec):**
- **D1a — backend:** account-scoping on the report endpoints; two P&L shapes (house full-retail vs seller marketplace); reconciliation + operating-costs remain house-only; admin authorization.
- **D1b — frontend:** the redesigned admin accounting dashboard — account selector, scoped P&L, operating-costs management, reconciliation panel, scoped Journal/Trial-Balance, a **Sync** (refresh) control, on the AfroTransact brand theme (gold `#FFD400` / green `#067457` / black, Inter + Fraunces), fully responsive.

**Deferred to Phase D2 (separate spec):** the per-seller **entitlement gate** (admin enables accounting for a seller as a paid add-on or free) and the **seller-facing** view (a seller sees only their own account). D1 builds the account-scoping and admin selector that D2's gate plugs into. No seller login/portal is built in D1.

**Out of scope:** changes to how the ledger posts (Phases A–C own that); GAAP statements beyond the P&L.

## The account model

An **account** = a party: `house` (AfroTransact) or a seller (`<sellerId>`), plus the admin-only `all` (consolidated). Scoping filters postings by the party dimension already on the ledger:
- **House** postings: house sub-orders (store = `at.inventory.house-store-id`), booked to `house.*` accounts, `seller_id` null/house.
- **Seller** postings: `journal_lines.seller_id = <sellerId>` and `seller_payable:<uuid>` / commission attributable to that seller.
- **All**: no party filter — the current platform-wide behaviour.

## Two P&L shapes

A seller's economics ≠ the house's, so the P&L endpoint returns a different shape per account type.

**House P&L (full retail)** — the Phase A–C statement:
```
Gross sales − discounts = Net sales
  + shipping revenue − COGS − shipping cost − real Stripe fees = Gross margin
  − operating expenses = Net profit         (sales tax → taxes_payable, excluded)
```

**Seller P&L (marketplace)** — the platform's ledger view of one seller:
```
Gross sales − discounts = Net sales
  − platform commission (our cut) − Stripe fee share + shipping collected = Net earnings (payout basis)
  Balance owed (seller_payable:<uuid>) + payouts made (transfers), this period
  (no COGS, no house OpEx, no Stripe platform reconciliation)
```

**All accounts (consolidated)** — AfroTransact's true bottom line: `house net profit + marketplace commission revenue − shared platform costs = platform net profit`, plus GMV across all accounts.

## House-only panels

- **Stripe reconciliation** (Phase B) is house/admin-only: `stripe.platform_balance` is AfroTransact's cash; a seller's money moves via Connect transfers, so their equivalent is payouts-vs-balance, shown in the seller P&L.
- **Operating costs** (Phase C) are house-only: AfroTransact's own expenses. Never attributed to a seller.

When a seller account is selected, these panels show a clear "house-only" empty state, not an error.

## API

All under `/api/v1/admin/ledger`, admin-gated by the existing `/api/v1/admin/**` security layer (D1 is admin-only). Each reporting endpoint gains an optional `account` query param: `all` (default, admin) | `house` | `<sellerId>`.

- `GET /summary?account=` — headline KPIs for the scope (shape depends on house/seller/all).
- `GET /journal?account=&from=&to=&…` — postings filtered to the account (extends the existing filter).
- `GET /trial-balance?account=&asOf=` — balances filtered to the account.
- `GET /pnl?account=&from=&to=` — **new/reshaped**: returns the house, seller, or consolidated P&L shape above (supersedes the sales−COGS-only `/first-party/pnl`).
- `GET /reconciliation?from=&to=` — unchanged, house-only (ignores `account`, or 400s for a seller).
- `GET /opex?…` + `POST /opex` + `POST /opex/{id}/void` — unchanged, house-only.
- `GET /accounts` — **new**: the selectable accounts for the picker (house + sellers that have ledger activity), each `{ id, kind: house|seller, name, hasActivity }`. Seller display names resolved from the seller service.

**Scoping is server-enforced.** In D1 the caller is always an admin (any account allowed). The param is validated against known accounts; an unknown id 404s. D2 will add: for a seller caller, force `account = their own sellerId` and reject others — the endpoints are written in D1 so that swap is a single authorization check, not a query rewrite.

**Sync / refresh.** The reporting endpoints already compute live (balances from the ledger; reconciliation pulls Stripe live). "Sync" on the dashboard simply re-requests the current scope + period and re-renders, surfacing a "Synced <time>" state — no new stateful endpoint. Reconciliation's `?from=&to=` with `to`≈now gives current figures.

## Frontend (D1b)

Redesign `app/(admin)/admin/accounting/page.tsx` on the brand theme (gold/green/black, Inter + Fraunces, shadcn components), matching the approved preview:
- **Account selector** (All / House / seller search) as the primary control; **period selector** (MTD / last month / custom); **Sync** button with a synced-at note; theme-aware.
- **KPI row** + **P&L statement** with proportional waterfall bars, reshaping per account type.
- **Tabs**: Profit & Loss, Reconciliation (house-only state for sellers), Operating costs (house-only; the manual "Record a cost" form), Journal, Trial balance — all re-scoping to the selected account.
- Fully responsive; light + dark.

## Testing

- Backend: account-scoping filters postings correctly (house-only, seller-only, all); the seller P&L computes commission/fee-share/net-earnings/balance from the ledger; reconciliation/opex reject or empty-state a seller scope; `/accounts` lists house + active sellers. Reuse the Testcontainers Postgres harness from Phase C for any DB-level scoping tests; service-level math tests use Mockito.
- Frontend: the selector switches scope and the P&L reshapes; house-only panels show the right empty state for sellers; Sync re-fetches.

## Phasing / sequencing

1. **D1a** (refined, `services/accounting`) — backend account-scoping + seller P&L + `/accounts` + `/pnl`. Deploy `svc_accounting`.
2. **D1b** (afrotransact-v2-ui) — the dashboard, consuming D1a.
3. **D2** (later) — seller entitlement gate + seller-facing view.
