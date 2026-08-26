# Accounting D1b — Admin Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild the admin accounting page as the account-scoped dashboard from the approved preview — account selector, scoped P&L (two shapes), reconciliation, operating-costs, scoped Journal/Trial-balance, and a Sync control — on the AfroTransact brand theme, fully responsive. Consumes the D1a backend.

**Architecture:** A redesigned `app/(admin)/admin/accounting/page.tsx` (client) with shadcn components + Tailwind brand tokens (Inter body / Fraunces display, gold `#FFD400` / green `#067457`). A small API layer wraps the D1a endpoints. The P&L renders `PnlDto.lines` directly (data-driven waterfall), so house vs seller vs consolidated all render from one component.

**Tech Stack:** Next.js 16 (App Router) + React 19, TypeScript, Tailwind + shadcn/ui, lucide-react, `cn` from `@/lib/utils`. **Read `node_modules/next/dist/docs/` for any App-Router API before writing** (this Next has breaking changes vs training data) — but match the existing working patterns in `app/(main)/checkout/CheckoutClientV2.tsx` and `app/(admin)/**` first. Dev: `npm run dev` (port 3001). Typecheck: `npx tsc --noEmit -p tsconfig.json`.

## Global Constraints

- Use the existing brand utilities only: `bg-brand-gold`, `text-brand-gold-foreground`, `text-brand-gold-ink`, `border-brand-gold`, `accent-brand-gold`, `text-brand-green`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`. NO invented colors/hexes — everything through tokens (light + dark come free).
- Fonts come from the layout (`--font-sans` Inter, `--font-display` Fraunces) — do not import fonts.
- Money is integer cents from the API; format with one shared `money(cents)` helper (`$#,##0.00`, `tabular-nums`).
- Fully responsive (mobile-first); match the card/radio patterns already in checkout (`rounded-xl border`, `accent-brand-gold`).
- Admin-only (the page already lives under `(admin)`); no role logic in D1b.
- The account selector is the primary control; **reconciliation + operating-costs show a "house-only" empty state** when a seller account is selected (don't call those endpoints for a seller).

## File Structure

- `lib/api/accounting.ts` (new or extend) — typed client: `getAccounts`, `getPnl(account,from,to)`, `getSummary(account,period)`, `getJournal(account,…)`, `getTrialBalance(account,asOf)`, `getReconciliation(from,to)`, `listOpex/recordOpex/voidOpex`. Types: `AccountRef`, `PnlDto`, `PnlLine`, etc. (mirror D1a DTOs).
- `app/(admin)/admin/accounting/page.tsx` — the dashboard (rewrite).
- `app/(admin)/admin/accounting/_components/AccountSelector.tsx`, `PnlStatement.tsx`, `KpiRow.tsx`, `ReconciliationPanel.tsx`, `OperatingCosts.tsx`, `RecordCostForm.tsx`, `ScopedLedgerTable.tsx` (journal/trial), `SyncButton.tsx`.
- Reuse existing `components/ui/*` (badge, button, card, select, input) rather than new primitives.

**Interfaces consumed (from D1a):** `GET /accounts`, `GET /summary|journal|trial-balance|pnl?account=`, `GET /reconciliation`, `/opex`. `PnlLine = {label, amountCents, role: BASE|ADD|SUB|SUBTOTAL|TOTAL}`.

---

### Task 1: API client + types

**Files:** `lib/api/accounting.ts`; `lib/api/accounting.types.ts`

- [ ] **Step 1:** Define TS types mirroring D1a DTOs (`AccountRef`, `PnlDto`, `PnlLine`, `ReconciliationDto`, `OpExDto`). Add fetch wrappers using the app's existing authed-fetch helper (find how other admin API calls attach the token — reuse it, don't hand-roll auth).
- [ ] **Step 2:** `npx tsc --noEmit` → clean.
- [ ] **Step 3:** commit `feat(accounting-ui): typed client for account-scoped endpoints (D1b)`.

*(No runtime test harness for the client alone; correctness is verified when the page renders against the running D1a service. Typecheck is the gate.)*

---

### Task 2: `AccountSelector` + `SyncButton` + period control

**Files:** `_components/AccountSelector.tsx`, `_components/SyncButton.tsx`, `_components/PeriodSelect.tsx`

