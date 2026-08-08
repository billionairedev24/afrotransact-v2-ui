# Preorder Campaigns — Phase 1: Campaign Model & API (product-catalog) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first-class `PreorderCampaign` + `PreorderCampaignItem` model and admin/public API to the product-catalog service, including the "one campaign open at a time" invariant.

**Architecture:** New JPA entities + Flyway migration in the product-catalog Spring Boot service. A `PreorderCampaignService` owns campaign CRUD, item management, and lifecycle transitions. A `PreorderCampaignController` exposes admin CRUD/open-close plus one public read (the current open campaign) for the storefront `/preorder` page. Follows the service's existing string-status + Lombok + constructor-injection conventions.

**Tech Stack:** Java 21, Spring Boot, JPA/Hibernate, Flyway, Lombok; tests in JUnit 5 + Mockito + AssertJ (unit tests with mocked repositories, mirroring `payment/service/PaymentServiceCheckoutSessionTest.java`).

## Global Constraints

- Build/test with the Graal JDK 21: `export JAVA_HOME=/Library/Java/JavaVirtualMachines/graalvm-jdk-21/Contents/Home` before Maven, run Maven offline via `./mvnw -o` from `services/product-catalog`.
- Money is stored as integer **cents** (`*_cents` columns / `*Cents` fields), matching `Order`/`Offer`.
- Statuses and enums are **lowercase strings** validated against a `Set<String>` constant (repo convention — see `CatalogItemService.VALID_PRODUCT_TYPE`), NOT Java enums.
- New Flyway migration is **`V29__preorder_campaigns.sql`** (next free number; do not renumber existing migrations).
- Entities use Lombok (`@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder`) like existing models.
- No fully-qualified class names inline — always import and use the short name.
- Package root: `com.afrotransact.catalog`.

---

### Task 1: Schema + entities + repositories (foundation)

**Files:**
- Create: `services/product-catalog/src/main/resources/db/migration/V29__preorder_campaigns.sql`
- Create: `services/product-catalog/src/main/java/com/afrotransact/catalog/model/PreorderCampaign.java`
- Create: `services/product-catalog/src/main/java/com/afrotransact/catalog/model/PreorderCampaignItem.java`
- Create: `services/product-catalog/src/main/java/com/afrotransact/catalog/repository/PreorderCampaignRepository.java`
- Create: `services/product-catalog/src/main/java/com/afrotransact/catalog/repository/PreorderCampaignItemRepository.java`

**Interfaces:**
- Consumes: nothing (foundation).
- Produces:
  - `PreorderCampaign` fields: `UUID id`, `String name`, `String slug`, `String status`, `Instant orderByAt`, `LocalDate distributionDate`, `long flatDeliveryFeeCents`, `String taxMode`, `Integer taxRateBps`, `String notes`, `Instant createdAt`, `Instant updatedAt`.
  - `PreorderCampaignItem` fields: `UUID id`, `UUID campaignId`, `UUID productId`, `UUID variantId`, `long priceCents`, `boolean available`, `int displayOrder`.
  - `PreorderCampaignRepository extends JpaRepository<PreorderCampaign, UUID>` with `Optional<PreorderCampaign> findFirstByStatus(String status)` and `boolean existsByStatus(String status)`.
  - `PreorderCampaignItemRepository extends JpaRepository<PreorderCampaignItem, UUID>` with `List<PreorderCampaignItem> findByCampaignIdOrderByDisplayOrderAsc(UUID campaignId)`.

- [ ] **Step 1: Write the migration**

Create `V29__preorder_campaigns.sql`:

```sql
CREATE TABLE preorder_campaigns (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                     TEXT        NOT NULL,
    slug                     TEXT        NOT NULL UNIQUE,
    status                   TEXT        NOT NULL DEFAULT 'draft',
    order_by_at              TIMESTAMPTZ,
    distribution_date        DATE,
    flat_delivery_fee_cents  BIGINT      NOT NULL DEFAULT 0,
    tax_mode                 TEXT        NOT NULL DEFAULT 'inherit',
    tax_rate_bps             INTEGER,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce "at most one open campaign at a time" at the DB level.
CREATE UNIQUE INDEX ux_preorder_campaign_single_open
    ON preorder_campaigns (status)
    WHERE status = 'open';

CREATE TABLE preorder_campaign_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id    UUID   NOT NULL REFERENCES preorder_campaigns(id) ON DELETE CASCADE,
    product_id     UUID   NOT NULL,
    variant_id     UUID   NOT NULL,
    price_cents    BIGINT NOT NULL,
    available      BOOLEAN NOT NULL DEFAULT true,
    display_order  INTEGER NOT NULL DEFAULT 0,
    UNIQUE (campaign_id, variant_id)
);

CREATE INDEX ix_preorder_items_campaign ON preorder_campaign_items (campaign_id);
```

- [ ] **Step 2: Write the entities**

`PreorderCampaign.java` (mirror `model/Offer.java` conventions):

