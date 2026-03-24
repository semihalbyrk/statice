# Batch Fixes & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 independent UX/backend issues: single-option dropdown auto-fill, button style alignment, linked contracts on detail pages, inbound detail layout, remove landfill/processor/transfer_date fields, remove disassemble terminology, remove finance review fields, fix status dropdown overflow, redesign daily planning board.

**Architecture:** All changes are independent — each task can be done in any order. Backend changes include Prisma schema field removal (with migration), service validation cleanup, and API enrichment. Frontend changes include form auto-fill logic, layout fixes, and component cleanups.

**Tech Stack:** React 18, Tailwind CSS, Express.js, Prisma ORM, PostgreSQL

---

## Task 1: Single-Option Dropdown Auto-Fill

**Files:**
- Modify: `client/src/pages/orders/OrderCreatePage.jsx`
- Modify: `client/src/pages/contracts/ContractCreatePage.jsx`

**Context:** When a dropdown/multi-select has only one option, it should be auto-selected. WeighingEventPage already does this for waste_stream_id. Apply the same pattern to OrderCreatePage and ContractCreatePage.

- [ ] **Step 1: OrderCreatePage — auto-select single waste stream**

In `OrderCreatePage.jsx`, find the `useEffect` that calls `matchContractForOrder` (around line 59-94). After `setContractWasteStreams(match.waste_streams)`, add auto-select logic:

```javascript
// After setting contractWasteStreams
if (match.waste_streams.length === 1) {
  const wsId = match.waste_streams[0].waste_stream?.id || match.waste_streams[0].waste_stream_id;
  setForm((f) => ({ ...f, waste_stream_ids: [wsId] }));
}
```

- [ ] **Step 2: OrderCreatePage — auto-select single supplier**

In the `useEffect` or render section, after suppliers load, if `allSuppliers.length === 1`:

```javascript
useEffect(() => {
  if (allSuppliers.length === 1 && !form.supplier_id) {
    setForm((f) => ({ ...f, supplier_id: allSuppliers[0].id }));
  }
}, [allSuppliers]);
```

Same for carriers:

```javascript
useEffect(() => {
  if (carriers.length === 1 && !form.carrier_id) {
    setForm((f) => ({ ...f, carrier_id: carriers[0].id }));
  }
}, [carriers]);
```

- [ ] **Step 3: ContractCreatePage — auto-select single supplier/carrier**

Same pattern in ContractCreatePage for supplier and carrier dropdowns.

- [ ] **Step 4: Verify in browser**

Test OrderCreatePage and ContractCreatePage. If only one supplier/carrier/waste stream exists, it should be pre-selected.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/orders/OrderCreatePage.jsx client/src/pages/contracts/ContractCreatePage.jsx
git commit -m "feat: auto-select single-option dropdowns in order and contract forms"
```

---

## Task 2: Download Weight Ticket Button Style

**Files:**
- Modify: `client/src/pages/weighing/WeighingEventPage.jsx:1044`

**Context:** "Download Weight Ticket" button uses filled green (`bg-green-500 text-white`). Change to outlined style matching "Final Weighing (Tare)" button.

- [ ] **Step 1: Change button className**

Find the Download Weight Ticket button (around line 1044). Change:

```
FROM: "h-9 px-4 flex items-center gap-2 bg-green-500 text-white rounded-md font-semibold text-sm hover:bg-green-700 transition-colors"
TO:   "h-9 px-4 flex items-center gap-2 border-2 border-green-500 text-green-700 rounded-md font-semibold text-sm hover:bg-green-25 transition-colors"
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/weighing/WeighingEventPage.jsx
git commit -m "fix: align Download Weight Ticket button to outlined style"
```

---

## Task 3: Linked Contract on Order, Inbound, Process Detail Pages

**Files:**
- Modify: `server/src/services/orderService.js` — enrich order with matched contract
- Modify: `server/src/services/inboundService.js` — enrich inbound with matched contract
- Modify: `client/src/pages/orders/OrderDetailPage.jsx` — show linked contract
- Modify: `client/src/pages/weighing/WeighingEventPage.jsx` — show linked contract in inbound detail
- Modify: `client/src/pages/sorting/SortingPage.jsx` — show linked contract in process detail

**Context:** Contracts aren't directly linked to orders via FK — they're matched dynamically via `matchContractForOrder(supplierId, materialId, date)`. We need to call this matching when loading order/inbound detail and expose the result.

- [ ] **Step 1: Backend — add contract matching to order detail enrichment**

In `orderService.js`, after fetching order detail (the `getOrder` or equivalent function), call `matchContractForOrder` to find the best matching contract for this order's supplier + waste streams + date.

Add to the enrichment:
```javascript
// In the getOrder function, after fetching the order:
const contractService = require('./contractService');

