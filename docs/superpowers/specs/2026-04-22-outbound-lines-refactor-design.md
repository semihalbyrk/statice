# Outbound Lines Refactor — Remove OutgoingParcel

**Date:** 2026-04-22
**Branch:** feat/entity-refactor
**Status:** Approved design, pending implementation plan

## Problem

The current `OutboundParcel` model treats each container as an independent, labelled entity (OPR-xxxxx) with its own lifecycle (AVAILABLE → ASSIGNED → SHIPPED). This over-models the real-world workflow:

- Containers aren't tracked individually before the truck is loaded.
- The separate `/parcels/outgoing/*` CRUD pages are dead-weight UX — operators only care about "what materials and container sizes are on this truck."
- The Begeleidingsbrief (BGL) packaging column (`aantal/verpakking`) is a simple per-material aggregate like `2 x 40m³` or `1 x 40m³, 1 x 60m³`. The parcel status and label fields never reach the BGL.

The waste-transport domain doesn't need parcel identity — it needs line items.

## New Model

Replace `OutboundParcel` with `OutboundLine`: an inline child of `Outbound` describing one container unit on the shipment. No status, no label, no independent lifecycle.

### Prisma Schema

```prisma
model OutboundLine {
  id             String    @id @default(uuid())
  outbound_id    String    @map("outbound_id")
  material_id    String    @map("material_id")
  container_type SkipType  @map("container_type")
  volume         Decimal   @db.Decimal(10, 2)
  volume_uom     VolumeUom @map("volume_uom")
  created_at     DateTime  @default(now()) @map("created_at")
  updated_at     DateTime  @updatedAt @map("updated_at")

  outbound Outbound       @relation(fields: [outbound_id], references: [id], onDelete: Cascade)
  material MaterialMaster @relation(fields: [material_id], references: [id], onDelete: Restrict)

  @@map("outbound_lines")
  @@index([outbound_id])
  @@index([material_id])
}

enum VolumeUom {
  M3
  L
}
```

**Removed:**
- `OutboundParcel` model
- `OutboundParcelStatus` enum (`AVAILABLE | ASSIGNED | SHIPPED`)
- `Outbound.parcels` relation
- `outbound_parcels` table

**Cascade rationale:** `OutboundLine` has no life outside its parent outbound — cascade delete when outbound is removed. `MaterialMaster` deletion stays restricted (can't drop a material that's referenced on any historical line).

**No tare weight per line.** Weighing happens once at the truck level via the existing `recordWeighing` flow (TARE + GROSS on the outbound).

## API Surface

### Removed endpoints

```
DELETE: POST   /api/outbound-parcels
DELETE: GET    /api/outbound-parcels
DELETE: GET    /api/outbound-parcels/:id
DELETE: PUT    /api/outbound-parcels/:id
DELETE: DELETE /api/outbound-parcels/:id
DELETE: POST   /api/outbounds/:id/parcels
DELETE: GET    /api/outbounds/:id/parcels
DELETE: DELETE /api/outbounds/:id/parcels/:parcelId
```

### New endpoints

```
GET    /api/outbounds/:id/lines            → list lines for outbound
POST   /api/outbounds/:id/lines            → add one line
PUT    /api/outbounds/:id/lines/:lineId    → update one line
DELETE /api/outbounds/:id/lines/:lineId    → remove one line
```

**Request body (POST / PUT):**

```json
{
  "material_id": "uuid",
  "container_type": "OPEN_TOP",
  "volume": 40,
  "volume_uom": "M3"
}
```

**Mutation gate:** Allowed only when `outbound.status ∈ {CREATED, LOADING}`. Returns 400 otherwise. Same rule as the current `canMutateParcels` logic.

**Role guard:** `ADMIN`, `LOGISTICS_PLANNER` — matches current parcel mutation roles.

**Validation:**
- `volume > 0`
- Soft cap: M3 ≤ 1000, L ≤ 50000 (reject with 400 above these)
- `material_id` must reference an active `MaterialMaster`
- `material_id` must be present in `outbound.outbound_order.waste_streams` (material planned for this shipment)
- `container_type` must be a valid `SkipType`
- `volume_uom ∈ {M3, L}`

**Audit:** Each mutation writes an `AuditLog` entry with action `CREATE_OUTBOUND_LINE | UPDATE_OUTBOUND_LINE | DELETE_OUTBOUND_LINE` including outbound_id, line_id, and the payload diff.

## BGL Rendering