```java
package com.afrotransact.catalog.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "preorder_campaigns")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PreorderCampaign {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false) private String name;
    @Column(nullable = false, unique = true) private String slug;
    @Column(nullable = false) private String status;           // draft|open|closed|fulfilled|archived
    @Column(name = "order_by_at") private Instant orderByAt;
    @Column(name = "distribution_date") private LocalDate distributionDate;
    @Column(name = "flat_delivery_fee_cents", nullable = false) private long flatDeliveryFeeCents;
    @Column(name = "tax_mode", nullable = false) private String taxMode;   // exempt|flat_rate|inherit
    @Column(name = "tax_rate_bps") private Integer taxRateBps;
    private String notes;

    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    @PrePersist void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
        updatedAt = createdAt;
    }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
```

`PreorderCampaignItem.java`:

```java
package com.afrotransact.catalog.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "preorder_campaign_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PreorderCampaignItem {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "campaign_id", nullable = false) private UUID campaignId;
    @Column(name = "product_id", nullable = false) private UUID productId;
    @Column(name = "variant_id", nullable = false) private UUID variantId;
    @Column(name = "price_cents", nullable = false) private long priceCents;
    @Column(nullable = false) private boolean available;
    @Column(name = "display_order", nullable = false) private int displayOrder;
}
```

- [ ] **Step 3: Write the repositories**

```java
package com.afrotransact.catalog.repository;

import com.afrotransact.catalog.model.PreorderCampaign;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PreorderCampaignRepository extends JpaRepository<PreorderCampaign, UUID> {
    Optional<PreorderCampaign> findFirstByStatus(String status);
    boolean existsByStatus(String status);
}
```

```java
package com.afrotransact.catalog.repository;

import com.afrotransact.catalog.model.PreorderCampaignItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PreorderCampaignItemRepository extends JpaRepository<PreorderCampaignItem, UUID> {
    List<PreorderCampaignItem> findByCampaignIdOrderByDisplayOrderAsc(UUID campaignId);
}
```

- [ ] **Step 4: Compile to verify the foundation**

Run: `export JAVA_HOME=/Library/Java/JavaVirtualMachines/graalvm-jdk-21/Contents/Home && cd services/product-catalog && ./mvnw -o compile`
Expected: `BUILD SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add services/product-catalog/src/main/resources/db/migration/V29__preorder_campaigns.sql \
        services/product-catalog/src/main/java/com/afrotransact/catalog/model/PreorderCampaign.java \
        services/product-catalog/src/main/java/com/afrotransact/catalog/model/PreorderCampaignItem.java \
        services/product-catalog/src/main/java/com/afrotransact/catalog/repository/PreorderCampaignRepository.java \
        services/product-catalog/src/main/java/com/afrotransact/catalog/repository/PreorderCampaignItemRepository.java
git commit -m "feat(catalog): preorder campaign schema, entities, repositories"
```

---

### Task 2: PreorderCampaignService — create + validation

**Files:**
- Create: `services/product-catalog/src/main/java/com/afrotransact/catalog/service/PreorderCampaignService.java`
- Create: `services/product-catalog/src/main/java/com/afrotransact/catalog/service/PreorderCampaignStatus.java`
- Create: `services/product-catalog/src/test/java/com/afrotransact/catalog/service/PreorderCampaignServiceTest.java`

**Interfaces:**
- Consumes: `PreorderCampaignRepository`, `PreorderCampaignItemRepository` (Task 1).
- Produces:
  - `PreorderCampaignStatus` constants: `DRAFT="draft"`, `OPEN="open"`, `CLOSED="closed"`, `FULFILLED="fulfilled"`, `ARCHIVED="archived"`, and `Set<String> TAX_MODES = Set.of("exempt","flat_rate","inherit")`.
  - `PreorderCampaign createCampaign(String name, String slug, Instant orderByAt, LocalDate distributionDate, long flatDeliveryFeeCents, String taxMode, Integer taxRateBps, String notes)` — creates a `draft` campaign; throws `IllegalArgumentException` on invalid input.

- [ ] **Step 1: Write the failing test**