// Try to match a contract for this order
let linkedContract = null;
try {
  const match = await contractService.matchContractForOrder(
    order.supplier_id,
    null, // any material
    order.planned_date || order.created_at
  );
  if (match) {
    linkedContract = {
      id: match.contract_id,
      contract_number: match.contract_number,
    };
  }
} catch (e) {
  // No match found — that's OK
}
order.linked_contract = linkedContract;
```

- [ ] **Step 2: Backend — add contract to inbound enrichment**

In `inboundService.js` `enrichInbound()`, derive from the order's supplier and date:

```javascript
// After enriching the inbound, match contract from the order data
let linkedContract = null;
if (inbound.order) {
  try {
    const contractService = require('./contractService');
    const match = await contractService.matchContractForOrder(
      inbound.order.supplier_id,
      null,
      inbound.order.planned_date || inbound.created_at
    );
    if (match) {
      linkedContract = { id: match.contract_id, contract_number: match.contract_number };
    }
  } catch (e) {}
}
inbound.linked_contract = linkedContract;
```

Note: `enrichInbound` is currently synchronous. It will need to become async, or the contract matching should be done in the `getInbound` function before calling `enrichInbound`.

- [ ] **Step 3: Frontend — show linked contract on OrderDetailPage**

In `OrderDetailPage.jsx`, add an InfoField in the detail section:

```jsx
<InfoField label="Linked Contract">
  {order.linked_contract ? (
    <Link to={`/contracts/${order.linked_contract.id}`} className="text-sm font-medium text-green-700 hover:underline">
      {order.linked_contract.contract_number}
    </Link>
  ) : (
    <span className="text-sm text-grey-400">—</span>
  )}
</InfoField>
```

- [ ] **Step 4: Frontend — show linked contract on WeighingEventPage (inbound detail)**

In the inbound detail section (around line 191-205), add:

```jsx
<InfoField label="Contract">
  {inbound.linked_contract ? (
    <Link to={`/contracts/${inbound.linked_contract.id}`} className="text-sm font-medium text-green-700 hover:underline">
      {inbound.linked_contract.contract_number}
    </Link>
  ) : (
    <span className="text-sm text-grey-400">—</span>
  )}
</InfoField>
```

- [ ] **Step 5: Frontend — show linked contract on SortingPage**

Find the session/inbound header section in SortingPage.jsx and add the same pattern.

- [ ] **Step 6: Verify in browser and commit**

```bash
git add server/src/services/orderService.js server/src/services/inboundService.js \
  client/src/pages/orders/OrderDetailPage.jsx client/src/pages/weighing/WeighingEventPage.jsx \
  client/src/pages/sorting/SortingPage.jsx
git commit -m "feat: show linked contract on order, inbound, and process detail pages"
```

---

## Task 4: Redesign Inbound Detail Section

**Files:**
- Modify: `client/src/pages/weighing/WeighingEventPage.jsx:189-216`

**Context:** Supplier field overflows in the `xl:grid-cols-5` grid when names are long. Redesign the detail section with proper truncation and responsive layout.

- [ ] **Step 1: Refactor detail section grid**

Replace the current grid (around lines 189-216) with a more robust layout. Change from `xl:grid-cols-5` to `xl:grid-cols-4` and ensure all fields have `truncate` and `title` for tooltip on hover:

```jsx
<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
  <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-3 gap-x-6 min-w-0">
    <InfoField label="Carrier">
      <p className="text-sm font-medium text-grey-900 mt-0.5 truncate" title={order?.carrier?.name}>{order?.carrier?.name || '—'}</p>
    </InfoField>
    <InfoField label="Supplier">
      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
        <span className="text-sm font-medium text-grey-900 truncate" title={order?.supplier?.name}>{order?.supplier?.name || '—'}</span>
        {order?.supplier && <SupplierTypeBadge type={order.supplier.supplier_type} size="sm" />}
      </div>
    </InfoField>
    <InfoField label="Vehicle Plate">
      <p className="text-sm font-mono font-medium text-grey-900 mt-0.5 tracking-wider">{order?.vehicle_plate || '—'}</p>
    </InfoField>
    <InfoField label="Waste Stream(s)">
      <p className="text-sm font-medium text-grey-900 mt-0.5 truncate" title={wasteStreamLabel}>{wasteStreamLabel || '—'}</p>
    </InfoField>
    <InfoField label="Arrived At" value={formatDateTime(inbound.arrived_at)} />
    <InfoField label="Contract">
      {inbound.linked_contract ? (
        <Link to={`/contracts/${inbound.linked_contract.id}`} className="text-sm font-medium text-green-700 hover:underline mt-0.5 block">
          {inbound.linked_contract.contract_number}
        </Link>
      ) : <p className="text-sm text-grey-400 mt-0.5">—</p>}
    </InfoField>
    {inbound.notes && (
      <InfoField label="Notes" className="lg:col-span-4">
        <p className="text-sm text-grey-700 mt-0.5">{inbound.notes}</p>
      </InfoField>
    )}
  </div>
  {/* Order Name - right aligned on large screens */}
  <div className="lg:min-w-[180px] lg:text-right">
    <span className="text-xs font-medium text-grey-500 uppercase tracking-wide">Order</span>
    <Link to={`/orders/${order?.id}`} className="block text-sm font-medium text-green-700 mt-0.5 hover:underline">{order?.order_name || '—'}</Link>
  </div>
