# Shipping Rollout Runbook (Carrier Mode)

## Objective
Launch realtime carrier shipping safely with config-gated rollout (Texas first), while preserving existing internal-fulfillment behavior when carrier mode is off.

## Modes
- `internal` mode (carrier disabled): current behavior, no new seller/product shipping requirements.
- `carrier` mode (carrier enabled): realtime quotes active, ship-from + dimensional data required.

## Required Config Keys
- `shipping_realtime_enabled` (bool)
- `shipping_provider` (`shippo` | `easypost`)
- `shipping_realtime_state_allowlist` (array)
- `shipping_realtime_city_allowlist` (array, optional)
- `shipping_realtime_fallback_static` (bool)

## Order service environment (not Next.js)
Set on the **order** deployment (Kubernetes, Docker, or local JVM), not in `afrotransact-v2-ui`:
- `SHIPPO_API_KEY` — Shippo test/live token for live rates when `shipping_provider=shippo`
- `EASYPOST_API_KEY` — EasyPost API key when `shipping_provider=easypost`
- `SHIPPING_CHECKOUT_QUOTE_TOLERANCE_CENTS` — optional; max allowed drift between UI-shown shipping cents and fresh rate at checkout (default `50`).
- `INTERNAL_SERVICE_SECRET` and seller/config service base URLs must allow `GET` shipping profiles and config as already wired for checkout

## Preflight Checklist (Must Pass Before Enable)
1. Provider credentials exist for selected environment (test/prod keys valid).
2. Seller ship-from coverage:
   - active stores with valid ship-from address >= target threshold.
3. Product shipping data coverage:
   - active products with required `weight + length + width + height` >= target threshold.
4. Seller carrier preferences:
   - no seller has zero effective carriers after platform/admin overrides.
5. Quote API health:
   - latency and error rates within target SLOs.

## Seller Migration Checklist
1. Show dashboard banner/task:
   - "Carrier shipping is being enabled. Complete ship-from and package data."
2. Require completion flow:
   - ship-from address (or same as business address toggle)
   - allowed carriers (optional if platform defaults used)
   - missing product dimensions report and edit path
3. Optional outbound notification:
   - email + in-app reminder for incomplete sellers.

## Rollout Steps
1. **UAT internal mode baseline**
   - Verify checkout and admin fulfillment still behave as today.
2. **UAT carrier mode ON, TX allowlist only**
   - `shipping_realtime_enabled=true`
   - `shipping_provider=<chosen>`
   - `shipping_realtime_state_allowlist=["TX"]`
3. **Pilot production**
   - Enable for limited seller cohort in TX.
4. **Scale in US**
   - Expand states/cities through config only after KPI checks.

## Implementation Progress Tracker (Use During Build)

### Backend (refined) — End-to-End MVP
- [x] Shipping quotes endpoint added and reachable via gateway.
- [x] Shippo adapter implemented.
- [x] EasyPost adapter implemented.
- [x] Provider switch from config works at runtime.
- [x] TX/state/city allowlist gating works.
- [x] Checkout accepts selected quote metadata.
- [x] Quote revalidation at place-order: fresh rates fetched; match by quoteId when stable; else carrier + serviceCode; amount within configurable tolerance (`SHIPPING_CHECKOUT_QUOTE_TOLERANCE_CENTS`, default 50); persisted quoteId is from the fresh response (important for Shippo rate object churn).
- [x] Shipping method metadata persisted on sub-order (`shipping_provider`, `shipping_quote_id`, `shipping_carrier`, `shipping_service`, etc.; API exposes via `OrderDto`).

### Frontend (afrotransact-v2-ui) — End-to-End MVP
- [x] API client/types for quotes added in `lib/api.ts`.
- [x] Checkout fetches quotes after valid shipping address.
- [x] Free-shipping threshold: no carrier quote fetch or selection required when cart subtotal meets region threshold (aligned with static weight-based $0 shipping).
- [x] Carrier-grouped expandable UI rendered (USPS/UPS/FedEx).
- [x] Tier labels shown (`low/medium/high`) with price + ETA.
- [x] Selected option updates totals and is submitted in checkout payload.
- [x] Fallback UX shown when realtime quotes unavailable.

### Config/Admin
- [x] Admin toggle for realtime shipping mode.
- [x] Admin provider selector (Shippo/EasyPost).
- [x] State/city allowlist editor.
- [x] Clear admin status display of active mode + provider.

### Seller/Data Guardrails
- [x] Ship-from address requirement in seller store settings when carrier shipping is on (validation + banner on store page).
- [x] Product parcel dimensions (L×W×H inches per variant unit) in catalog and cart; carrier rating uses aggregated parcel (max L/W, stacked H × qty) when every cart line has dimensions, else legacy 12×9×6 in. Seller create/edit requires dimensions when realtime shipping is enabled (`getAdminShippingSettings`).
- [x] Seller-facing banner when carrier mode is on and ship-from profile is incomplete.

## UAT Test Script (Pass/Fail)
- [ ] TX address receives realtime quotes.
- [ ] Non-allowed state/city follows configured fallback/block behavior.
- [ ] Provider switch changes returned rates source without redeploy.
- [ ] Selected service amount matches checkout/charge totals (after server revalidation).
- [ ] Stale rate / price drift: tweak tolerance or mock provider to confirm buyer sees a clear error and can refresh quotes.
- [ ] Single-store + realtime + subtotal above region free-shipping threshold: $0 shipping without carrier selection (order API aligned).
- [ ] Order record contains carrier/service/quote metadata.
- [ ] Internal mode OFF path still behaves like current system.

## Monitoring During Rollout
- Quote success rate
- Provider latency p95
- Fallback usage rate
- Checkout conversion impact
- Error rate by provider/carrier/service

## Incident Playbook
1. High provider failures:
   - switch provider in config or enable static fallback.
2. Severe checkout impact:
   - set `shipping_realtime_enabled=false` (return to internal mode behavior).
3. Seller data integrity issues:
   - temporarily restrict affected sellers until required shipping fields are complete.

## Exit Criteria Per Stage
- Stage passes when:
  - quote errors remain under threshold for agreed window,
  - checkout conversion is stable,
  - no blocking seller data issues for active cohort.