```java
package com.afrotransact.catalog.service;

import com.afrotransact.catalog.model.PreorderCampaign;
import com.afrotransact.catalog.model.PreorderCampaignItem;
import com.afrotransact.catalog.repository.PreorderCampaignItemRepository;
import com.afrotransact.catalog.repository.PreorderCampaignRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

// NOTE: Tasks 3, 4, and 6 append test methods to THIS file. The imports above
// (List, Optional, PreorderCampaignItem) are added now so those later snippets
// use short names — never inline fully-qualified names.
class PreorderCampaignServiceTest {

    private PreorderCampaignRepository campaigns;
    private PreorderCampaignItemRepository items;
    private PreorderCampaignService service;

    @BeforeEach
    void setUp() {
        campaigns = mock(PreorderCampaignRepository.class);
        items = mock(PreorderCampaignItemRepository.class);
        when(campaigns.save(any(PreorderCampaign.class))).thenAnswer(inv -> {
            PreorderCampaign c = inv.getArgument(0);
            if (c.getId() == null) c.setId(UUID.randomUUID());
            return c;
        });
        service = new PreorderCampaignService(campaigns, items);
    }

    @Test
    void createCampaign_persistsDraftWithGivenFields() {
        Instant orderBy = Instant.parse("2026-08-11T18:00:00Z");
        PreorderCampaign c = service.createCampaign(
                "Fresh Produce", "fresh-produce", orderBy, LocalDate.parse("2026-08-13"),
                500L, "inherit", null, null);

        assertThat(c.getStatus()).isEqualTo(PreorderCampaignStatus.DRAFT);
        assertThat(c.getName()).isEqualTo("Fresh Produce");
        assertThat(c.getFlatDeliveryFeeCents()).isEqualTo(500L);
        verify(campaigns).save(any(PreorderCampaign.class));
    }

    @Test
    void createCampaign_flatRateTaxWithoutRate_throws() {
        assertThatThrownBy(() -> service.createCampaign(
                "X", "x", Instant.parse("2026-08-11T18:00:00Z"), LocalDate.parse("2026-08-13"),
                0L, "flat_rate", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("taxRateBps");
    }

    @Test
    void createCampaign_unknownTaxMode_throws() {
        assertThatThrownBy(() -> service.createCampaign(
                "X", "x", Instant.parse("2026-08-11T18:00:00Z"), LocalDate.parse("2026-08-13"),
                0L, "bogus", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("taxMode");
    }

    @Test
    void createCampaign_distributionBeforeOrderBy_throws() {
        assertThatThrownBy(() -> service.createCampaign(
                "X", "x", Instant.parse("2026-08-13T18:00:00Z"), LocalDate.parse("2026-08-11"),
                0L, "inherit", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("distributionDate");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export JAVA_HOME=/Library/Java/JavaVirtualMachines/graalvm-jdk-21/Contents/Home && cd services/product-catalog && ./mvnw -o test -Dtest=PreorderCampaignServiceTest`
Expected: FAIL — `PreorderCampaignService`/`PreorderCampaignStatus` do not exist (compilation error).

- [ ] **Step 3: Write the status constants + minimal service**

`PreorderCampaignStatus.java`:

```java
package com.afrotransact.catalog.service;

import java.util.Set;

public final class PreorderCampaignStatus {
    private PreorderCampaignStatus() {}
    public static final String DRAFT = "draft";
    public static final String OPEN = "open";
    public static final String CLOSED = "closed";
    public static final String FULFILLED = "fulfilled";
    public static final String ARCHIVED = "archived";
    public static final Set<String> TAX_MODES = Set.of("exempt", "flat_rate", "inherit");
}
```

`PreorderCampaignService.java`:

```java
package com.afrotransact.catalog.service;

import com.afrotransact.catalog.model.PreorderCampaign;
import com.afrotransact.catalog.repository.PreorderCampaignItemRepository;
import com.afrotransact.catalog.repository.PreorderCampaignRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class PreorderCampaignService {

    private final PreorderCampaignRepository campaigns;
    private final PreorderCampaignItemRepository items;

    public PreorderCampaign createCampaign(String name, String slug, Instant orderByAt,
                                           LocalDate distributionDate, long flatDeliveryFeeCents,
                                           String taxMode, Integer taxRateBps, String notes) {
        if (name == null || name.isBlank()) throw new IllegalArgumentException("name is required");
        if (slug == null || slug.isBlank()) throw new IllegalArgumentException("slug is required");
        if (!PreorderCampaignStatus.TAX_MODES.contains(taxMode))
            throw new IllegalArgumentException("invalid taxMode: " + taxMode);
        if ("flat_rate".equals(taxMode) && taxRateBps == null)
            throw new IllegalArgumentException("taxRateBps is required when taxMode=flat_rate");
        if (orderByAt != null && distributionDate != null
                && distributionDate.isBefore(orderByAt.atZone(ZoneOffset.UTC).toLocalDate()))
            throw new IllegalArgumentException("distributionDate must not be before orderByAt");

        PreorderCampaign c = PreorderCampaign.builder()
                .name(name).slug(slug).status(PreorderCampaignStatus.DRAFT)
                .orderByAt(orderByAt).distributionDate(distributionDate)
                .flatDeliveryFeeCents(flatDeliveryFeeCents)
                .taxMode(taxMode).taxRateBps(taxRateBps).notes(notes)
                .build();
        return campaigns.save(c);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./mvnw -o test -Dtest=PreorderCampaignServiceTest`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add services/product-catalog/src/main/java/com/afrotransact/catalog/service/PreorderCampaignService.java \
        services/product-catalog/src/main/java/com/afrotransact/catalog/service/PreorderCampaignStatus.java \
        services/product-catalog/src/test/java/com/afrotransact/catalog/service/PreorderCampaignServiceTest.java