- [ ] **Step 1:** `AccountSelector` — a dropdown (reuse `components/ui/select` or a shadcn popover) listing `All accounts` / `House — AfroTransact` / each seller (from `getAccounts`), with a colored dot per kind (house = gold, seller = violet/emerald). Emits the selected `account` id. Matches the preview.
- [ ] **Step 2:** `SyncButton` — a button that re-invokes the parent's refetch and shows a spinning state + "Synced <relative time>" note (the endpoints are live; Sync just re-requests the current scope+period). `PeriodSelect` — MTD / last month / custom → `{from,to}`.
- [ ] **Step 3:** `npx tsc --noEmit` clean; render on the dev page and eyeball. Commit `feat(accounting-ui): account selector, sync, period controls (D1b)`.

---

### Task 3: `PnlStatement` + `KpiRow` (data-driven, both shapes)

**Files:** `_components/PnlStatement.tsx`, `_components/KpiRow.tsx`

- [ ] **Step 1:** `PnlStatement` renders `PnlDto.lines`: each line is a row with label, a proportional bar (width ∝ |amount|/max, colored pos=green / neg=red / base=gold), and the amount; `SUBTOTAL` rows emphasized, `TOTAL` row in a gold-tint card with the figure in Fraunces. Because it's data-driven, house/seller/all all render from the same component. `KpiRow` renders the scope's headline figures (hero card = brand-black bg + gold number for the primary total).
- [ ] **Step 2:** `npx tsc --noEmit` clean; verify house vs seller `PnlDto` both render correctly against D1a (or a stub) on the dev page.
- [ ] **Step 3:** commit `feat(accounting-ui): data-driven P&L statement + KPI row (D1b)`.

---

### Task 4: Reconciliation + Operating-costs panels (house-only) + Record-cost form

**Files:** `_components/ReconciliationPanel.tsx`, `_components/OperatingCosts.tsx`, `_components/RecordCostForm.tsx`

- [ ] **Step 1:** `ReconciliationPanel` — ledger vs Stripe balance + fee deltas with matched/mismatch chips (green/amber), from `getReconciliation`. When the selected account is a seller, render the "house-only" empty state (from the preview) and do NOT call the endpoint.
- [ ] **Step 2:** `OperatingCosts` — list from `listOpex(from,to)` + a "Record a cost" button opening `RecordCostForm` (category select infrastructure/tools/other, amount, date, recurring, description → `recordOpex`), and void action. House-only empty state for a seller account.
- [ ] **Step 3:** `npx tsc --noEmit` clean; verify recording a cost round-trips against D1a locally. Commit `feat(accounting-ui): reconciliation + operating-costs panels (D1b)`.

---

### Task 5: Assemble the dashboard page + scoped audit tabs + responsive

**Files:** `app/(admin)/admin/accounting/page.tsx`, `_components/ScopedLedgerTable.tsx`

- [ ] **Step 1:** Rewrite the page: command bar (AccountSelector + PeriodSelect + SyncButton), KpiRow, then tabs — **Profit & Loss** (PnlStatement + the What-this-means note), **Reconciliation**, **Operating costs**, **Journal**, **Trial balance**. `ScopedLedgerTable` renders `getJournal`/`getTrialBalance` for the current scope in a horizontally-scrollable table. Selecting an account or period refetches everything for the scope. Keep the old raw tabs only as the Journal/Trial-balance audit views.
- [ ] **Step 2:** Responsive pass — cards stack on mobile, tables scroll in their own container, controls wrap; verify light + dark. Loading skeletons + error states (reuse `components/ui/Skeleton`, `EmptyState`).
- [ ] **Step 3:** `npx tsc --noEmit` clean; `eslint` the changed files; walk every tab × {House, a seller, All} on the dev server against D1a and confirm scoping + house-only states. Commit `feat(accounting-ui): assemble account-scoped accounting dashboard (D1b)`.

## Phase D1b exit criteria

- The accounting page has an account selector; switching it re-scopes every tab.
- P&L renders the correct shape per account (house/seller/all) from `PnlDto`.
- Reconciliation + Operating-costs are house-only (seller → empty state, no call).
- Sync re-fetches; period selector works; on-brand (gold/green, Inter/Fraunces), responsive, light+dark.
- `tsc` + lint clean.

## Self-review

- Depends on D1a endpoints (`/accounts`, `/pnl?account=`, scoped summary/journal/trial, reconciliation, opex) — build D1a first.
- No invented styling: brand tokens + existing shadcn components + the checkout card/radio pattern only.
- Data-driven `PnlStatement` avoids per-shape UI code — one component renders all three scopes.
- Verification is typecheck + lint + live walk-through on localhost:3001 against D1a (v2-ui has no broad unit-test harness for pages; matches repo convention).