The Begeleidingsbrief packaging column (`aantal/verpakking`) is populated per waste-stream row in `mapBegeleidingsbrief()`. Replace the parcel-based `formatPackaging` with a line-based version.

### Grouping rule

For each waste-stream row (= one material), gather all `OutboundLine` rows with the same `material_id`. Group those by the composite key `(volume, volume_uom)`. Do NOT group by `container_type` — the BGL cell has no room for container type names, and the Dutch form only cares about count and size.

### Sort order within a material group

1. `volume_uom` ascending (`M3` before `L`)
2. `volume` ascending within each UoM

### Format

- `M3` → `m³`
- `L` → `L`
- Pattern: `{count} x {volume}{symbol}`
- Multiple groups joined by `, ` (comma + space)

### Examples

| Lines for a material                                      | BGL packaging cell     |
|-----------------------------------------------------------|------------------------|
| 2 × (40, M3)                                              | `2 x 40m³`             |
| 1 × (40, M3), 1 × (60, M3)                                | `1 x 40m³, 1 x 60m³`   |
| 2 × (40, M3), 3 × (200, L)                                | `2 x 40m³, 3 x 200L`   |
| 1 × (40, M3, OPEN_TOP), 1 × (40, M3, CLOSED_TOP)          | `2 x 40m³`             |

**No UoM conversion.** `40 m³` and `40000 L` are different groups even though they represent the same physical volume. User input is authoritative.

### Edge: material on line but not in waste_streams

The API layer rejects this on POST/PUT (`400 — material not planned for this shipment`). The BGL mapper never encounters it.

## UI Changes

### OutboundDetailPage

The Parcels section (attach panel, inline create form, parcel list) is replaced by a **Lines table**.

- **Header:** "Lines" title + single primary action button `+ Add Line` (when `canMutateLines`).
- **Table columns:** Material · Container Type · Volume · UoM · Actions (kebab)
- **Actions (kebab menu per row):** Edit, Delete (only when `canMutateLines`).
- **Add/Edit UX:** Inline row form — single row with 4 fields: material dropdown, container_type dropdown, volume input, UoM dropdown (M3/L). Save/Cancel buttons.
- **Empty state:** `No lines yet. Add at least one line before weighing.`
- **Totals strip:** `N lines · Σ volume grouped by UoM` (display only, e.g., `5 lines · 80 m³ · 600 L`).

**Status-based locking:**
- `CREATED`, `LOADING` → fully editable
- `WEIGHED` onward → read-only table, no Add Line button

**Feedback rule #10 applies:** Lines fit in a popup/modal? No — inline table rows are simpler and more scannable. Keep inline within the detail page, not a dedicated route.

### ParcelsPage

Remove the Outgoing tab. Page becomes Incoming-only (no tab strip needed if only one kind).

### Routes removed

- `/parcels/outgoing/new` → delete route + `OutgoingParcelCreatePage.jsx`
- `/parcels/outgoing/:id` → delete route + `OutgoingParcelDetailPage.jsx`

### OutboundsPage list

If a parcel count column exists, change to line count. Otherwise no change.

### OutboundOrderDetailPage

If the order page summarises parcels per outbound (count / volume), swap to line aggregates.

### i18n

- Delete `client/src/i18n/en/outboundParcels.json` and `client/src/i18n/nl/outboundParcels.json`
- Add `client/src/i18n/en/outboundLines.json` and `client/src/i18n/nl/outboundLines.json`
- Unregister `outboundParcels` namespace, register `outboundLines`

## Data Migration