git commit -m "feat(catalog): create preorder campaign with validation"
```

---

### Task 3: Campaign items — add / update / list

**Files:**
- Modify: `services/product-catalog/src/main/java/com/afrotransact/catalog/service/PreorderCampaignService.java`
- Modify: `services/product-catalog/src/test/java/com/afrotransact/catalog/service/PreorderCampaignServiceTest.java`

**Interfaces:**
- Consumes: Task 2 service + repositories.
- Produces:
  - `PreorderCampaignItem addItem(UUID campaignId, UUID productId, UUID variantId, long priceCents, int displayOrder)` — throws `IllegalArgumentException` if the campaign is not `draft`, or `priceCents <= 0`.
  - `List<PreorderCampaignItem> listItems(UUID campaignId)`.

- [ ] **Step 1: Write the failing test (append to `PreorderCampaignServiceTest`)**

```java
    @Test
    void addItem_onDraftCampaign_persists() {
        UUID campaignId = UUID.randomUUID();
        PreorderCampaign draft = PreorderCampaign.builder()
                .id(campaignId).status(PreorderCampaignStatus.DRAFT).build();
        when(campaigns.findById(campaignId)).thenReturn(Optional.of(draft));
        when(items.save(any(PreorderCampaignItem.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        var item = service.addItem(campaignId, UUID.randomUUID(), UUID.randomUUID(), 4500L, 0);

        assertThat(item.getPriceCents()).isEqualTo(4500L);
        assertThat(item.isAvailable()).isTrue();
    }

    @Test
    void addItem_onOpenCampaign_throws() {
        UUID campaignId = UUID.randomUUID();
        PreorderCampaign open = PreorderCampaign.builder()
                .id(campaignId).status(PreorderCampaignStatus.OPEN).build();
        when(campaigns.findById(campaignId)).thenReturn(Optional.of(open));

        assertThatThrownBy(() -> service.addItem(campaignId, UUID.randomUUID(), UUID.randomUUID(), 100L, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("draft");
    }

    @Test
    void addItem_nonPositivePrice_throws() {
        UUID campaignId = UUID.randomUUID();
        PreorderCampaign draft = PreorderCampaign.builder()
                .id(campaignId).status(PreorderCampaignStatus.DRAFT).build();
        when(campaigns.findById(campaignId)).thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> service.addItem(campaignId, UUID.randomUUID(), UUID.randomUUID(), 0L, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("priceCents");
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./mvnw -o test -Dtest=PreorderCampaignServiceTest`
Expected: FAIL — `addItem` not defined.

- [ ] **Step 3: Implement `addItem` + `listItems`**

Add to `PreorderCampaignService` (import `PreorderCampaignItem`, `List`, `UUID`):

```java
    public PreorderCampaignItem addItem(UUID campaignId, UUID productId, UUID variantId,
                                        long priceCents, int displayOrder) {
        PreorderCampaign c = campaigns.findById(campaignId)
                .orElseThrow(() -> new IllegalArgumentException("campaign not found: " + campaignId));
        if (!PreorderCampaignStatus.DRAFT.equals(c.getStatus()))
            throw new IllegalArgumentException("items can only be edited while the campaign is draft");
        if (priceCents <= 0) throw new IllegalArgumentException("priceCents must be positive");

        PreorderCampaignItem item = PreorderCampaignItem.builder()
                .campaignId(campaignId).productId(productId).variantId(variantId)
                .priceCents(priceCents).available(true).displayOrder(displayOrder)
                .build();
        return items.save(item);
    }

    public List<PreorderCampaignItem> listItems(UUID campaignId) {
        return items.findByCampaignIdOrderByDisplayOrderAsc(campaignId);
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./mvnw -o test -Dtest=PreorderCampaignServiceTest`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add services/product-catalog/src/main/java/com/afrotransact/catalog/service/PreorderCampaignService.java \
        services/product-catalog/src/test/java/com/afrotransact/catalog/service/PreorderCampaignServiceTest.java
git commit -m "feat(catalog): add/list preorder campaign items (draft-only)"
```

---

### Task 4: Lifecycle transitions + one-open-at-a-time invariant

**Files:**
- Modify: `services/product-catalog/src/main/java/com/afrotransact/catalog/service/PreorderCampaignService.java`
- Modify: `services/product-catalog/src/test/java/com/afrotransact/catalog/service/PreorderCampaignServiceTest.java`

**Interfaces:**
- Consumes: Task 2/3 service.
- Produces:
  - `PreorderCampaign openCampaign(UUID id)` — draft→open; throws if another campaign is already `open`, or if the campaign has no items, or `orderByAt`/`distributionDate` is null.
  - `PreorderCampaign closeCampaign(UUID id)` — open→closed.
  - `PreorderCampaign transition(UUID id, String toStatus)` — closed→fulfilled, fulfilled→archived; rejects illegal transitions with `IllegalStateException`.

- [ ] **Step 1: Write the failing test (append)**

```java
    @Test
    void openCampaign_whenAnotherOpen_throws() {
        UUID id = UUID.randomUUID();
        PreorderCampaign draft = PreorderCampaign.builder()
                .id(id).status(PreorderCampaignStatus.DRAFT)
                .orderByAt(Instant.parse("2026-08-11T18:00:00Z"))
                .distributionDate(LocalDate.parse("2026-08-13")).build();
        when(campaigns.findById(id)).thenReturn(Optional.of(draft));
        when(campaigns.existsByStatus(PreorderCampaignStatus.OPEN)).thenReturn(true);

        assertThatThrownBy(() -> service.openCampaign(id))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already");
    }

    @Test
    void openCampaign_noItems_throws() {
        UUID id = UUID.randomUUID();
        PreorderCampaign draft = PreorderCampaign.builder()
                .id(id).status(PreorderCampaignStatus.DRAFT)
                .orderByAt(Instant.parse("2026-08-11T18:00:00Z"))
                .distributionDate(LocalDate.parse("2026-08-13")).build();
        when(campaigns.findById(id)).thenReturn(Optional.of(draft));
        when(campaigns.existsByStatus(PreorderCampaignStatus.OPEN)).thenReturn(false);
        when(items.findByCampaignIdOrderByDisplayOrderAsc(id)).thenReturn(List.of());

        assertThatThrownBy(() -> service.openCampaign(id))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("item");
    }

    @Test
    void openCampaign_valid_setsOpen() {
        UUID id = UUID.randomUUID();
        PreorderCampaign draft = PreorderCampaign.builder()
                .id(id).status(PreorderCampaignStatus.DRAFT)
                .orderByAt(Instant.parse("2026-08-11T18:00:00Z"))
                .distributionDate(LocalDate.parse("2026-08-13")).build();
        when(campaigns.findById(id)).thenReturn(Optional.of(draft));
        when(campaigns.existsByStatus(PreorderCampaignStatus.OPEN)).thenReturn(false);
        when(items.findByCampaignIdOrderByDisplayOrderAsc(id))
                .thenReturn(List.of(new PreorderCampaignItem()));
        when(campaigns.save(any(PreorderCampaign.class))).thenAnswer(inv -> inv.getArgument(0));

        PreorderCampaign opened = service.openCampaign(id);
        assertThat(opened.getStatus()).isEqualTo(PreorderCampaignStatus.OPEN);
    }

    @Test
    void transition_illegalJump_throws() {
        UUID id = UUID.randomUUID();
        PreorderCampaign draft = PreorderCampaign.builder()
                .id(id).status(PreorderCampaignStatus.DRAFT).build();
        when(campaigns.findById(id)).thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> service.transition(id, PreorderCampaignStatus.ARCHIVED))
                .isInstanceOf(IllegalStateException.class);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./mvnw -o test -Dtest=PreorderCampaignServiceTest`
Expected: FAIL — `openCampaign`/`closeCampaign`/`transition` not defined.

- [ ] **Step 3: Implement transitions**

Add to `PreorderCampaignService` (import `java.util.Map`, `java.util.Set`):

```java
    private static final Map<String, Set<String>> ALLOWED = Map.of(
            PreorderCampaignStatus.DRAFT, Set.of(PreorderCampaignStatus.OPEN),
            PreorderCampaignStatus.OPEN, Set.of(PreorderCampaignStatus.CLOSED),
            PreorderCampaignStatus.CLOSED, Set.of(PreorderCampaignStatus.FULFILLED),
            PreorderCampaignStatus.FULFILLED, Set.of(PreorderCampaignStatus.ARCHIVED));

    public PreorderCampaign openCampaign(UUID id) {
        PreorderCampaign c = campaigns.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("campaign not found: " + id));
        requireTransition(c.getStatus(), PreorderCampaignStatus.OPEN);
        if (campaigns.existsByStatus(PreorderCampaignStatus.OPEN))
            throw new IllegalStateException("another campaign is already open");
        if (c.getOrderByAt() == null || c.getDistributionDate() == null)
            throw new IllegalStateException("orderByAt and distributionDate are required to open");
        if (items.findByCampaignIdOrderByDisplayOrderAsc(id).isEmpty())
            throw new IllegalStateException("campaign needs at least one item to open");
        c.setStatus(PreorderCampaignStatus.OPEN);
        return campaigns.save(c);
    }

    public PreorderCampaign closeCampaign(UUID id) {
        return transition(id, PreorderCampaignStatus.CLOSED);
    }

    public PreorderCampaign transition(UUID id, String toStatus) {
        PreorderCampaign c = campaigns.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("campaign not found: " + id));
        requireTransition(c.getStatus(), toStatus);
        c.setStatus(toStatus);
        return campaigns.save(c);
    }

    private void requireTransition(String from, String to) {
        if (!ALLOWED.getOrDefault(from, Set.of()).contains(to))
            throw new IllegalStateException("illegal transition " + from + " -> " + to);
    }
```

> Note: `openCampaign` calls `requireTransition` first so `transition(id, "open")` semantics stay consistent, then applies the open-specific guards.

- [ ] **Step 4: Run test to verify it passes**

Run: `./mvnw -o test -Dtest=PreorderCampaignServiceTest`
Expected: PASS (11 tests). The DB partial unique index (`ux_preorder_campaign_single_open`) is the backstop if two opens race; the service check covers the common path.

- [ ] **Step 5: Commit**

```bash
git add services/product-catalog/src/main/java/com/afrotransact/catalog/service/PreorderCampaignService.java \
        services/product-catalog/src/test/java/com/afrotransact/catalog/service/PreorderCampaignServiceTest.java
git commit -m "feat(catalog): preorder campaign lifecycle transitions + one-open invariant"
```

---

### Task 5: DTOs + admin controller (CRUD, items, open/close)

**Files:**
- Create: `services/product-catalog/src/main/java/com/afrotransact/catalog/dto/PreorderCampaignRequest.java`
- Create: `services/product-catalog/src/main/java/com/afrotransact/catalog/dto/PreorderCampaignItemRequest.java`
- Create: `services/product-catalog/src/main/java/com/afrotransact/catalog/dto/PreorderCampaignResponse.java`
- Create: `services/product-catalog/src/main/java/com/afrotransact/catalog/controller/PreorderCampaignController.java`
- Create: `services/product-catalog/src/test/java/com/afrotransact/catalog/controller/PreorderCampaignControllerTest.java`

**Interfaces:**
- Consumes: `PreorderCampaignService` (Tasks 2–4).
- Produces:
  - `PreorderCampaignRequest` record: `(String name, String slug, Instant orderByAt, LocalDate distributionDate, long flatDeliveryFeeCents, String taxMode, Integer taxRateBps, String notes)`.
  - `PreorderCampaignItemRequest` record: `(UUID productId, UUID variantId, long priceCents, int displayOrder)`.
  - `PreorderCampaignResponse record: (UUID id, String name, String slug, String status, Instant orderByAt, LocalDate distributionDate, long flatDeliveryFeeCents, String taxMode, Integer taxRateBps)` + `static PreorderCampaignResponse from(PreorderCampaign)`.
  - REST base path `/api/v1/admin/preorder-campaigns`: `POST` create, `POST /{id}/items` add item, `POST /{id}/open`, `POST /{id}/close`.

- [ ] **Step 1: Write the failing controller test**

```java
package com.afrotransact.catalog.controller;

import com.afrotransact.catalog.dto.PreorderCampaignRequest;
import com.afrotransact.catalog.model.PreorderCampaign;
import com.afrotransact.catalog.service.PreorderCampaignService;
import com.afrotransact.catalog.service.PreorderCampaignStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PreorderCampaignControllerTest {

    private PreorderCampaignService service;
    private PreorderCampaignController controller;

    @BeforeEach
    void setUp() {
        service = mock(PreorderCampaignService.class);
        controller = new PreorderCampaignController(service);
    }

    @Test
    void create_returnsResponseFromService() {
        UUID id = UUID.randomUUID();
        when(service.createCampaign(any(), any(), any(), any(), anyLong(), any(), any(), any()))
                .thenReturn(PreorderCampaign.builder()
                        .id(id).name("Fresh").slug("fresh").status(PreorderCampaignStatus.DRAFT)
                        .flatDeliveryFeeCents(500L).taxMode("inherit").build());

        var req = new PreorderCampaignRequest("Fresh", "fresh",
                Instant.parse("2026-08-11T18:00:00Z"), LocalDate.parse("2026-08-13"),
                500L, "inherit", null, null);
        var res = controller.create(req);

        assertThat(res.getBody().id()).isEqualTo(id);
        assertThat(res.getBody().status()).isEqualTo(PreorderCampaignStatus.DRAFT);
    }

    @Test
    void open_delegatesToService() {
        UUID id = UUID.randomUUID();
        when(service.openCampaign(id)).thenReturn(PreorderCampaign.builder()
                .id(id).status(PreorderCampaignStatus.OPEN).taxMode("inherit").build());

        var res = controller.open(id);
        assertThat(res.getBody().status()).isEqualTo(PreorderCampaignStatus.OPEN);
        verify(service).openCampaign(id);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./mvnw -o test -Dtest=PreorderCampaignControllerTest`
Expected: FAIL — DTOs / controller do not exist.

- [ ] **Step 3: Implement DTOs + controller**

`PreorderCampaignRequest.java`:

```java
package com.afrotransact.catalog.dto;

import java.time.Instant;
import java.time.LocalDate;

public record PreorderCampaignRequest(
        String name, String slug, Instant orderByAt, LocalDate distributionDate,
        long flatDeliveryFeeCents, String taxMode, Integer taxRateBps, String notes) {}
```

`PreorderCampaignItemRequest.java`:

```java
package com.afrotransact.catalog.dto;

import java.util.UUID;

public record PreorderCampaignItemRequest(
        UUID productId, UUID variantId, long priceCents, int displayOrder) {}
```

`PreorderCampaignResponse.java`:

```java
package com.afrotransact.catalog.dto;

import com.afrotransact.catalog.model.PreorderCampaign;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record PreorderCampaignResponse(
        UUID id, String name, String slug, String status, Instant orderByAt,
        LocalDate distributionDate, long flatDeliveryFeeCents, String taxMode, Integer taxRateBps) {

    public static PreorderCampaignResponse from(PreorderCampaign c) {
        return new PreorderCampaignResponse(c.getId(), c.getName(), c.getSlug(), c.getStatus(),
                c.getOrderByAt(), c.getDistributionDate(), c.getFlatDeliveryFeeCents(),
                c.getTaxMode(), c.getTaxRateBps());
    }
}
```

`PreorderCampaignController.java`:

```java
package com.afrotransact.catalog.controller;

import com.afrotransact.catalog.dto.PreorderCampaignItemRequest;
import com.afrotransact.catalog.dto.PreorderCampaignRequest;
import com.afrotransact.catalog.dto.PreorderCampaignResponse;
import com.afrotransact.catalog.service.PreorderCampaignService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/preorder-campaigns")
@RequiredArgsConstructor
public class PreorderCampaignController {

    private final PreorderCampaignService service;

    @PostMapping
    public ResponseEntity<PreorderCampaignResponse> create(@RequestBody PreorderCampaignRequest req) {
        var c = service.createCampaign(req.name(), req.slug(), req.orderByAt(), req.distributionDate(),
                req.flatDeliveryFeeCents(), req.taxMode(), req.taxRateBps(), req.notes());
        return ResponseEntity.status(HttpStatus.CREATED).body(PreorderCampaignResponse.from(c));
    }

    @PostMapping("/{id}/items")
    public ResponseEntity<Void> addItem(@PathVariable UUID id, @RequestBody PreorderCampaignItemRequest req) {
        service.addItem(id, req.productId(), req.variantId(), req.priceCents(), req.displayOrder());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @PostMapping("/{id}/open")
    public ResponseEntity<PreorderCampaignResponse> open(@PathVariable UUID id) {
        return ResponseEntity.ok(PreorderCampaignResponse.from(service.openCampaign(id)));
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<PreorderCampaignResponse> close(@PathVariable UUID id) {
        return ResponseEntity.ok(PreorderCampaignResponse.from(service.closeCampaign(id)));
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./mvnw -o test -Dtest=PreorderCampaignControllerTest`
Expected: PASS (2 tests). Validation errors from the service surface as 400 via the existing `GlobalExceptionHandler` (`IllegalArgumentException`→400); illegal transitions (`IllegalStateException`) currently fall to the catch-all — a follow-up can map them to 409, out of scope here.

- [ ] **Step 5: Commit**

```bash
git add services/product-catalog/src/main/java/com/afrotransact/catalog/dto/PreorderCampaign*.java \
        services/product-catalog/src/main/java/com/afrotransact/catalog/controller/PreorderCampaignController.java \
        services/product-catalog/src/test/java/com/afrotransact/catalog/controller/PreorderCampaignControllerTest.java
git commit -m "feat(catalog): admin preorder campaign endpoints (create/items/open/close)"
```

---

### Task 6: Public "current open campaign" read endpoint

**Files:**
- Modify: `services/product-catalog/src/main/java/com/afrotransact/catalog/service/PreorderCampaignService.java`
- Create: `services/product-catalog/src/main/java/com/afrotransact/catalog/dto/PreorderCampaignItemResponse.java`
- Create: `services/product-catalog/src/main/java/com/afrotransact/catalog/dto/OpenPreorderCampaignResponse.java`
- Create: `services/product-catalog/src/main/java/com/afrotransact/catalog/controller/PublicPreorderController.java`
- Create: `services/product-catalog/src/test/java/com/afrotransact/catalog/controller/PublicPreorderControllerTest.java`
- Modify: `services/product-catalog/src/test/java/com/afrotransact/catalog/service/PreorderCampaignServiceTest.java`

**Interfaces:**
- Consumes: `PreorderCampaignService`.
- Produces:
  - `Optional<PreorderCampaign> findOpenCampaign()` on the service (delegates to `campaigns.findFirstByStatus("open")`).
  - `PreorderCampaignItemResponse record: (UUID productId, UUID variantId, long priceCents, boolean available, int displayOrder)`.
  - `OpenPreorderCampaignResponse record: (PreorderCampaignResponse campaign, List<PreorderCampaignItemResponse> items)`.
  - `GET /api/v1/preorder/current` → `200` with the open campaign + items, or `204 No Content` when none is open.

- [ ] **Step 1: Write the failing tests**

Append to `PreorderCampaignServiceTest`:

```java
    @Test
    void findOpenCampaign_returnsRepoResult() {
        PreorderCampaign open = PreorderCampaign.builder().status(PreorderCampaignStatus.OPEN).build();
        when(campaigns.findFirstByStatus(PreorderCampaignStatus.OPEN))
                .thenReturn(Optional.of(open));
        assertThat(service.findOpenCampaign()).containsSame(open);
    }
```

Create `PublicPreorderControllerTest.java`:

```java
package com.afrotransact.catalog.controller;

import com.afrotransact.catalog.model.PreorderCampaign;
import com.afrotransact.catalog.service.PreorderCampaignService;
import com.afrotransact.catalog.service.PreorderCampaignStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class PublicPreorderControllerTest {

    private PreorderCampaignService service;
    private PublicPreorderController controller;

    @BeforeEach
    void setUp() {
        service = mock(PreorderCampaignService.class);
        controller = new PublicPreorderController(service);
    }

    @Test
    void current_noOpenCampaign_returns204() {
        when(service.findOpenCampaign()).thenReturn(Optional.empty());
        assertThat(controller.current().getStatusCode().value()).isEqualTo(204);
    }

    @Test
    void current_openCampaign_returns200WithItems() {
        UUID id = UUID.randomUUID();
        when(service.findOpenCampaign()).thenReturn(Optional.of(PreorderCampaign.builder()
                .id(id).name("Fresh").slug("fresh").status(PreorderCampaignStatus.OPEN)
                .taxMode("inherit").build()));
        when(service.listItems(id)).thenReturn(List.of());

        var res = controller.current();
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody().campaign().id()).isEqualTo(id);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./mvnw -o test -Dtest=PublicPreorderControllerTest,PreorderCampaignServiceTest`
Expected: FAIL — `findOpenCampaign`, DTOs, and controller do not exist.

- [ ] **Step 3: Implement service method, DTOs, controller**

Add to `PreorderCampaignService` (import `java.util.Optional`):

```java
    public Optional<PreorderCampaign> findOpenCampaign() {
        return campaigns.findFirstByStatus(PreorderCampaignStatus.OPEN);
    }
```

`PreorderCampaignItemResponse.java`:

```java
package com.afrotransact.catalog.dto;

import com.afrotransact.catalog.model.PreorderCampaignItem;

import java.util.UUID;

public record PreorderCampaignItemResponse(
        UUID productId, UUID variantId, long priceCents, boolean available, int displayOrder) {

    public static PreorderCampaignItemResponse from(PreorderCampaignItem i) {
        return new PreorderCampaignItemResponse(i.getProductId(), i.getVariantId(),
                i.getPriceCents(), i.isAvailable(), i.getDisplayOrder());
    }
}
```

`OpenPreorderCampaignResponse.java`:

```java
package com.afrotransact.catalog.dto;

import java.util.List;

public record OpenPreorderCampaignResponse(
        PreorderCampaignResponse campaign, List<PreorderCampaignItemResponse> items) {}
```

`PublicPreorderController.java`:

```java
package com.afrotransact.catalog.controller;

import com.afrotransact.catalog.dto.OpenPreorderCampaignResponse;
import com.afrotransact.catalog.dto.PreorderCampaignItemResponse;
import com.afrotransact.catalog.dto.PreorderCampaignResponse;
import com.afrotransact.catalog.service.PreorderCampaignService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/preorder")
@RequiredArgsConstructor
public class PublicPreorderController {

    private final PreorderCampaignService service;

    @GetMapping("/current")
    public ResponseEntity<OpenPreorderCampaignResponse> current() {
        return service.findOpenCampaign()
                .map(c -> ResponseEntity.ok(new OpenPreorderCampaignResponse(
                        PreorderCampaignResponse.from(c),
                        service.listItems(c.getId()).stream()
                                .map(PreorderCampaignItemResponse::from).toList())))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./mvnw -o test -Dtest=PublicPreorderControllerTest,PreorderCampaignServiceTest`
Expected: PASS.

- [ ] **Step 5: Run the whole module test suite + build**

Run: `./mvnw -o test && ./mvnw -o package -DskipTests`
Expected: BUILD SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add services/product-catalog/src/main/java/com/afrotransact/catalog/service/PreorderCampaignService.java \
        services/product-catalog/src/main/java/com/afrotransact/catalog/dto/PreorderCampaignItemResponse.java \
        services/product-catalog/src/main/java/com/afrotransact/catalog/dto/OpenPreorderCampaignResponse.java \
        services/product-catalog/src/main/java/com/afrotransact/catalog/controller/PublicPreorderController.java \
        services/product-catalog/src/test/java/com/afrotransact/catalog/controller/PublicPreorderControllerTest.java \
        services/product-catalog/src/test/java/com/afrotransact/catalog/service/PreorderCampaignServiceTest.java
git commit -m "feat(catalog): public current-open-preorder-campaign endpoint"
```

---

## Phase 1 exit criteria

- `POST /api/v1/admin/preorder-campaigns` creates a draft; items added while draft; `POST /{id}/open` enforces one-open + items + dates; `POST /{id}/close` closes.
- `GET /api/v1/preorder/current` returns the open campaign + items (or 204).
- All new unit tests green; module packages clean.
- Gateway routing for the new `/api/v1/admin/preorder-campaigns` and `/api/v1/preorder/*` paths is handled in Phase 2 (order/checkout) alongside the preorder checkout wiring, since both need gateway/route + auth updates together.

---

## Roadmap — subsequent phases (each its own plan)

- **Phase 2 — Order & checkout (order service):** tag `CheckoutSession` with `preorderCampaignId`; override delivery (flat fee once) + tax in `shippingQuotesForCart`; materialize preorder orders (`isPreorder`, `distributionDate`, house sub-order, `preorder_confirmed` status) on `payment.completed`; gateway routes for preorder endpoints.
- **Phase 3 — Demand & refunds (order service):** `GET /api/v1/admin/preorders/campaigns/{id}/demand` (shopping list + distribution list); fulfillment transitions; full + partial refunds (fee retained on partial, refunded on full cancel).
- **Phase 4 — Storefront customer:** `/preorder` page, dedicated open-campaign banner + nav entry, separate preorder cart, checkout integration, order-history preorder badge.
- **Phase 5 — Storefront admin:** `admin/preorders` campaign management + demand view with CSV export + refund controls.
