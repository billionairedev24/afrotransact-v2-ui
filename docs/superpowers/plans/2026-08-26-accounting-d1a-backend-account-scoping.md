# Accounting D1a — Backend Account-Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Scope every accounting report to one account — House, a specific seller, or consolidated All — and return the correct P&L *shape* per account type. Reporting/UI layer only; no change to how the ledger posts.

**Architecture:** The ledger already tags seller postings with `journal_lines.seller_id` and uses party-coded accounts (`seller_payable:<uuid>`, `commission_revenue`); house postings use `house.*` / `shipping.income` / `platform.stripe_fees` / `operating:*` with null `seller_id`. We add: scoped repository queries, a `/accounts` list, a reshaped `/pnl` computing house vs seller vs consolidated, and an `account` param on summary/journal/trial-balance. Reconciliation + operating-costs stay house-only.

**Tech Stack:** Java 21 (GraalVM), Spring Boot, JPA, Flyway/Postgres schema `ledger`, Lombok, JUnit5 + Mockito + AssertJ + Testcontainers (Phase C harness). Module: `services/accounting`. Build offline: `JAVA_HOME=/Library/Java/JavaVirtualMachines/graalvm-jdk-21/Contents/Home`, `./mvnw -o` from the module.

## Global Constraints

- Money always integer cents (`long`). No float/BigDecimal.
- Package `com.afrotransact.accounting`; NO inline fully-qualified class names.
- Admin endpoints under `/api/v1/admin/**`, gated by the existing security layer — D1 is admin-only, no per-method auth.
- `account` values: `all` (default) | `house` | `<sellerId UUID>`. Validate against known accounts; unknown → 404.
- **Scoping definitions (canonical):** *seller* = lines/balances where `seller_id = <sellerId>` (+ the `seller_payable:<sellerId>` account); *house* = the house-coded accounts (`house.sales_revenue`, `house.discounts`, `house.cogs`, `shipping.income`, `platform.stripe_fees`, `operating:*`, `taxes_payable:*`) with null `seller_id`; *all* = no party filter.
- **Flow vs stock:** revenue/expense/contra accounts are *flow* over `[from,to]` → `balanceCents(code,to) − balanceCents(code,from)`; balance/asset/liability accounts are *stock* as of `to`. (Same pattern as Phase B fee windowing.)
- Reconciliation + operating-costs endpoints are **house-only**: a seller `account` yields a documented "not applicable" response, never seller data.
- The seller-P&L numbers must tie to the ledger (commission, net, balance come from posted lines, not re-derived rates).

## File Structure

- `services/accounting/.../repository/JournalLineRepository.java` — add seller-scoped + house-scoped balance/line queries.
- `services/accounting/.../repository/JournalEntryRepository.java` — add a seller-scoped `findFiltered` variant for the journal.
- `services/accounting/.../service/AccountScopeService.java` (new) — resolve/validate an `account` param; list selectable accounts.
- `services/accounting/.../service/PnlService.java` (new) — compute the house / seller / consolidated P&L.
- `services/accounting/.../service/LedgerReportService.java` — thread `account` scope through journal/trial-balance/summary.
- `services/accounting/.../controller/AdminLedgerController.java` — `account` param on summary/journal/trial-balance/pnl; new `/accounts`; house-only guard on reconciliation/opex.
- `services/accounting/.../dto/` — `PnlDto`, `AccountRef`, DTOs for the shapes.
- Tests alongside; DB-level scoping tests extend `support/AbstractPostgresIntegrationTest` (Phase C), math tests use Mockito.

**Interfaces produced:**
- `AccountScopeService.resolve(String account) -> AccountScope` (`{kind: ALL|HOUSE|SELLER, sellerId?}`), throws 404 on unknown.
- `AccountScopeService.listAccounts() -> List<AccountRef>` (`{id, kind, name, hasActivity}`).
- `PnlService.pnl(AccountScope scope, LocalDateTime from, LocalDateTime to) -> PnlDto`.
- Repo: `distinctSellerIds()`, `signedBalancesByAccountForSeller(asOf, sellerId)`, `sellerScopedSum(sellerId, from, to, codePrefixes…)` as needed.

---

### Task 1: Account list + scope resolution (`AccountScopeService` + `/accounts`)

