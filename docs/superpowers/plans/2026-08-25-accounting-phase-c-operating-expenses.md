# Accounting Phase C — Operating Expenses (OpEx core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture AfroTransact's operating expenses in the ledger so the P&L can reach true net profit — via `operating:*` expense accounts, a persisted `OperatingExpense` record, and admin endpoints to record / list / void an OpEx.

**Architecture:** A new `OperatingExpense` JPA entity + table (`ledger.operating_expenses`) is the durable business record; each active OpEx also posts a balanced double-entry `DR operating:<category> / CR bank.operating` through the existing `JournalService` (so the P&L reads it as an expense-account balance, and Stripe reconciliation is unaffected because `bank.operating`, not `stripe.platform_balance`, is the cash side). Voiding posts the reversing entry and flags the row. Booking is idempotent on `(source, external_ref)` so a later GCP import (Phase C2) can call the same `record(...)` without duplicating rows.

**Tech Stack:** Java 21 (GraalVM), Spring Boot, Flyway (Postgres, schema `ledger`), Lombok, JUnit 5 + Mockito + AssertJ, `./mvnw -o` (offline). Module: `services/accounting`.

## Scope

**In scope (Phase C):** `operating:*` account seed; `OperatingExpense` entity/table/repository; `OperatingExpenseService.record/list/void`; admin OpEx endpoints. This ships a fully usable OpEx capability: an admin (or a monthly manual entry of the GCP invoice total — the design spec's zero-config fallback) puts operating spend into the ledger, ready for the Phase D P&L.

**Out of scope — deferred to Phase C2 (separate plan):** the automated GCP Cloud-Billing → BigQuery import (new `google-cloud-bigquery` dependency, Workload Identity for BigQuery, the one-time billing-export toggle, and a `@Scheduled` importer). C2 is a thin reader that calls the `OperatingExpenseService.record(...)` built here with `source=gcp` + an `external_ref` (billing-row/period id); the `(source, external_ref)` idempotency and the `source`/`external_ref` columns added here are the seam it plugs into. Stripe fees are already booked as an expense by Phase B and are **not** re-imported.

**Out of scope — Phase D:** the P&L compute endpoint and the admin dashboard redesign. Phase C only needs to book expenses to the correct `operating:*` accounts; Phase D reads their balances.

## Global Constraints

- Money is always integer cents (`long` / `BIGINT`); never float or `BigDecimal` drift.
- Every posted ledger entry balances (Σ DR == Σ CR), DB-enforced by `ledger.assert_entry_balanced`.
- Ledger posting goes only through `JournalService.post(PostRequest)`; it dedupes on the `(event_id, event_type)` unique constraint and returns `PostResult.skipped(id)` on replay. Never insert `ledger.journal_lines` directly.
- Package `com.afrotransact.accounting`. NO inline fully-qualified class names — add a proper `import` and use the short name.
- Admin endpoints live under `/api/v1/admin/**` and are gated by the existing security layer (do **not** add per-method auth).
- OpEx double-entry is `DR operating:<category>` / `CR bank.operating` (reversed on void). `bank.operating` already exists (seeded in `V2`, type `asset`); the four `operating:*` accounts are seeded in this phase.
- Categories are a closed set: `infrastructure`, `tools`, `other`. The account code is exactly `operating:<category>`.
- `source` is a closed set: `manual`, `gcp`, `stripe`. This phase's endpoint always records `manual`; the column exists for C2.

## File Structure

- `services/accounting/src/main/resources/db/migration/V6__seed_operating_accounts.sql` — seed `operating:infrastructure|tools|other` (type `expense`).
- `services/accounting/src/main/resources/db/migration/V7__operating_expenses.sql` — `ledger.operating_expenses` table + partial unique index on `(source, external_ref)`.
- `services/accounting/src/main/java/com/afrotransact/accounting/model/OperatingExpense.java` — JPA entity.
- `services/accounting/src/main/java/com/afrotransact/accounting/repository/OperatingExpenseRepository.java` — Spring Data repo.
- `services/accounting/src/main/java/com/afrotransact/accounting/service/OperatingExpenseService.java` — record / list / void + journal posting.
- `services/accounting/src/main/java/com/afrotransact/accounting/dto/RecordOpExRequest.java`, `OpExDto.java`, `VoidOpExRequest.java` — API DTOs.
- `services/accounting/src/main/java/com/afrotransact/accounting/controller/AdminOpExController.java` — `/api/v1/admin/ledger/opex` endpoints (new controller; keeps the already-large `AdminLedgerController` focused).
- `services/accounting/src/test/java/com/afrotransact/accounting/support/AbstractPostgresIntegrationTest.java` — shared Testcontainers Postgres base (`@SpringBootTest @Testcontainers`, `PostgreSQLContainer` + `@DynamicPropertySource` wiring the datasource, Kafka listener auto-startup disabled). DB-backed tests (Task 1 seed, Task 2 repository) extend it; the module had no DB-test harness before, so this is new infra (deps managed by the Spring Boot 4.0.3 BOM — no explicit versions). Tasks 3–4 stay pure Mockito.
- Tests alongside each: `OperatingExpenseServiceTest`, `AdminOpExControllerTest`.

**Interfaces produced (for later tasks / Phase C2 / Phase D):**
- `OperatingExpenseService.record(RecordCommand)` → `OperatingExpense` — idempotent on `(source, externalRef)` when `externalRef != null`; books `DR operating:<category> / CR bank.operating`.
- `OperatingExpenseService.list(LocalDate from, LocalDate to, String category)` → `List<OperatingExpense>`.
- `OperatingExpenseService.voidExpense(UUID id, UUID adminId, String reason)` → `OperatingExpense`.
- `RecordCommand` (record/POJO): `expenseDate:LocalDate, category:String, amountCents:long, currency:String, description:String, source:String, externalRef:String (nullable), recurring:boolean, createdBy:UUID`.

---

### Task 1: Seed `operating:*` expense accounts (V6 migration)

**Files:**
- Create: `services/accounting/src/main/resources/db/migration/V6__seed_operating_accounts.sql`
- Test: `services/accounting/src/test/java/com/afrotransact/accounting/service/OperatingAccountsSeedTest.java`

**Interfaces:**
- Produces: account codes `operating:infrastructure`, `operating:tools`, `operating:other` (type `expense`, USD), resolvable via `AccountService.requireByCode(...)`.

- [ ] **Step 1: Write the failing test**

```java
package com.afrotransact.accounting.service;

import com.afrotransact.accounting.model.Account;
import com.afrotransact.accounting.repository.AccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class OperatingAccountsSeedTest {

    @Autowired AccountRepository accounts;

    @Test
    void operatingExpenseAccountsAreSeeded() {
        for (String code : new String[]{"operating:infrastructure", "operating:tools", "operating:other"}) {
            Account a = accounts.findByCode(code).orElseThrow(() ->
                    new AssertionError("missing seeded account: " + code));
            assertThat(a.getType()).isEqualTo("expense");
            assertThat(a.getCurrency()).isEqualTo("USD");
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export JAVA_HOME=/Library/Java/JavaVirtualMachines/graalvm-jdk-21/Contents/Home && cd services/accounting && ./mvnw -o test -Dtest=OperatingAccountsSeedTest`
Expected: FAIL — accounts not found (migration absent). If the suite needs a DB, it uses the same Testcontainers/embedded setup the existing `@SpringBootTest` tests use — do not introduce a new test harness.

- [ ] **Step 3: Write the migration**

```sql
-- V6__seed_operating_accounts.sql
-- Operating-expense accounts for the house P&L (Phase C). Booked with a debit
-- (DR operating:<category> / CR bank.operating) when an OpEx is recorded; they
-- roll up under "Operating expenses" in the P&L (Phase D). The cash side is
-- bank.operating (seeded in V2), so stripe.platform_balance / Stripe
-- reconciliation is unaffected.
INSERT INTO ledger.accounts (code, type, currency, description) VALUES
    ('operating:infrastructure', 'expense', 'USD', 'Cloud/infrastructure spend (GCP, hosting) — FinOps'),
    ('operating:tools',          'expense', 'USD', 'Software tools & subscriptions'),
    ('operating:other',          'expense', 'USD', 'Other operating expenses')
ON CONFLICT (code) DO NOTHING;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./mvnw -o test -Dtest=OperatingAccountsSeedTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/accounting/src/main/resources/db/migration/V6__seed_operating_accounts.sql \
        services/accounting/src/test/java/com/afrotransact/accounting/service/OperatingAccountsSeedTest.java
git commit -m "feat(accounting): seed operating:* expense accounts (Phase C)"
```

---

### Task 2: `OperatingExpense` entity + table + repository (V7 migration)

**Files:**
- Create: `services/accounting/src/main/resources/db/migration/V7__operating_expenses.sql`
- Create: `services/accounting/src/main/java/com/afrotransact/accounting/model/OperatingExpense.java`
- Create: `services/accounting/src/main/java/com/afrotransact/accounting/repository/OperatingExpenseRepository.java`
- Test: `services/accounting/src/test/java/com/afrotransact/accounting/repository/OperatingExpenseRepositoryTest.java`

**Interfaces:**
- Consumes: nothing from prior tasks (the FK to `journal_entries.id` is set by the service in Task 3).
- Produces: `OperatingExpense` entity (fields below); `OperatingExpenseRepository` with `findBySourceAndExternalRef(String, String)` and `findByExpenseDateBetween(...)`.

- [ ] **Step 1: Write the failing test**

```java
package com.afrotransact.accounting.repository;

import com.afrotransact.accounting.model.OperatingExpense;
import com.afrotransact.accounting.support.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

// Extends the Testcontainers Postgres base (created in Task 1) — the partial
// unique index on (source, external_ref) is Postgres-specific and must run
// against real Postgres, not an in-memory DB.
class OperatingExpenseRepositoryTest extends AbstractPostgresIntegrationTest {

    @Autowired OperatingExpenseRepository repo;

    private OperatingExpense sample(String source, String externalRef) {
        return OperatingExpense.builder()
                .expenseDate(LocalDate.of(2026, 8, 1))
                .category("infrastructure").amountCents(12_000L).currency("USD")
                .description("GCP August").source(source).externalRef(externalRef)
                .recurring(true).status("active").createdBy(UUID.randomUUID())
                .build();
    }

    @Test
    void persistsAndFindsBySourceAndExternalRef() {
        OperatingExpense saved = repo.save(sample("gcp", "billing-2026-08"));
        assertThat(saved.getId()).isNotNull();
        assertThat(repo.findBySourceAndExternalRef("gcp", "billing-2026-08")).isPresent();
    }

    @Test
    void enforcesUniqueSourceExternalRef() {
        repo.save(sample("gcp", "billing-2026-09"));
        assertThatThrownBy(() -> repo.saveAndFlush(sample("gcp", "billing-2026-09")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void allowsMultipleManualRowsWithNullExternalRef() {
        repo.saveAndFlush(sample("manual", null));
        repo.saveAndFlush(sample("manual", null)); // partial unique index → null not constrained
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./mvnw -o test -Dtest=OperatingExpenseRepositoryTest`
Expected: FAIL — `OperatingExpense` / repository / table do not exist (compile or schema error).

- [ ] **Step 3a: Write the migration**

```sql
-- V7__operating_expenses.sql
-- Durable business record for an operating expense. Each active row also has a
-- balanced journal entry (DR operating:<category> / CR bank.operating) linked
-- via journal_entry_id. Idempotent imports (e.g. GCP billing in Phase C2) key
-- on (source, external_ref); manual entries carry a null external_ref.
CREATE TABLE IF NOT EXISTS ledger.operating_expenses (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_date      DATE          NOT NULL,
    category          VARCHAR(40)   NOT NULL CHECK (category IN ('infrastructure','tools','other')),
    amount_cents      BIGINT        NOT NULL CHECK (amount_cents > 0),
    currency          VARCHAR(3)    NOT NULL DEFAULT 'USD',
    description        TEXT,
    source            VARCHAR(20)   NOT NULL CHECK (source IN ('manual','gcp','stripe')),
    external_ref      VARCHAR(200),
    recurring          BOOLEAN       NOT NULL DEFAULT false,
    status             VARCHAR(10)   NOT NULL DEFAULT 'active' CHECK (status IN ('active','void')),
    journal_entry_id  UUID          REFERENCES ledger.journal_entries (id),
    void_reason        TEXT,
    voided_by          UUID,
    voided_at          TIMESTAMPTZ,
    created_by         UUID,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Idempotency for imported expenses; manual rows (null external_ref) are unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS uq_operating_expenses_source_ref
    ON ledger.operating_expenses (source, external_ref)
    WHERE external_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operating_expenses_date
    ON ledger.operating_expenses (expense_date);
```

- [ ] **Step 3b: Write the entity**

```java
package com.afrotransact.accounting.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "operating_expenses", schema = "ledger")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OperatingExpense {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "expense_date", nullable = false)
    private LocalDate expenseDate;

    @Column(nullable = false, length = 40)
    private String category;

    @Column(name = "amount_cents", nullable = false)
    private long amountCents;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "USD";

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 20)
    private String source;

    @Column(name = "external_ref", length = 200)
    private String externalRef;

    @Column(nullable = false)
    @Builder.Default
    private boolean recurring = false;

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String status = "active";

    @Column(name = "journal_entry_id")
    private UUID journalEntryId;

    @Column(name = "void_reason", columnDefinition = "TEXT")
    private String voidReason;

    @Column(name = "voided_by")
    private UUID voidedBy;

    @Column(name = "voided_at")
    private LocalDateTime voidedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
```

- [ ] **Step 3c: Write the repository**

```java
package com.afrotransact.accounting.repository;

import com.afrotransact.accounting.model.OperatingExpense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OperatingExpenseRepository extends JpaRepository<OperatingExpense, UUID> {

    Optional<OperatingExpense> findBySourceAndExternalRef(String source, String externalRef);

    List<OperatingExpense> findByExpenseDateBetweenOrderByExpenseDateDesc(LocalDate from, LocalDate to);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./mvnw -o test -Dtest=OperatingExpenseRepositoryTest`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add services/accounting/src/main/resources/db/migration/V7__operating_expenses.sql \
        services/accounting/src/main/java/com/afrotransact/accounting/model/OperatingExpense.java \
        services/accounting/src/main/java/com/afrotransact/accounting/repository/OperatingExpenseRepository.java \
        services/accounting/src/test/java/com/afrotransact/accounting/repository/OperatingExpenseRepositoryTest.java
git commit -m "feat(accounting): OperatingExpense entity + table (Phase C)"
```

---

### Task 3: `OperatingExpenseService` — record / list / void + journal posting

**Files:**
- Create: `services/accounting/src/main/java/com/afrotransact/accounting/service/OperatingExpenseService.java`
- Test: `services/accounting/src/test/java/com/afrotransact/accounting/service/OperatingExpenseServiceTest.java`

**Interfaces:**
- Consumes: `OperatingExpenseRepository` (Task 2); `AccountService.requireByCode(String)` → `Account`; `JournalService.post(PostRequest)` → `PostResult` (`getEntryId()`), with `PostRequest.builder().eventId(String≤160).eventType(String≤80).description().metadata(Map).lines(List<LineSpec>)` and `LineSpec.builder().account(Account).direction(JournalLine.DR|CR).amountCents(long).currency(String).build()`.
- Produces: `record(RecordCommand)`, `list(from,to,category)`, `voidExpense(id,adminId,reason)` (see class below).

- [ ] **Step 1: Write the failing test**

```java
package com.afrotransact.accounting.service;

import com.afrotransact.accounting.model.Account;
import com.afrotransact.accounting.model.OperatingExpense;
import com.afrotransact.accounting.repository.OperatingExpenseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class OperatingExpenseServiceTest {

    OperatingExpenseRepository repo = mock(OperatingExpenseRepository.class);
    AccountService accountService = mock(AccountService.class);
    JournalService journalService = mock(JournalService.class);
    OperatingExpenseService service;

    Account infra = account("operating:infrastructure");
    Account bank  = account("bank.operating");

    private static Account account(String code) {
        Account a = new Account();
        a.setId(UUID.randomUUID());
        a.setCode(code);
        a.setCurrency("USD");
        return a;
    }

    @BeforeEach
    void setup() {
        service = new OperatingExpenseService(repo, accountService, journalService);
        when(accountService.requireByCode("operating:infrastructure")).thenReturn(infra);
        when(accountService.requireByCode("bank.operating")).thenReturn(bank);
        when(repo.save(any(OperatingExpense.class))).thenAnswer(inv -> {
            OperatingExpense e = inv.getArgument(0);
            if (e.getId() == null) e.setId(UUID.randomUUID());
            return e;
        });
        UUID entryId = UUID.randomUUID();
        when(journalService.post(any())).thenReturn(JournalService.PostResult.builder()
                .entryId(entryId).replayed(false).build());
    }

    private OperatingExpenseService.RecordCommand cmd(String source, String externalRef) {
        return OperatingExpenseService.RecordCommand.builder()
                .expenseDate(LocalDate.of(2026, 8, 1)).category("infrastructure")
                .amountCents(12_000L).currency("USD").description("GCP August")
                .source(source).externalRef(externalRef).recurring(true)
                .createdBy(UUID.randomUUID()).build();
    }

    @Test
    void record_booksDebitExpenseCreditBank_andBalances() {
        service.record(cmd("manual", null));

        ArgumentCaptor<JournalService.PostRequest> cap =
                ArgumentCaptor.forClass(JournalService.PostRequest.class);
        verify(journalService).post(cap.capture());
        var lines = cap.getValue().getLines();
        assertThat(lines).hasSize(2);
        // DR operating:infrastructure 12000, CR bank.operating 12000
        assertThat(lines).anySatisfy(l -> {
            assertThat(l.getAccount().getCode()).isEqualTo("operating:infrastructure");
            assertThat(l.getDirection()).isEqualTo(com.afrotransact.accounting.model.JournalLine.DR);
            assertThat(l.getAmountCents()).isEqualTo(12_000L);
        });
        assertThat(lines).anySatisfy(l -> {
            assertThat(l.getAccount().getCode()).isEqualTo("bank.operating");
            assertThat(l.getDirection()).isEqualTo(com.afrotransact.accounting.model.JournalLine.CR);
            assertThat(l.getAmountCents()).isEqualTo(12_000L);
        });
        assertThat(cap.getValue().getEventType()).isEqualTo("opex.recorded");
    }

    @Test
    void record_isIdempotentOnSourceAndExternalRef() {
        OperatingExpense existing = OperatingExpense.builder()
                .id(UUID.randomUUID()).source("gcp").externalRef("billing-2026-08")
                .category("infrastructure").amountCents(12_000L).status("active").build();
        when(repo.findBySourceAndExternalRef("gcp", "billing-2026-08"))
                .thenReturn(Optional.of(existing));

        OperatingExpense result = service.record(cmd("gcp", "billing-2026-08"));

        assertThat(result.getId()).isEqualTo(existing.getId());
        verify(journalService, never()).post(any()); // no duplicate posting
        verify(repo, never()).save(any());
    }

    @Test
    void void_postsReversingEntry_andFlagsRow() {
        UUID id = UUID.randomUUID();
        OperatingExpense e = OperatingExpense.builder()
                .id(id).category("infrastructure").amountCents(12_000L).currency("USD")
                .source("manual").status("active").build();
        when(repo.findById(id)).thenReturn(Optional.of(e));
        UUID admin = UUID.randomUUID();

        service.voidExpense(id, admin, "double-booked, reversing");

        ArgumentCaptor<JournalService.PostRequest> cap =
                ArgumentCaptor.forClass(JournalService.PostRequest.class);
        verify(journalService).post(cap.capture());
        var lines = cap.getValue().getLines();
        // reversed: DR bank.operating / CR operating:infrastructure
        assertThat(lines).anySatisfy(l -> {
            assertThat(l.getAccount().getCode()).isEqualTo("bank.operating");
            assertThat(l.getDirection()).isEqualTo(com.afrotransact.accounting.model.JournalLine.DR);
        });
        assertThat(cap.getValue().getEventType()).isEqualTo("opex.void");
        assertThat(e.getStatus()).isEqualTo("void");
        assertThat(e.getVoidedBy()).isEqualTo(admin);
    }

    @Test
    void void_isIdempotentWhenAlreadyVoid() {
        UUID id = UUID.randomUUID();
        OperatingExpense e = OperatingExpense.builder().id(id).status("void")
                .category("other").amountCents(500L).currency("USD").build();
        when(repo.findById(id)).thenReturn(Optional.of(e));

        service.voidExpense(id, UUID.randomUUID(), "already voided");

        verify(journalService, never()).post(any());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./mvnw -o test -Dtest=OperatingExpenseServiceTest`
Expected: FAIL — `OperatingExpenseService` / `RecordCommand` do not exist.

- [ ] **Step 3: Write the service**

Confirm the `JournalService.LineSpec` / `PostRequest` / `PostResult` accessor names against the source (`getLines()`, `getEventType()`, `getAccount()`, `getDirection()`, `getAmountCents()`, `getEntryId()`) before finalizing — they are Lombok `@Getter @Builder`. Use `JournalLine.DR` / `JournalLine.CR` constants.

```java
package com.afrotransact.accounting.service;

import com.afrotransact.accounting.model.Account;
import com.afrotransact.accounting.model.JournalLine;
import com.afrotransact.accounting.model.OperatingExpense;
import com.afrotransact.accounting.repository.OperatingExpenseRepository;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Records operating expenses as both a durable business row and a balanced
 * ledger entry (DR operating:&lt;category&gt; / CR bank.operating). Voiding
 * posts the reversing entry and flags the row. Booking is idempotent on
 * (source, external_ref) so a later importer (Phase C2 GCP billing) can call
 * {@link #record} repeatedly without duplicating rows or postings.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OperatingExpenseService {

    private final OperatingExpenseRepository repo;
    private final AccountService accountService;
    private final JournalService journalService;

    @Transactional
    public OperatingExpense record(RecordCommand cmd) {
        // Idempotent re-import: same (source, external_ref) → return the existing row.
        if (cmd.getExternalRef() != null) {
            Optional<OperatingExpense> existing =
                    repo.findBySourceAndExternalRef(cmd.getSource(), cmd.getExternalRef());
            if (existing.isPresent()) {
                log.info("OpEx already recorded for source={} external_ref={} → returning existing {}",
                        cmd.getSource(), cmd.getExternalRef(), existing.get().getId());
                return existing.get();
            }
        }

        String accountCode = "operating:" + cmd.getCategory();
        Account expenseAcct = accountService.requireByCode(accountCode);
        Account bank = accountService.requireByCode("bank.operating");

        OperatingExpense e = OperatingExpense.builder()
                .expenseDate(cmd.getExpenseDate())
                .category(cmd.getCategory())
                .amountCents(cmd.getAmountCents())
                .currency(cmd.getCurrency() == null ? "USD" : cmd.getCurrency())
                .description(cmd.getDescription())
                .source(cmd.getSource())
                .externalRef(cmd.getExternalRef())
                .recurring(cmd.isRecurring())
                .status("active")
                .createdBy(cmd.getCreatedBy())
                .build();
        e = repo.save(e);

        String anchor = cmd.getExternalRef() != null ? cmd.getExternalRef() : e.getId().toString();
        String eventId = ("opex:" + cmd.getSource() + ":" + anchor);
        if (eventId.length() > 160) eventId = eventId.substring(0, 160);

        JournalService.PostResult result = journalService.post(JournalService.PostRequest.builder()
                .eventId(eventId)
                .eventType("opex.recorded")
                .description("OpEx " + cmd.getCategory()
                        + (cmd.getDescription() != null ? ": " + cmd.getDescription() : ""))
                .metadata(Map.of(
                        "opex_id", e.getId().toString(),
                        "source", cmd.getSource(),
                        "category", cmd.getCategory()))
                .lines(List.of(
                        JournalService.LineSpec.builder()
                                .account(expenseAcct).direction(JournalLine.DR)
                                .amountCents(cmd.getAmountCents()).currency(e.getCurrency()).build(),
                        JournalService.LineSpec.builder()
                                .account(bank).direction(JournalLine.CR)
                                .amountCents(cmd.getAmountCents()).currency(e.getCurrency()).build()))
                .build());

        e.setJournalEntryId(result.getEntryId());
        return repo.save(e);
    }

    @Transactional(readOnly = true)
    public List<OperatingExpense> list(LocalDate from, LocalDate to, String category) {
        List<OperatingExpense> rows = repo.findByExpenseDateBetweenOrderByExpenseDateDesc(from, to);
        if (category == null || category.isBlank()) return rows;
        return rows.stream().filter(r -> category.equals(r.getCategory())).toList();
    }

    @Transactional
    public OperatingExpense voidExpense(UUID id, UUID adminId, String reason) {
        OperatingExpense e = repo.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "OpEx not found: " + id));
        if ("void".equals(e.getStatus())) {
            return e; // idempotent
        }

        Account expenseAcct = accountService.requireByCode("operating:" + e.getCategory());
        Account bank = accountService.requireByCode("bank.operating");

        journalService.post(JournalService.PostRequest.builder()
                .eventId("opex:void:" + e.getId())
                .eventType("opex.void")
                .description("Void OpEx " + e.getId() + ": " + reason)
                .metadata(Map.of(
                        "opex_id", e.getId().toString(),
                        "reason", reason,
                        "admin_id", adminId.toString()))
                .lines(List.of(
                        JournalService.LineSpec.builder()
                                .account(bank).direction(JournalLine.DR)
                                .amountCents(e.getAmountCents()).currency(e.getCurrency()).build(),
                        JournalService.LineSpec.builder()
                                .account(expenseAcct).direction(JournalLine.CR)
                                .amountCents(e.getAmountCents()).currency(e.getCurrency()).build()))
                .build());

        e.setStatus("void");
        e.setVoidReason(reason);
        e.setVoidedBy(adminId);
        e.setVoidedAt(LocalDateTime.now());
        return repo.save(e);
    }

    @Getter
    @Builder
    public static class RecordCommand {
        private final LocalDate expenseDate;
        private final String category;
        private final long amountCents;
        private final String currency;
        private final String description;
        private final String source;
        private final String externalRef;
        private final boolean recurring;
        private final UUID createdBy;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./mvnw -o test -Dtest=OperatingExpenseServiceTest`
Expected: PASS (all four cases).

- [ ] **Step 5: Commit**

```bash
git add services/accounting/src/main/java/com/afrotransact/accounting/service/OperatingExpenseService.java \
        services/accounting/src/test/java/com/afrotransact/accounting/service/OperatingExpenseServiceTest.java
git commit -m "feat(accounting): OperatingExpenseService record/list/void + journal posting (Phase C)"
```

---

### Task 4: Admin OpEx endpoints (`/api/v1/admin/ledger/opex`)

**Files:**
- Create: `services/accounting/src/main/java/com/afrotransact/accounting/dto/RecordOpExRequest.java`
- Create: `services/accounting/src/main/java/com/afrotransact/accounting/dto/OpExDto.java`
- Create: `services/accounting/src/main/java/com/afrotransact/accounting/dto/VoidOpExRequest.java`
- Create: `services/accounting/src/main/java/com/afrotransact/accounting/controller/AdminOpExController.java`
- Test: `services/accounting/src/test/java/com/afrotransact/accounting/controller/AdminOpExControllerTest.java`

**Interfaces:**
- Consumes: `OperatingExpenseService` (Task 3).
- Produces: `POST /api/v1/admin/ledger/opex` (record, source forced `manual`), `GET /api/v1/admin/ledger/opex?from=&to=&category=` (list), `POST /api/v1/admin/ledger/opex/{id}/void` (void). Admin-gated by the existing security layer (same as `AdminLedgerController` — no per-method auth).

- [ ] **Step 1: Write the failing test** (unit-level: construct the controller with a mocked `OperatingExpenseService`, call methods directly — mirror how the accounting module's other controller tests exercise controllers without a full web context)

```java
package com.afrotransact.accounting.controller;

import com.afrotransact.accounting.dto.RecordOpExRequest;
import com.afrotransact.accounting.dto.VoidOpExRequest;
import com.afrotransact.accounting.model.OperatingExpense;
import com.afrotransact.accounting.service.OperatingExpenseService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AdminOpExControllerTest {

    OperatingExpenseService service = mock(OperatingExpenseService.class);
    AdminOpExController controller = new AdminOpExController(service);

    @Test
    void record_mapsRequestToManualCommand() {
        when(service.record(any())).thenAnswer(inv -> {
            OperatingExpenseService.RecordCommand c = inv.getArgument(0);
            return OperatingExpense.builder()
                    .id(UUID.randomUUID()).category(c.getCategory())
                    .amountCents(c.getAmountCents()).currency(c.getCurrency())
                    .source(c.getSource()).status("active").build();
        });
        RecordOpExRequest req = new RecordOpExRequest();
        req.setExpenseDate(LocalDate.of(2026, 8, 1));
        req.setCategory("infrastructure");
        req.setAmountCents(12_000L);
        req.setDescription("GCP August");
        req.setRecurring(true);

        var resp = controller.record(UUID.randomUUID(), req);

        ArgumentCaptor<OperatingExpenseService.RecordCommand> cap =
                ArgumentCaptor.forClass(OperatingExpenseService.RecordCommand.class);
        verify(service).record(cap.capture());
        assertThat(cap.getValue().getSource()).isEqualTo("manual"); // endpoint forces manual
        assertThat(cap.getValue().getCategory()).isEqualTo("infrastructure");
        assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(resp.getBody().getSource()).isEqualTo("manual");
    }

    @Test
    void void_delegatesWithReason() {
        UUID id = UUID.randomUUID();
        when(service.voidExpense(any(), any(), any())).thenReturn(
                OperatingExpense.builder().id(id).status("void").category("other")
                        .amountCents(500L).build());
        VoidOpExRequest req = new VoidOpExRequest();
        req.setReason("double-booked, reversing entry");

        UUID admin = UUID.randomUUID();
        controller.voidExpense(admin, id, req);

        verify(service).voidExpense(id, admin, "double-booked, reversing entry");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./mvnw -o test -Dtest=AdminOpExControllerTest`
Expected: FAIL — controller / DTOs do not exist.

- [ ] **Step 3a: Write the DTOs**

```java
// RecordOpExRequest.java
package com.afrotransact.accounting.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class RecordOpExRequest {

    @NotNull
    private LocalDate expenseDate;

    @NotBlank
    @Pattern(regexp = "infrastructure|tools|other",
            message = "category must be one of: infrastructure, tools, other")
    private String category;

    @NotNull
    @Positive
    private Long amountCents;

    @Size(max = 3)
    private String currency = "USD";

    @Size(max = 2000)
    private String description;

    private boolean recurring = false;
}
```

```java
// VoidOpExRequest.java
package com.afrotransact.accounting.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class VoidOpExRequest {

    @NotBlank
    @Size(min = 10, max = 2000, message = "A void reason is required (10-2000 chars)")
    private String reason;
}
```

```java
// OpExDto.java
package com.afrotransact.accounting.dto;

import com.afrotransact.accounting.model.OperatingExpense;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.util.UUID;

@Getter
@Builder
public class OpExDto {
    private final UUID id;
    private final LocalDate expenseDate;
    private final String category;
    private final long amountCents;
    private final String currency;
    private final String description;
    private final String source;
    private final boolean recurring;
    private final String status;
    private final UUID journalEntryId;

    public static OpExDto from(OperatingExpense e) {
        return OpExDto.builder()
                .id(e.getId())
                .expenseDate(e.getExpenseDate())
                .category(e.getCategory())
                .amountCents(e.getAmountCents())
                .currency(e.getCurrency())
                .description(e.getDescription())
                .source(e.getSource())
                .recurring(e.isRecurring())
                .status(e.getStatus())
                .journalEntryId(e.getJournalEntryId())
                .build();
    }
}
```

- [ ] **Step 3b: Write the controller**

```java
package com.afrotransact.accounting.controller;

import com.afrotransact.accounting.dto.OpExDto;
import com.afrotransact.accounting.dto.RecordOpExRequest;
import com.afrotransact.accounting.dto.VoidOpExRequest;
import com.afrotransact.accounting.service.OperatingExpenseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/ledger/opex")
@RequiredArgsConstructor
@Tag(name = "Admin: operating expenses")
public class AdminOpExController {

    private final OperatingExpenseService service;

    @PostMapping
    @Operation(summary = "Record a manual operating expense (books DR operating:<category> / CR bank.operating)")
    public ResponseEntity<OpExDto> record(@RequestHeader("X-User-Id") UUID adminId,
                                          @Valid @RequestBody RecordOpExRequest req) {
        OperatingExpenseService.RecordCommand cmd = OperatingExpenseService.RecordCommand.builder()
                .expenseDate(req.getExpenseDate())
                .category(req.getCategory())
                .amountCents(req.getAmountCents())
                .currency(req.getCurrency())
                .description(req.getDescription())
                .source("manual")          // this endpoint always records manual entries
                .externalRef(null)
                .recurring(req.isRecurring())
                .createdBy(adminId)
                .build();
        return ResponseEntity.ok(OpExDto.from(service.record(cmd)));
    }

    @GetMapping
    @Operation(summary = "List operating expenses in a date range (optionally filtered by category)")
    public ResponseEntity<List<OpExDto>> list(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok(service.list(from, to, category).stream().map(OpExDto::from).toList());
    }

    @PostMapping("/{id}/void")
    @Operation(summary = "Void an operating expense (posts the reversing entry; mandatory reason)")
    public ResponseEntity<OpExDto> voidExpense(@RequestHeader("X-User-Id") UUID adminId,
                                               @PathVariable UUID id,
                                               @Valid @RequestBody VoidOpExRequest req) {
        return ResponseEntity.ok(OpExDto.from(service.voidExpense(id, adminId, req.getReason())));
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./mvnw -o test -Dtest=AdminOpExControllerTest`
Expected: PASS

- [ ] **Step 5: Full suite + commit**

Run: `./mvnw -o test` (whole accounting module — confirm no regression), then:

```bash
git add services/accounting/src/main/java/com/afrotransact/accounting/dto/RecordOpExRequest.java \
        services/accounting/src/main/java/com/afrotransact/accounting/dto/OpExDto.java \
        services/accounting/src/main/java/com/afrotransact/accounting/dto/VoidOpExRequest.java \
        services/accounting/src/main/java/com/afrotransact/accounting/controller/AdminOpExController.java \
        services/accounting/src/test/java/com/afrotransact/accounting/controller/AdminOpExControllerTest.java
git commit -m "feat(accounting): admin operating-expense endpoints (Phase C)"
```

---

## Phase C exit criteria

- `operating:infrastructure|tools|other` expense accounts exist (V6); `bank.operating` (V2) is the cash side.
- An admin can record, list, and void an operating expense; each active OpEx has a balanced `DR operating:<category> / CR bank.operating` entry, reversed on void.
- Recording is idempotent on `(source, external_ref)` — the seam Phase C2's GCP importer plugs into.
- Accounting module suite green; deploy **`svc_accounting`** only.

## Self-review notes (author)

- **Spec coverage:** items 1 (OpEx accounts) + 2 (manual entry: record/list/void) are covered by Tasks 1–4. Item 3 (GCP BigQuery auto-import) is deliberately deferred to Phase C2 — the `source`/`external_ref` columns and `(source, external_ref)` idempotency are built here so C2 is a thin reader over `record(...)`. Item 4 (Stripe fees) needs no work — Phase B already books them.
- **Type consistency:** `RecordCommand` getters (`getSource`, `getExternalRef`, `getAmountCents`, `isRecurring`, …) match their uses in the service and controller. `JournalService.LineSpec`/`PostRequest`/`PostResult` accessor names must be confirmed against source at Task 3 Step 3 (they are Lombok `@Getter @Builder`; `PostResult.builder().entryId().replayed()` is used by the Task 3 test mock — verify it matches the real `PostResult` builder, adjusting the mock if the real API exposes a static `posted(...)` factory instead).
- **Double-entry:** record = DR expense / CR bank.operating; void = DR bank.operating / CR expense — both balance; DB `assert_entry_balanced` enforces it.
- **Placeholder scan:** none — every step carries real SQL/Java/test code.