</div>
```

- [ ] **Step 2: Verify in browser — check with long supplier names**

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/weighing/WeighingEventPage.jsx
git commit -m "fix: redesign inbound detail section with proper truncation"
```

---

## Task 5: Remove Landfill, Downstream Processor, Transfer Date Fields

**Files:**
- Modify: `server/prisma/schema.prisma` — remove fields from ProcessingOutcomeLine, SortingLine, FractionMaster, ProductCategory
- Create: `server/prisma/migrations/<timestamp>_remove_landfill_processor_fields/migration.sql`
- Modify: `server/src/services/processingService.js` — remove all validations
- Modify: `server/src/services/sortingService.js` — remove downstream fields
- Modify: `server/src/services/sortingWorkflowService.js` — remove landfill references
- Modify: `server/src/services/catalogueService.js` — remove landfill_disposal_pct_default
- Modify: `server/src/services/reportDataService.js` — remove landfill from reports
- Modify: `server/src/services/processorService.js` — remove validateProcessorCertification
- Modify: `server/src/middleware/sortingValidation.js` — remove landfill_pct
- Modify: `client/src/pages/sorting/SortingPage.jsx` — remove landfill/processor UI fields
- Modify: `client/src/pages/admin/SystemSettingsPage.jsx` — remove require_downstream_processor setting
- Modify: `server/src/controllers/settingsController.js` — remove require_downstream_processor
- Modify: `server/prisma/seed.js` — remove landfill_disposal_pct_default from seed

**Context:** These features are not ready for the product yet. Remove all references from code, UI, validations, and database schema.

- [ ] **Step 1: Schema — remove fields**

In `schema.prisma`:

From `ProductCategory` model, remove:
```
landfill_pct_default    Decimal?   @map("landfill_pct_default")
```

From `SortingLine` model, remove:
```
landfill_pct                  Decimal?
downstream_processor          String?
downstream_processor_address  String?
downstream_permit_number      String?
transfer_date                 DateTime?
transfer_method               String?
certificate_reference         String?
```

From `FractionMaster` model, remove:
```
landfill_disposal_pct_default  Decimal?
```

From `ProcessingOutcomeLine` model, remove:
```
landfill_disposal_pct      Decimal?
downstream_processor_id    String?
transfer_date              DateTime?
landfill_reason_code       String?
```

Also remove the relation:
```
downstream_processor   Processor?  @relation(...)
```

From `TreatmentRoute` enum, remove:
```
LANDFILL
```

- [ ] **Step 2: Create migration**

```bash
cd server && npx prisma migrate dev --name remove_landfill_processor_fields
```

This will generate a migration that drops the columns. Review and run it.

- [ ] **Step 3: Backend — clean processingService.js**

Remove:
- `buildLegacyRoutePercentages()` LANDFILL case handling (lines 63-71)
- `landfill_disposal_pct` from normalization (line 97)
- `landfillDisposalPct` calculation (line 110)
- `landfillDisposalPct` from percentage sum validation (line 118)
- Validation requiring `landfill_reason_code` (lines 127-128)
- `landfill_disposal_pct` and `landfill_reason_code` from payload (lines 144, 148)
- `validateProcessorCertification()` calls (lines 273-281, 349-357)
- `downstream_processor_id` and `transfer_date` from payload (lines 145-146)
- Finalization validations for landfill and processor (lines 461-471)
- `landfill_disposal_pct`, `landfill_reason_code`, `downstream_processor_id`, `transfer_date` from update queries (lines 621-627)
- Notification trigger for landfill outcomes (lines 294-296)

- [ ] **Step 4: Backend — clean sortingService.js**