Production data reset (consistent with prior decision for the process-module refactor — memory #897):

1. Drop `outbound_parcels` table
2. Drop `OutboundParcelStatus` enum
3. Create `outbound_lines` table and `VolumeUom` enum
4. Re-seed: add 2-3 outbounds in the seed script with representative lines (mix of M3 and L UoM, multi-material)

No conversion of existing parcel rows — the demo/test data is reset.

## Removal Checklist

**Prisma**
- [ ] Delete `model OutboundParcel`, `enum OutboundParcelStatus`
- [ ] Remove `parcels: OutboundParcel[]` from `Outbound`
- [ ] Add `model OutboundLine`, `enum VolumeUom`
- [ ] Add `lines: OutboundLine[]` to `Outbound`
- [ ] Migration file: DROP + CREATE

**Server**
- [ ] Delete `services/outboundParcelService.js`
- [ ] Delete `controllers/outboundParcelController.js`
- [ ] Delete `routes/outboundParcels.js`
- [ ] Delete `utils/outboundParcelNumber.js`
- [ ] Remove route registration from `index.js`
- [ ] Create `services/outboundLineService.js`
- [ ] Create `controllers/outboundLineController.js`
- [ ] Create `routes/outboundLines.js`
- [ ] Rewrite `services/begeleidingsbriefService.js::mapBegeleidingsbrief` and `formatPackaging`
- [ ] Update `outboundService.js` — remove parcel includes, add line includes
- [ ] Remove parcel-transition step from `confirmDeparture` (no more bulk SHIP)
- [ ] Update `seed.js` — add outbound lines instead of parcels
- [ ] Tests:
  - [ ] Delete `__tests__/outboundParcels.test.js`
  - [ ] Create `__tests__/outboundLines.test.js`
  - [ ] Update `__tests__/outbounds.test.js` — replace parcel fixtures with lines, drop SHIPPED assertions

**Client**
- [ ] Delete `pages/parcels/OutgoingParcelCreatePage.jsx` (+ test)
- [ ] Delete `pages/parcels/OutgoingParcelDetailPage.jsx` (+ test if any)
- [ ] Update `pages/parcels/ParcelsPage.jsx` — remove Outgoing tab
- [ ] Remove outgoing parcel routes from `App.jsx`
- [ ] Remove outgoing parcel functions from `api/parcels.js`
- [ ] Create `api/outboundLines.js`
- [ ] Refactor `pages/outbounds/OutboundDetailPage.jsx` — parcel panel → lines table
- [ ] Delete `i18n/en/outboundParcels.json`, `i18n/nl/outboundParcels.json`
- [ ] Create `i18n/en/outboundLines.json`, `i18n/nl/outboundLines.json`
- [ ] Update `i18n/index.js` namespace registration
- [ ] Update E2E: `outbound-lifecycle.e2e.playwright.js`, `outbound-detail.e2e.playwright.js` — swap parcel steps for line steps; delete `parcels.e2e.playwright.js` outgoing cases
- [ ] Delete `OutboundDetailPage.test.jsx` parcel-specific mocks, add line mocks

**Reports & other touchpoints**
- [ ] Scan `reportDataService.js` for parcel references; migrate to lines
- [ ] Scan any audit-log viewer for hard-coded parcel action names

## Edge Cases & Decisions

| # | Case                                                      | Resolution                                    |
|---|-----------------------------------------------------------|-----------------------------------------------|
| 1 | WEIGHED without any lines                                 | Reject — require ≥1 line to transition LOADING→WEIGHED |
| 2 | Line material not in outbound_order.waste_streams         | Reject on POST/PUT with 400                   |
| 3 | Volume ≤ 0                                                | Reject with 400                               |
| 4 | Volume above soft cap (>1000 M3 or >50000 L)              | Reject with 400                               |
| 5 | Line mutation after WEIGHED                               | Reject with 400 (same as current parcel rule) |
| 6 | BGL stale if lines change post-DOCUMENTS_READY            | Prevented by #5 (WEIGHED lock)                |
| 7 | Same numeric volume but different UoM (40 M3 vs 40 L)     | Treated as separate groups, no conversion     |
| 8 | BGL grouping sort order                                   | (volume_uom asc, volume asc)                  |
| 9 | Material inactive                                         | Reject line add/update with 400               |
| 10| Outgoing parcels on ParcelsPage                           | Tab removed, page incoming-only               |
| 11| Legacy seed parcels                                       | Drop + reseed with lines                      |
| 12| Existing production OutboundParcel rows                   | Dropped (production reset consistent with #897) |
| 13| E2E tests with parcel attach steps                        | Rewrite to use line API                       |
| 14| Historical audit-log entries referencing parcel actions   | Left as-is (read-only history); no new writes |

## Out of Scope

- No change to `IncomingParcel` system.
- No change to `Outbound` state machine (CREATED → LOADING → WEIGHED → DOCUMENTS_READY → DEPARTED → DELIVERED).
- No change to BGL PDF template or AcroForm field names — only the data mapper changes.
- No change to the weighing workflow (TARE/GROSS at truck level).
- No change to `OutboundOrder` model.

## Open Questions

None. All clarifications resolved during brainstorming.

## Next Steps

After design approval:
1. Invoke `superpowers:writing-plans` to produce a step-by-step implementation plan.
2. Execute plan via `superpowers:executing-plans` on feat/entity-refactor branch.
