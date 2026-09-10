# Platform export service — plan

**Status:** draft for review. Nothing here is implemented.

**Why now:** the admin orders export was answering the wrong question — it built
an "Analytics" sheet from the 50 orders on screen and presented it as the whole
business. That has been patched client-side (walk every page, cap at 10k rows,
warn on truncation), which is fine at today's volume and will not hold. This is
the durable version, and it is not just about orders.

## The actual problem

Exporting is implemented **fourteen times, in two different shapes, entirely in
the browser**:

| Surface | Where | Shape |
|---|---|---|
| admin: orders, products, users, coupons, payouts, sellers/invites, sellers/lifecycle | storefront | `DataTable enableExport` → client CSV |
| seller: orders, products, coupons, payouts | storefront | same |
| inventory: stock valuation, movements, audit | inventory-web | `lib/csv.ts downloadCSV` |

Four consequences, in order of severity:

1. **Exports are scoped to what the page happens to have loaded.** Any
   server-paginated table exports one page. The file looks complete and is not.
2. **The browser is the wrong place to assemble a large file.** Memory,
   round-trips, and a tab that must stay open.
3. **No server-side authorization on the export itself.** A seller export is
   only correctly scoped because the *list* endpoint scoped it. That is an
   accident of the read path, not an export guarantee.
4. **No audit trail.** Exports move customer PII — names, emails, addresses —
   and nothing records who took what.

## Shape of the solution

One export endpoint family, server-side, shared by every surface.

```
POST /api/v1/exports              { type, format, filters }  -> 202 { exportId }
GET  /api/v1/exports/{id}                                     -> { status, rowCount, url? }
GET  /api/v1/exports/{id}/download                            -> the file
```

`type` names a registered export (`admin.orders`, `seller.products`,
`inventory.movements`, …). Each registration declares:

- the query, taking filters as parameters — never string-built
- **the authorization rule** — the scope is part of the export definition, so a
  seller export cannot return another seller's rows even if the caller asks
- the column set and their formatting

**Sync or async by size.** Under a threshold (say 5k rows) stream the response
directly and skip the job machinery entirely — most exports are small and
should stay a single click. Over it, return `202`, do the work in a job, and
notify on completion. One code path, one decision point.

**Format.** CSV always. XLSX where it earns its place — orders and inventory
reporting, where a line-item sheet plus a summary is the point. Generate with
Apache POI server-side, which unlike ExcelJS **can write native Excel charts**;
that retires the "the chart is a picture, not a live chart" caveat we have
today.

## Phasing

**Phase 1 — orders and products, sync streaming.** The two that matter, plus the
registration/authorization scaffolding. No job queue, no object store. Retires
the client-side page-walking hack for orders. Front end gets one `useExport()`
hook and the existing Export button points at it.

**Phase 2 — async for large exports.** Job row, worker, object-store upload,
signed download URL, notification when ready. Threshold flips exports over the
size limit onto this path with no front-end change.

**Phase 3 — migrate the remaining surfaces and delete the client exporters.**
`DataTable`'s CSV path becomes a fallback for purely client-side tables only;
`lib/csv.ts` in inventory-web goes away. Nothing new is added to either.

**Phase 4 — audit + retention.** Record who exported what and when; expire
stored files. Sooner if the PII question gets asked first, which it should.

## Decisions to make before Phase 1

1. **Which service owns it.** Orders/products live in different services, so
   either each exposes its own `/exports` (consistent contract, duplicated
   scaffolding) or the gateway fronts a small export service (one place, one
   more hop). I lean per-service: exports are close to the data and the query
   is the hard part.
2. **Does inventory-web share it,** or keep its own? It talks to AT-Inv, not the
   marketplace API, so "shared" means the same *contract*, not the same code.
3. **The size threshold**, and whether the async path notifies by email or just
   in-app.

## What this explicitly does not do

No new BI or reporting product. No scheduled or recurring exports. No new
warehouse. This makes the exports we already ship correct, authorized and
complete — nothing more.

## Cost of not doing it

The client-side patch is bounded at 10k rows and degrades before that. The first
person to export orders for a full year gets a truncation warning and an
incomplete file — or, if the cap were removed, a hung tab. Products will hit the
same wall independently, and so will inventory movements, because each surface
carries its own copy of the same mistake.