Remove downstream_processor fields from SortingLine create/update logic (lines 294-296, 344-348).

- [ ] **Step 5: Backend — clean sortingWorkflowService.js**

Remove `landfill_disposal_pct_default` from fraction include (line 25), landfill accumulation in totals (line 116), downstream fields from projection (lines 252-254).

- [ ] **Step 6: Backend — clean catalogueService.js**

Remove `landfill_disposal_pct_default` from fraction creation (line 221) and update (line 258).

- [ ] **Step 7: Backend — clean reportDataService.js**

Remove `landfill_disposal_pct` from outcome key generation (line 678) and mapping (lines 692, 773).

- [ ] **Step 8: Backend — clean sortingValidation.js**

Remove `landfill_pct` from `PCT_FIELDS` array (line 3) and extraction logic (line 33).

- [ ] **Step 9: Backend — clean settingsController.js**

Remove `require_downstream_processor` setting handling (lines 24, 50-52).

- [ ] **Step 10: Backend — clean seed.js**

Remove `landfill_disposal_pct_default` values from fraction seed data (lines 160, 173).

- [ ] **Step 11: Frontend — clean SortingPage.jsx**

Remove:
- `landfill_disposal_pct` from empty outcome form (line 64)
- `landfill_disposal_pct_default` from form initialization (line 80)
- `landfill_disposal_pct` from percentage sum calculation (line 91)
- `landfill_disposal_pct` from outcome data mapping (line 845)
- Percentage input UI for landfill field (line 974)
- Processor dropdown and transfer_date input fields in outcome form
- `processors` state and `listProcessors()` API call (lines 110, 140) — only if processors are ONLY used for downstream processing. Check if processors are used elsewhere in sorting first.

- [ ] **Step 12: Frontend — clean SystemSettingsPage.jsx**

Remove `require_downstream_processor` checkbox (lines 86, 163-167).

- [ ] **Step 13: Run migrations and test**

```bash
cd server && npx prisma migrate dev
cd server && npm test
cd client && npm run build
```

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: remove landfill, downstream processor, and transfer date fields from product"
```

---

## Task 6: Replace "Disassemble" Terminology

**Files:**
- Modify: `client/src/pages/sorting/SortingPage.jsx:1173`

**Context:** Only one occurrence: "Confirm disassembly first" → "Confirm all records first"

- [ ] **Step 1: Replace text**

```
FROM: <span className="text-xs text-grey-400">Confirm disassembly first</span>
TO:   <span className="text-xs text-grey-400">Confirm all records first</span>
```

- [ ] **Step 2: Grep for any remaining occurrences**

```bash
grep -ri "disassembl" client/ server/ --include="*.js" --include="*.jsx"
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/sorting/SortingPage.jsx
git commit -m "fix: replace disassembly terminology with processing records"
```

---

## Task 7: Remove Finance Review & Approved By Fields

**Files:**
- Modify: `server/prisma/schema.prisma` — remove `approved_by`, `requires_finance_review`, `approved_by_user` relation from SupplierContract
- Create: migration to drop columns
- Modify: `server/src/services/contractService.js` — remove from includes, create, update, approve logic
- Modify: `client/src/pages/contracts/ContractCreatePage.jsx` — remove checkbox
- Modify: `client/src/pages/contracts/ContractDetailPage.jsx` — remove display fields
- Modify: `client/src/components/contracts/ContractFormModal.jsx` — remove checkbox
- Modify: test files

**Context:** Approval/notification features not yet implemented. Remove all traces.

- [ ] **Step 1: Schema — remove fields from SupplierContract**

Remove from `SupplierContract` model:
```
approved_by                 String?
requires_finance_review     Boolean            @default(false)
approved_by_user            User?              @relation("ContractsApproved", fields: [approved_by], references: [id])
```

Also check the `User` model for the inverse relation `contracts_approved` and remove it.

- [ ] **Step 2: Create migration**

```bash
cd server && npx prisma migrate dev --name remove_finance_review_fields
```

- [ ] **Step 3: Backend — clean contractService.js**

Remove from CONTRACT_INCLUDE and CONTRACT_LIST_INCLUDE:
```
approved_by_user: { select: { id: true, full_name: true } },
```

Remove from createContract:
```
requires_finance_review: data.requires_finance_review ?? false,
```

Remove from updateContract:
```
if (data.requires_finance_review !== undefined) updateData.requires_finance_review = data.requires_finance_review;
```

In approveContract, remove `approved_by: userId` from update data and audit log entries.

- [ ] **Step 4: Frontend — clean ContractCreatePage.jsx**

Remove:
- `requires_finance_review: false` from form state (line 101)
- `requires_finance_review: c.requires_finance_review ?? false` from fetched state (line 136)
- Checkbox UI (lines 417-422)

- [ ] **Step 5: Frontend — clean ContractDetailPage.jsx**

Remove:
- "Approved By" display field (line 172-173)
- "Finance Review Required" display field (line 180-181)

- [ ] **Step 6: Frontend — clean ContractFormModal.jsx**

Remove:
- `requires_finance_review` from form state (line 32)
- Checkbox UI (lines 141-143)

- [ ] **Step 7: Clean test files**

Remove mock data and assertions for `approved_by_user`, `requires_finance_review` from:
- `client/src/pages/contracts/__tests__/ContractDetailPage.test.jsx`
- `client/src/components/contracts/__tests__/ContractFormModal.test.jsx`

- [ ] **Step 8: Run tests**

```bash
cd server && npm test
cd client && npm test
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: remove finance review and approved by fields from contracts"
```

---

## Task 8: Fix Status Dropdown Overflow in Order/Inbound Lists

**Files:**
- Modify: `client/src/pages/orders/OrdersPage.jsx:124`
- Modify: `client/src/pages/inbounds/InboundsPage.jsx:80`

**Context:** `overflow-x-auto` on table container clips ClickableStatusBadge dropdown. Fix: change to `overflow-visible` like Suppliers/Carriers pages.

- [ ] **Step 1: OrdersPage — change overflow**

Line 124:
```
FROM: "bg-white rounded-lg border border-grey-200 shadow-sm overflow-x-auto"
TO:   "bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible"
```

- [ ] **Step 2: InboundsPage — change overflow**

Line 80:
```
FROM: "bg-white rounded-lg border border-grey-200 shadow-sm overflow-x-auto"
TO:   "bg-white rounded-lg border border-grey-200 shadow-sm overflow-visible"
```

- [ ] **Step 3: Verify in browser**

Check that status dropdowns in Order and Inbound lists appear above the section border and are fully visible.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/orders/OrdersPage.jsx client/src/pages/inbounds/InboundsPage.jsx
git commit -m "fix: status dropdown overflow in order and inbound list pages"
```