**Files:**
- Create: `service/AccountScopeService.java`, `dto/AccountRef.java`
- Modify: `repository/JournalLineRepository.java` (add `@Query("select distinct l.sellerId from JournalLine l where l.sellerId is not null") List<UUID> distinctSellerIds();`)
- Modify: `controller/AdminLedgerController.java` (add `GET /accounts`)
- Test: `service/AccountScopeServiceTest.java`

**Behavior:**
- `listAccounts()`: always include `{id:"house", kind:HOUSE, name:"House — AfroTransact", hasActivity:true}`; append one `{id:<uuid>, kind:SELLER, name:<resolved or "Seller "+short-uuid>, hasActivity:true}` per `distinctSellerIds()`. (Seller display-name resolution best-effort: if a `SellerServiceClient` is wired, use it; else the short-UUID label — do NOT fail the list if names can't resolve.)
- `resolve(account)`: `null`/`"all"` → `AccountScope.ALL`; `"house"` → `HOUSE`; a UUID string that is in `distinctSellerIds()` → `SELLER(sellerId)`; anything else → `ResponseStatusException(NOT_FOUND)`.

- [ ] **Step 1: failing test** — `distinctSellerIds` returns seeded seller ids; `resolve("house")`/`resolve(uuid)`/`resolve("all")` classify correctly; `resolve("nonsense")` → 404; `listAccounts` includes house + each seller. (Mockito with a mocked repo for the resolve/list logic; use a small `@DataJpaTest`-style or Testcontainers test only if exercising the real `distinctSellerIds` query.)
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement `AccountScope` (record/enum), `AccountRef` DTO, `AccountScopeService`, the repo query, and the `GET /accounts` controller method returning `List<AccountRef>`.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** commit `feat(accounting): account list + scope resolution (D1a)`.

---

### Task 2: Reshaped P&L — `PnlService.pnl(scope, from, to)`

**Files:**
- Create: `service/PnlService.java`, `dto/PnlDto.java`, `dto/PnlLine.java`
- Test: `service/PnlServiceTest.java`

**Consumes:** `BalanceService.balanceCents(String code, LocalDateTime asOf)`; `JournalLineRepository` seller-scoped sums (add as needed); `AccountService.sellerPayable(sellerId).getCode()`.

**Compute (all cents `long`; flow = balance(to)−balance(from)):**

- **HOUSE** — windowed flow of house-coded accounts:
  - `grossSales = flow(house.sales_revenue)`, `discounts = flow(house.discounts)`, `netSales = grossSales − discounts`
  - `shippingRevenue = flow(shipping.income)`, `cogs = flow(house.cogs)`, `shippingCost = flow(shipping.cost)` *(if present; else 0)*, `stripeFees = flow(platform.stripe_fees)`
  - `grossMargin = netSales + shippingRevenue − cogs − shippingCost − stripeFees`
  - `opex = Σ flow(operating:*)`, `netProfit = grossMargin − opex`
  - memo `taxCollected = flow(taxes_payable:US)` (excluded from profit)
- **SELLER** — from seller-tagged lines over `[from,to]` (all filtered `seller_id = sellerId`):
  - `grossSales`, `discounts` → `netSales`; `commission = Σ commission_revenue lines for seller`; `stripeFeeShare = Σ seller stripe-fee lines`; `shippingCollected`; `netEarnings = netSales − commission − stripeFeeShare + shippingCollected`
  - `balanceOwed = balanceCents(seller_payable:<sellerId>, to)` (stock); `paidOut = Σ transfer/debit lines to seller_payable in window`
- **ALL** — `houseNetProfit + Σ commission_revenue(all sellers) − sharedAdjustments`; also `gmv = house grossSales + Σ seller grossSales`.

`PnlDto` = `{ scope, kind, from, to, currency, lines: List<PnlLine>, memos: Map }` where `PnlLine = {label, amountCents, role: BASE|ADD|SUB|SUBTOTAL|TOTAL}` (drives the frontend waterfall directly).

- [ ] **Step 1: failing test** — three cases (house, seller, all) with a mocked `BalanceService` + repo returning known figures; assert each line + the subtotal/total arithmetic and that the shapes differ (house has COGS/OpEx/netProfit; seller has commission/netEarnings/balanceOwed; all has consolidated). Assert seller P&L uses posted commission (not a re-derived rate).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement `PnlService` + DTOs. Add any repo sum queries needed (e.g. `@Query` summing `commission_revenue` lines where `seller_id = :id` and entry postedAt in `[from,to]`).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** commit `feat(accounting): house/seller/consolidated P&L computation (D1a)`.

---

### Task 3: Scope `journal` + `trial-balance` + `summary`

**Files:**
- Modify: `repository/JournalLineRepository.java` — `signedBalancesByAccountForSeller(LocalDateTime asOf, UUID sellerId)` and a house-scoped variant (filter to house-coded account codes / null seller_id); `repository/JournalEntryRepository.java` — `findFilteredForSeller(...)`.
- Modify: `service/LedgerReportService.java` — `journal(scope, …)`, `trialBalance(scope, asOf)`; scope the summary KPIs (or delegate summary to `PnlService` per scope).
- Test: `service/LedgerScopeTest.java` (Testcontainers — real Postgres, extends `AbstractPostgresIntegrationTest`, since these are query-level).

**Behavior:** `ALL` → existing queries unchanged (no regression). `SELLER` → only lines with `seller_id = sellerId`. `HOUSE` → only house-coded accounts (null seller_id). Journal pagination + existing filters preserved.

- [ ] **Step 1: failing test** — seed entries: a house sale, a seller sale (seller_id set). Assert `journal(SELLER)` returns only the seller's lines; `journal(HOUSE)` excludes them; `trialBalance(SELLER)` shows only seller accounts; `ALL` shows everything (regression guard).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement scoped queries + thread scope through the service methods.
- [ ] **Step 4:** run → PASS; run full module suite (no regression to Phase A–C tests).
- [ ] **Step 5:** commit `feat(accounting): scope journal + trial-balance + summary by account (D1a)`.

---

### Task 4: Controller wiring + house-only guards

**Files:**
- Modify: `controller/AdminLedgerController.java`
- Test: `controller/AdminLedgerScopeControllerTest.java` (Mockito — controller delegates)

**Behavior:**
- Add `@RequestParam(required=false) String account` to `summary`, `journal`, `trial-balance`, and the new `pnl` endpoint; resolve via `AccountScopeService.resolve(account)` (404 on unknown) and pass the scope to the services.
- `GET /pnl?account=&from=&to=` → `PnlService.pnl(scope, from, to)`.
- Reconciliation + all `opex` endpoints: if `account` resolves to `SELLER`, return `409/422` with a body `{ applicable:false, reason:"House-only — reconciliation/operating-costs are AfroTransact platform figures" }` (or omit the param entirely and document house-only). Do NOT return seller data.
- Keep `/first-party/pnl` working (delegate to `pnl(HOUSE,…)`) or mark deprecated — don't break existing callers.

- [ ] **Step 1: failing test** — controller with mocked services: `pnl?account=<seller>` calls `PnlService.pnl(SELLER,…)`; `journal?account=house` scopes HOUSE; `reconciliation?account=<seller>` returns the not-applicable response, never calls the seller path; unknown account → 404.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run → PASS; **full module suite** green.
- [ ] **Step 5:** commit `feat(accounting): account param on report endpoints + house-only guards (D1a)`.

## Phase D1a exit criteria

- `GET /accounts` lists House + active sellers.
- `GET /pnl?account=` returns the correct shape (house full-retail / seller marketplace / consolidated), tying to the ledger.
- `summary`/`journal`/`trial-balance` scope to the account; `ALL` is byte-unchanged (no regression).
- `reconciliation` + `opex` are house-only (seller scope → not-applicable, never leaks).
- Module suite green; deploy `svc_accounting`.

## Self-review

- Spec coverage: account model (Task 1), two P&L shapes + consolidated (Task 2), scoped journal/trial/summary (Task 3), API + house-only guards (Task 4). `/accounts`, `/pnl` covered. D2 authorization seam: `AccountScopeService.resolve` is the single point where D2 will force a seller caller to their own id.
- Consistency: `AccountScope`, `PnlDto`, `AccountRef` names used consistently across tasks. Money `long` throughout. Flow-vs-stock rule stated once, applied in Task 2.
- No placeholders: tricky logic (P&L math, scoping definitions) specified; mechanical query/DTO code left to implementers with exact signatures.