---

## Task 9: Redesign Daily Planning Board

**Files:**
- Modify: `client/src/pages/orders/PlanningBoardPage.jsx`

**Context:** Cards are too cramped on XL screens (4 cols). Text overlaps. Fix: reduce max columns, increase spacing, improve field layout.

- [ ] **Step 1: Change grid to max 3 columns**

Line 181:
```
FROM: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
TO:   "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
```

- [ ] **Step 2: Improve card body spacing**

Line 216:
```
FROM: "space-y-2.5 text-sm"
TO:   "space-y-3 text-sm"
```

- [ ] **Step 3: Fix label-value pairs to prevent overlap**

For each `flex items-center justify-between` row in the card body, add `gap-3 min-w-0` and wrap the value with `truncate`:

```jsx
<div className="flex items-center justify-between gap-3 min-w-0">
  <span className="text-grey-500 flex-shrink-0">Supplier</span>
  <span className="text-grey-900 font-medium text-right truncate" title={supplier}>{supplier}</span>
</div>
```

Apply this pattern to ALL field rows in the card:
- Carrier
- Supplier
- Waste Stream
- Vehicle Plate
- Time Window
- Expected Parcels

Remove the `max-w-[60%]` constraint on waste stream value — `truncate` handles this better.

- [ ] **Step 4: Improve badge row spacing**

In the header badge area (around line 195), ensure:
```jsx
<div className="flex items-center gap-2 flex-wrap">
```
(Use `gap-2` instead of `gap-1.5` for more breathing room)

- [ ] **Step 5: Verify in browser at various screen sizes**

Check sm, md, lg screen widths. Ensure no text overlap.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/orders/PlanningBoardPage.jsx
git commit -m "fix: redesign daily planning board for better readability"
```

---

## Task Order Recommendation

Independent tasks — can be done in any order. Recommended sequence for least risk:

1. **Task 6** (disassemble terminology) — trivial, 1 line
2. **Task 2** (button style) — trivial, 1 className change
3. **Task 8** (status overflow) — low risk, 2 lines
4. **Task 1** (auto-fill dropdowns) — frontend only
5. **Task 9** (planning board) — frontend only
6. **Task 4** (inbound detail) — frontend only
7. **Task 3** (linked contracts) — backend + frontend
8. **Task 7** (remove finance review) — schema migration + cleanup
9. **Task 5** (remove landfill/processor) — largest, most files affected

**Tasks 5 and 7** involve Prisma migrations — run them sequentially, not in parallel.
