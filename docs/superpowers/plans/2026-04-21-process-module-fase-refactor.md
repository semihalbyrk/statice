# Process Module — Fase 1 / Fase 2 Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Process module so operators complete **Fase 1** (material breakdown, mandatory) before optionally continuing to **Fase 2** (fraction breakdown). Decouple Fase 2 from session completion, relax the ±1 kg balance hard-block to tolerance-based soft warnings with reason codes, and introduce pcs-vs-kg capture driven by per-material `average_weight_kg`.

**Architecture:**
- **Backend:** Prisma schema additions (`MaterialMaster.average_weight_kg`, `SortingSession.fase1_loss_*`, `fase2_loss_*`, new `LossReason` enum). Remove auto-creation of DRAFT `ProcessingRecord` from catalogue entry. Relax balance enforcement via `.env` thresholds. Add manual `markSessionSorted` path. Update `finalizeSessionIfComplete` to treat Fase 2 as optional. Update `syncCompatibilitySortingLines` to use `sum(catalogue)` instead of `asset.net_weight`.
- **Frontend:** Reorder and rename tabs (`Fase 1` first, then `Fase 2`). Catalogue entry form toggles between kg and pcs based on `is_reusable`; reusable entries auto-populate kg from material `average_weight_kg`. Balance warning popup with `LossReason` select when gap exceeds threshold. Manual "Mark as Sorted" button when Fase 1 completed.
- **Data migration:** Destructive reset of existing SortingSession / catalogue / processing data (dev + test). Material seed backfilled with plausible `average_weight_kg`.

**Tech Stack:** Prisma, Express, Vitest + Supertest, React, Zustand, Tailwind, shadcn/ui.

---

## Glossary (used consistently below)

| Old term (remove) | New term (use) |
|---|---|
| Catalogue / Shredding tab | **Fase 1** |
| Processing / Sorting tab | **Fase 2** |
| `catalogue_status` (schema) | unchanged (internal) |
| `processing_status` (schema) | unchanged (internal) |
| Balance "±1 kg tolerance" | "Balance tolerance" (configurable %) |

Enum and code identifiers remain (`AssetCatalogueEntry`, `ProcessingRecord`) — no mass rename. UI-visible strings update to Fase 1 / Fase 2.

---

## File Map

### Backend — new/modified files
- Modify: `server/prisma/schema.prisma` — add `MaterialMaster.average_weight_kg`, `SortingSession.fase1_loss_kg/reason/notes` + `fase2_loss_kg/reason/notes`, new `enum LossReason`.
- Create: `server/prisma/migrations/<timestamp>_process_fase_refactor/migration.sql`
- Modify: `server/prisma/seed.js` — drop & re-seed sessions/catalogue/processing; populate `average_weight_kg` on all seeded materials.
- Modify: `server/src/services/catalogueService.js`
  - `createEntry` — remove auto ProcessingRecord creation, add pcs↔kg resolution, validate `average_weight_kg` exists when reusable.
  - `updateEntry` — same pcs↔kg logic, reusable toggle handling.
  - `deleteEntry` — unchanged structurally.
- Modify: `server/src/services/processingService.js`
  - `normaliseOutcomePayload` — remove ±1 kg hard block on outcome create.
  - `finalizeAsset` — allow zero-outcome assets (Fase 1 only path), gated by `mode` flag.
  - `reopenAsset` — add invoice-state check (soft block unless ADMIN force flag).
- Modify: `server/src/services/sortingWorkflowService.js`
  - `updateSessionWorkflowStates` — session → SORTED only when Fase 1 COMPLETED + (no processing records OR all confirmed).
  - `finalizeSessionIfComplete` — same logic.
  - `syncCompatibilitySortingLines` — use `sum(catalogue)` denominator.
- Modify: `server/src/services/sortingService.js`
  - Add `markSessionSorted(sessionId, { fase1LossReason, fase1LossNotes, force }, userId)` — manual path.
  - `reopenSession` — invoice-state guard.
- Modify: `server/src/routes/sorting.js`
  - Add `PATCH /sorting/:sessionId/mark-sorted` (roles: SORTING_EMPLOYEE, GATE_OPERATOR, ADMIN, COMPLIANCE_OFFICER).
- Modify: `server/.env.example` — add `BALANCE_TOLERANCE_FASE1`, `BALANCE_TOLERANCE_FASE2`.
- Modify: `server/src/utils/balanceConfig.js` — create, read env thresholds with defaults.

### Backend — tests
- Modify: `server/src/__tests__/catalogue.test.js` — remove assertion that entry auto-creates DRAFT record; add reusable pcs→kg test; add missing `average_weight_kg` validation test.
- Modify: `server/src/__tests__/processing.test.js` — allow outcomes with weight mismatch > 1 kg; assert `markSessionSorted` path; assert Fase 2 optional in confirm flow.
- Create: `server/src/__tests__/sortingFaseComplete.test.js` — new coverage for Fase 1-only completion and loss tracking.

### Frontend — modified files
- Modify: `client/src/pages/sorting/SortingPage.jsx` — tabs array order `['fase1', 'fase2', 'reusables', 'reports']`, labels "Fase 1", "Fase 2"; default `activeTab = 'fase1'`; add "Mark as Sorted" button when Fase 1 completed; add balance warning modal component.
- Modify: `client/src/pages/sorting/SortingProcessListPage.jsx` — any UI strings referencing "Shredding" or "Catalogue".
- Modify: `client/src/components/catalogue/CatalogueEntryForm.jsx` (or inline section in SortingPage if no component yet) — pcs/kg toggle driven by `is_reusable` + `material.average_weight_kg`.
- Create: `client/src/components/sorting/BalanceWarningDialog.jsx`
- Modify: `client/src/pages/admin/MaterialsManagementPage.jsx` (or equivalent admin form) — add `average_weight_kg` input.
- Modify: `client/src/store/sortingStore.js` — add `markSessionSorted` action.
- Modify: `client/src/api/sorting.js` — add `markSessionSorted(sessionId, payload)`.
- Modify: `client/src/api/catalogue.js` — update `updateMaterial` / `createMaterial` signatures (they already pass through body, verify `average_weight_kg` flows).

### Frontend — tests
- Modify: `client/src/pages/sorting/__tests__/SortingPage.test.jsx` — tab labels, default tab.
- Create: `client/src/components/sorting/__tests__/BalanceWarningDialog.test.jsx`
- Create: `client/src/components/catalogue/__tests__/CatalogueEntryForm.test.jsx` (if component extracted).

---

## Task Sequencing

Tasks are grouped into phases. Keep commits small and focused — one TDD cycle per task.

### Phase A — Schema & Seed Foundation

### Task 1: Add `average_weight_kg` to MaterialMaster

**Files:**
- Modify: `server/prisma/schema.prisma` (MaterialMaster model at line 751)
- Create: `server/prisma/migrations/<ts>_material_average_weight/migration.sql` (generated by Prisma)
- Modify: `server/src/__tests__/catalogue.test.js`

- [ ] **Step 1: Add failing test for creating material with `average_weight_kg`**

Append to `catalogue.test.js` (in the material CRUD describe block):

```javascript
it('creates a material with average_weight_kg', async () => {
  const token = await getAuthToken('admin@statice.nl');
  const res = await request(app)
    .post('/api/catalogue/materials')
    .set('Authorization', `Bearer ${token}`)
    .send({
      code: 'MAT-TEST-AVG',
      name: 'Test Appliance',
      waste_stream_id: 'ws-weee',
      cbs_code: 'CBS-TEST',
      weeelabex_group: 'WL-TEST',
      eural_code: '200135',
      weee_category: 'WEEE-04',
      average_weight_kg: 3.5,
    });
  expect(res.status).toBe(201);
  expect(res.body.average_weight_kg).toBe('3.5');
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd server && npx vitest run src/__tests__/catalogue.test.js -t "average_weight_kg"`
Expected: FAIL (unknown field / saved as null).

- [ ] **Step 3: Add field to schema**

In `server/prisma/schema.prisma`, inside `model MaterialMaster`, add after `default_process_description`:

```prisma
  average_weight_kg           Decimal? @db.Decimal(10, 3)
```

- [ ] **Step 4: Generate migration**

Run: `cd server && npx prisma migrate dev --name material_average_weight --create-only`

Then inspect the generated `migration.sql` — ensure it only adds the nullable column.

- [ ] **Step 5: Update `createMaterial` and `updateMaterial` to accept the field**

In `server/src/services/catalogueService.js`, update both functions to pass `average_weight_kg` through (it's already pattern-matched — verify it's in the `data` payload path. If the current implementation uses explicit destructuring, add the field there).

Representative patch (createMaterial):

```javascript
const payload = {
  code: data.code,
  name: data.name,
  waste_stream_id: data.waste_stream_id,
  cbs_code: data.cbs_code,
  weeelabex_group: data.weeelabex_group,
  eural_code: data.eural_code,
  weee_category: data.weee_category,
  legacy_category_id: data.legacy_category_id ?? null,
  default_process_description: data.default_process_description ?? null,
  average_weight_kg: data.average_weight_kg ?? null,
};
```

Validation: if provided, must be `> 0` — throw `HttpError(400, 'average_weight_kg must be positive')` otherwise.

- [ ] **Step 6: Apply migration + run test**

Run: `cd server && npx prisma migrate dev && npx vitest run src/__tests__/catalogue.test.js -t "average_weight_kg"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations server/src/services/catalogueService.js server/src/__tests__/catalogue.test.js
git commit -m "feat(schema): add MaterialMaster.average_weight_kg"
```

---

### Task 2: Add loss-tracking fields + `LossReason` enum to SortingSession

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/<ts>_session_loss_tracking/migration.sql`

- [ ] **Step 1: Add failing test**

Create `server/src/__tests__/sortingFaseComplete.test.js` with the first test:

```javascript
const request = require('supertest');
const app = require('../index');
const { getAuthToken } = require('./helpers/auth');

describe('SortingSession loss tracking', () => {
  it('persists fase1_loss fields on the session model', async () => {
    const prisma = require('../utils/prismaClient');
    const session = await prisma.sortingSession.findFirst();
    // Test will fail until we apply migration with the new fields
    await prisma.sortingSession.update({
      where: { id: session.id },
      data: {
        fase1_loss_kg: 1.25,
        fase1_loss_reason: 'MOISTURE',
        fase1_loss_notes: 'expected drying',
      },
    });
    const updated = await prisma.sortingSession.findUnique({ where: { id: session.id } });
    expect(Number(updated.fase1_loss_kg)).toBe(1.25);
    expect(updated.fase1_loss_reason).toBe('MOISTURE');
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd server && npx vitest run src/__tests__/sortingFaseComplete.test.js`
Expected: FAIL (unknown field `fase1_loss_kg`).

- [ ] **Step 3: Add enum + fields to schema**

In `server/prisma/schema.prisma`, add near other sorting enums:

```prisma
enum LossReason {
  MOISTURE
  DUST
  MEASUREMENT_VARIANCE
  SPILLAGE
  CONTAMINATION_REMOVED
  OTHER
}
```

In `model SortingSession`, append:

```prisma
  fase1_loss_kg     Decimal?    @db.Decimal(12, 3)
  fase1_loss_reason LossReason?
  fase1_loss_notes  String?
  fase2_loss_kg     Decimal?    @db.Decimal(12, 3)
  fase2_loss_reason LossReason?
  fase2_loss_notes  String?
```

- [ ] **Step 4: Generate + apply migration**

Run: `cd server && npx prisma migrate dev --name session_loss_tracking`

- [ ] **Step 5: Re-run test**

Run: `cd server && npx vitest run src/__tests__/sortingFaseComplete.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations server/src/__tests__/sortingFaseComplete.test.js
git commit -m "feat(schema): add fase1/fase2 loss tracking to SortingSession"
```

---

### Task 3: Balance tolerance config module

**Files:**
- Create: `server/src/utils/balanceConfig.js`
- Modify: `server/.env.example`
- Create: `server/src/utils/__tests__/balanceConfig.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// server/src/utils/__tests__/balanceConfig.test.js
const { getBalanceThresholds } = require('../balanceConfig');

describe('balanceConfig', () => {
  afterEach(() => {
    delete process.env.BALANCE_TOLERANCE_FASE1;
    delete process.env.BALANCE_TOLERANCE_FASE2;
  });

  it('returns defaults when env missing', () => {
    const t = getBalanceThresholds();
    expect(t.fase1).toBe(0.05);
    expect(t.fase2).toBe(0.05);
  });

  it('reads env values when present', () => {
    process.env.BALANCE_TOLERANCE_FASE1 = '0.03';
    process.env.BALANCE_TOLERANCE_FASE2 = '0.02';
    const t = getBalanceThresholds();
    expect(t.fase1).toBe(0.03);
    expect(t.fase2).toBe(0.02);
  });

  it('clamps invalid env values to default', () => {
    process.env.BALANCE_TOLERANCE_FASE1 = 'not-a-number';
    const t = getBalanceThresholds();
    expect(t.fase1).toBe(0.05);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd server && npx vitest run src/utils/__tests__/balanceConfig.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```javascript
// server/src/utils/balanceConfig.js
const DEFAULT_FASE1 = 0.05;
const DEFAULT_FASE2 = 0.05;

function parseRatio(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) return fallback;
  return n;
}

function getBalanceThresholds() {
  return {
    fase1: parseRatio(process.env.BALANCE_TOLERANCE_FASE1, DEFAULT_FASE1),
    fase2: parseRatio(process.env.BALANCE_TOLERANCE_FASE2, DEFAULT_FASE2),
  };
}

module.exports = { getBalanceThresholds };
```

- [ ] **Step 4: Update `.env.example`**

Append to `server/.env.example`:

```
# Balance tolerance (ratio 0..1) — gaps above this require a LossReason.
BALANCE_TOLERANCE_FASE1=0.05
BALANCE_TOLERANCE_FASE2=0.05
```

- [ ] **Step 5: Run test to verify pass**

Run: `cd server && npx vitest run src/utils/__tests__/balanceConfig.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/utils/balanceConfig.js server/src/utils/__tests__/balanceConfig.test.js server/.env.example
git commit -m "feat(config): balance tolerance env var module"
```

---

### Phase B — Service Layer

### Task 4: Remove auto-create ProcessingRecord in `createEntry`

**Files:**
- Modify: `server/src/services/catalogueService.js` (`createEntry`, line 339)
- Modify: `server/src/__tests__/catalogue.test.js`

- [ ] **Step 1: Update test to assert NO auto-created processing record**

Replace any existing assertion that a DRAFT record is auto-created. Add:

```javascript
it('does NOT create a ProcessingRecord when a catalogue entry is created', async () => {
  const token = await getAuthToken('sorter@statice.nl');
  const res = await request(app)
    .post(`/api/catalogue/sessions/${SESSION_ID}/assets/${ASSET_ID}/entries`)
    .set('Authorization', `Bearer ${token}`)
    .send({ material_id: 'mat-hdd', weight_kg: 10 });
  expect(res.status).toBe(201);

  const prisma = require('../utils/prismaClient');
  const records = await prisma.processingRecord.findMany({
    where: { catalogue_entry_id: res.body.id },
  });
  expect(records).toHaveLength(0);
});
```

Replace or remove any old test asserting the opposite.

- [ ] **Step 2: Run the test, expect failure**

Run: `cd server && npx vitest run src/__tests__/catalogue.test.js -t "does NOT create a ProcessingRecord"`
Expected: FAIL (currently creates a DRAFT).

- [ ] **Step 3: Remove the auto-create block in `createEntry`**

In `server/src/services/catalogueService.js`, locate the transaction body of `createEntry`. Remove the `tx.processingRecord.create({ ... })` call that runs after `tx.assetCatalogueEntry.create()`. Keep reusable-item creation and `updateSessionWorkflowStates`.

- [ ] **Step 4: Run tests**

Run: `cd server && npx vitest run src/__tests__/catalogue.test.js`
Expected: PASS.

Also run: `cd server && npx vitest run src/__tests__/processing.test.js`
If any processing test relied on auto-created records, update it by creating the record explicitly (a small helper in the test setup).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/catalogueService.js server/src/__tests__/catalogue.test.js server/src/__tests__/processing.test.js
git commit -m "refactor(catalogue): stop auto-creating DRAFT ProcessingRecord"
```

---

### Task 5: Reusable pcs→kg auto-calc in catalogue entry

**Files:**
- Modify: `server/src/services/catalogueService.js` (`createEntry`, `updateEntry`)
- Modify: `server/src/__tests__/catalogue.test.js`

- [ ] **Step 1: Write failing tests**

Add to `catalogue.test.js`:

```javascript
describe('catalogue entry reusable pcs/kg logic', () => {
  it('computes weight_kg from quantity × average_weight_kg for reusable entries', async () => {
    const prisma = require('../utils/prismaClient');
    await prisma.materialMaster.update({
      where: { id: 'mat-hdd' },
      data: { average_weight_kg: 2.0 },
    });
    const token = await getAuthToken('sorter@statice.nl');
    const res = await request(app)
      .post(`/api/catalogue/sessions/${SESSION_ID}/assets/${ASSET_ID}/entries`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        material_id: 'mat-hdd',
        reuse_eligible_quantity: 3,
        is_reusable: true,
      });
    expect(res.status).toBe(201);
    expect(Number(res.body.weight_kg)).toBe(6.0);
  });

  it('rejects reusable entry when material has no average_weight_kg', async () => {
    const prisma = require('../utils/prismaClient');
    await prisma.materialMaster.update({
      where: { id: 'mat-pcb' },
      data: { average_weight_kg: null },
    });
    const token = await getAuthToken('sorter@statice.nl');
    const res = await request(app)
      .post(`/api/catalogue/sessions/${SESSION_ID}/assets/${ASSET_ID}/entries`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        material_id: 'mat-pcb',
        reuse_eligible_quantity: 2,
        is_reusable: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/average_weight_kg/i);
  });

  it('accepts a manual weight_kg for non-reusable entries', async () => {
    const token = await getAuthToken('sorter@statice.nl');
    const res = await request(app)
      .post(`/api/catalogue/sessions/${SESSION_ID}/assets/${ASSET_ID}/entries`)
      .set('Authorization', `Bearer ${token}`)
      .send({ material_id: 'mat-hdd', weight_kg: 12.5 });
    expect(res.status).toBe(201);
    expect(Number(res.body.weight_kg)).toBe(12.5);
  });
});
```

- [ ] **Step 2: Run, expect failures**

Run: `cd server && npx vitest run src/__tests__/catalogue.test.js -t "reusable pcs/kg"`
Expected: FAIL.

- [ ] **Step 3: Implement pcs→kg resolution in `createEntry`**

In `server/src/services/catalogueService.js` `createEntry`, before the transaction, add:

```javascript
const isReusable = Boolean(data.is_reusable) || (data.reuse_eligible_quantity ?? 0) > 0;
const material = await prisma.materialMaster.findUnique({ where: { id: data.material_id } });
if (!material || !material.is_active) {
  throw new HttpError(400, 'Material not found or inactive');
}

let weight_kg;
let reuse_eligible_quantity = 0;

if (isReusable) {
  const qty = Number(data.reuse_eligible_quantity ?? 0);
  if (!Number.isInteger(qty) || qty < 1) {
    throw new HttpError(400, 'reuse_eligible_quantity must be a positive integer for reusable entries');
  }
  const avg = material.average_weight_kg ? Number(material.average_weight_kg) : null;
  if (!avg || avg <= 0) {
    throw new HttpError(400, 'Material has no average_weight_kg configured; admin must set it before reusable entries');
  }
  weight_kg = Number((qty * avg).toFixed(3));
  reuse_eligible_quantity = qty;
} else {
  weight_kg = Number(data.weight_kg);
  if (!Number.isFinite(weight_kg) || weight_kg <= 0) {
    throw new HttpError(400, 'weight_kg must be positive for non-reusable entries');
  }
}
```

Then pass the computed `weight_kg` and `reuse_eligible_quantity` into the `tx.assetCatalogueEntry.create()` call.

- [ ] **Step 4: Apply same resolver to `updateEntry`**

Replicate the resolver logic at the top of `updateEntry`, with one extra rule: if `is_reusable` was `true` before and is now `false` (or vice-versa), the service must:
- Allow switching from non-reusable → reusable: delete any existing `ReusableItem` records linked to the entry, re-derive `weight_kg` from qty × avg.
- Allow switching from reusable → non-reusable: delete `ReusableItem` records, require caller to provide explicit `weight_kg`.

(Do not keep partially-filled reusable item data on toggle — document in the response via `warnings` array: `warnings: ['Reusable item details were cleared']`.)

- [ ] **Step 5: Run tests**

Run: `cd server && npx vitest run src/__tests__/catalogue.test.js`
Expected: PASS (all, including previous).

- [ ] **Step 6: Commit**

```bash
git add server/src/services/catalogueService.js server/src/__tests__/catalogue.test.js
git commit -m "feat(catalogue): reusable entries compute weight from average_weight_kg"
```

---

### Task 6: Relax Fase 2 balance enforcement in `normaliseOutcomePayload`

**Files:**
- Modify: `server/src/services/processingService.js`
- Modify: `server/src/__tests__/processing.test.js`

- [ ] **Step 1: Failing test — creating an outcome with >1 kg gap should succeed (no hard block)**

```javascript
it('accepts outcome creation even when weight gap exceeds 1 kg', async () => {
  // seed scenario where asset net weight = 100 kg, one existing outcome for 50 kg
  // add another outcome of 30 kg -> total 80 kg, gap = -20 kg
  const token = await getAuthToken('sorter@statice.nl');
  const res = await request(app)
    .post(`/api/processing/records/${RECORD_ID}/outcomes`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      fraction_id: 'fr-copper',
      weight_kg: 30,
      prepared_for_reuse_pct: 0,
      recycling_pct: 100,
      other_material_recovery_pct: 0,
      energy_recovery_pct: 0,
      thermal_disposal_pct: 0,
    });
  expect(res.status).toBe(201);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd server && npx vitest run src/__tests__/processing.test.js -t "weight gap exceeds"`
Expected: FAIL (current code rejects with error).

- [ ] **Step 3: Remove ±1 kg hard block**

In `server/src/services/processingService.js` `normaliseOutcomePayload` (around line 109), delete the block:

```javascript
if (Math.abs(delta) > 1) {
  throw new HttpError(400, '...');
}
```

Keep the percentage sum = 100 validation.

- [ ] **Step 4: Run tests**

Run: `cd server && npx vitest run src/__tests__/processing.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/processingService.js server/src/__tests__/processing.test.js
git commit -m "refactor(processing): remove hard ±1kg balance block on outcome creation"
```

---

### Task 7: Allow Fase 1 only — `finalizeAsset` handles zero outcomes

**Files:**
- Modify: `server/src/services/processingService.js` (`finalizeAsset`, line 354)
- Modify: `server/src/__tests__/processing.test.js`

- [ ] **Step 1: Failing test — finalize asset with catalogue entries but no processing records**

```javascript
it('finalizes an asset with Fase 1 entries only (no processing records)', async () => {
  // Setup: catalogue entries exist, no ProcessingRecord
  const token = await getAuthToken('admin@statice.nl');
  const res = await request(app)
    .post(`/api/processing/sessions/${SESSION_ID}/assets/${ASSET_ID}/finalize`)
    .set('Authorization', `Bearer ${token}`)
    .send({ mode: 'fase1_only' });
  expect(res.status).toBe(200);
  expect(res.body.finalized).toBe(true);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd server && npx vitest run src/__tests__/processing.test.js -t "Fase 1 entries only"`
Expected: FAIL.

- [ ] **Step 3: Update `finalizeAsset`**

Short-circuit when no records exist:

```javascript
async function finalizeAsset(sessionId, assetId, userId, options = {}) {
  return prisma.$transaction(async (tx) => {
    const records = await tx.processingRecord.findMany({
      where: { session_id: sessionId, asset_id: assetId, is_current: true },
      include: { outcomes: true },
    });

    if (records.length === 0) {
      // Fase 1 only path — require at least one catalogue entry
      const entries = await tx.assetCatalogueEntry.findMany({
        where: { session_id: sessionId, asset_id: assetId },
      });
      if (entries.length === 0) {
        throw new HttpError(400, 'Cannot finalize: no catalogue entries on this asset');
      }
      await writeAuditLog(tx, { userId, action: 'FINALIZE_ASSET_FASE1_ONLY', entity_id: assetId });
      await updateSessionWorkflowStates(tx, sessionId);
      return { finalized: true, mode: 'fase1_only', recordCount: 0 };
    }

    // Existing path (records present): validate each has outcomes, run percentage checks.
    // Keep existing logic but drop the ±1 kg balance hard-block.
    // ... existing code ...
  });
}
```

Also drop the ±1 kg balance check here (balance will be surfaced in the UI via warning popup).

- [ ] **Step 4: Run tests**

Run: `cd server && npx vitest run src/__tests__/processing.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/processingService.js server/src/__tests__/processing.test.js
git commit -m "feat(processing): allow finalizing asset with Fase 1 entries only"
```

---

### Task 8: `markSessionSorted` manual path + auto-trigger update

**Files:**
- Modify: `server/src/services/sortingService.js` (add `markSessionSorted`)
- Modify: `server/src/services/sortingWorkflowService.js` (`updateSessionWorkflowStates`, `finalizeSessionIfComplete`)
- Modify: `server/src/routes/sorting.js` (new route)
- Modify: `server/src/__tests__/sortingFaseComplete.test.js`

- [ ] **Step 1: Failing test for manual mark-sorted**

```javascript
it('marks a session as SORTED manually when Fase 1 is complete', async () => {
  // seed: session has catalogue entries on every asset, no processing records
  const token = await getAuthToken('admin@statice.nl');
  const res = await request(app)
    .patch(`/api/sorting/${SESSION_ID}/mark-sorted`)
    .set('Authorization', `Bearer ${token}`)
    .send({ fase1_loss_reason: 'MOISTURE', fase1_loss_notes: 'normal drying' });
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('SORTED');

  const prisma = require('../utils/prismaClient');
  const session = await prisma.sortingSession.findUnique({ where: { id: SESSION_ID } });
  expect(session.fase1_loss_reason).toBe('MOISTURE');
  const inbound = await prisma.inbound.findUnique({ where: { id: session.inbound_id } });
  expect(inbound.status).toBe('SORTED');
});

it('rejects mark-sorted when Fase 1 incomplete (not every asset has entries)', async () => {
  const token = await getAuthToken('admin@statice.nl');
  const res = await request(app)
    .patch(`/api/sorting/${INCOMPLETE_SESSION_ID}/mark-sorted`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/Fase 1/i);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd server && npx vitest run src/__tests__/sortingFaseComplete.test.js`
Expected: FAIL (route missing).

- [ ] **Step 3: Implement `markSessionSorted`**

Add to `server/src/services/sortingService.js`:

```javascript
async function markSessionSorted(sessionId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.sortingSession.findUnique({
      where: { id: sessionId },
      include: { inbound: { include: { assets: true } }, catalogue_entries: true, processing_records: { where: { is_current: true } } },
    });
    if (!session) throw new HttpError(404, 'Session not found');
    if (session.status === 'SORTED') throw new HttpError(400, 'Session already SORTED');

    // Fase 1 gate: every asset must have ≥1 catalogue entry
    const assetIds = session.inbound.assets.map((a) => a.id);
    const entriesByAsset = new Map();
    for (const e of session.catalogue_entries) {
      entriesByAsset.set(e.asset_id, (entriesByAsset.get(e.asset_id) ?? 0) + 1);
    }
    const missing = assetIds.filter((id) => !entriesByAsset.has(id));
    if (missing.length > 0) {
      throw new HttpError(400, `Fase 1 incomplete: ${missing.length} asset(s) have no entries`);
    }

    // If any Fase 2 record is not CONFIRMED, block unless explicitly skipped
    const blockers = session.processing_records.filter((r) => r.status !== 'CONFIRMED');
    if (blockers.length > 0) {
      throw new HttpError(400, `Fase 2 records exist in non-CONFIRMED state (count=${blockers.length}); confirm or delete them first`);
    }

    await tx.sortingSession.update({
      where: { id: sessionId },
      data: {
        status: 'SORTED',
        fase1_loss_kg: data.fase1_loss_kg ?? null,
        fase1_loss_reason: data.fase1_loss_reason ?? null,
        fase1_loss_notes: data.fase1_loss_notes ?? null,
      },
    });
    await tx.inbound.update({
      where: { id: session.inbound_id },
      data: { status: 'SORTED' },
    });
    await transitionOrderIfEligible(tx, session.order_id);
    await syncCompatibilitySortingLines(tx, sessionId);
    await writeAuditLog(tx, { userId, action: 'SESSION_MARKED_SORTED', entity_id: sessionId });

    return tx.sortingSession.findUnique({ where: { id: sessionId } });
  });
}
```

Export it.

- [ ] **Step 4: Wire up route**

In `server/src/routes/sorting.js`, add:

```javascript
router.patch(
  '/:sessionId/mark-sorted',
  authenticate,
  authorize(['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN', 'COMPLIANCE_OFFICER']),
  async (req, res, next) => {
    try {
      const updated = await sortingService.markSessionSorted(req.params.sessionId, req.body ?? {}, req.user.id);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);
```

- [ ] **Step 5: Update `updateSessionWorkflowStates` and `finalizeSessionIfComplete`**

In `server/src/services/sortingWorkflowService.js`, change the condition that sets `session.status = SORTED`:

Old logic assumed `processing_status === COMPLETED`. New logic:

```javascript
// Session auto-SORTED only when:
// (a) Fase 1 COMPLETED, AND
// (b) if any processing records exist and at least one is not CONFIRMED, skip auto-sort
const processingRecords = /* fetch count grouped by status */;
const fase1Complete = catalogue_status === 'COMPLETED';
const fase2Blocking = processingRecords.some((r) => r.status !== 'CONFIRMED');
const shouldAutoSort = fase1Complete && !fase2Blocking;
```

Only when the transitive confirm path finishes do we auto-finalize. Manual path stays in `markSessionSorted`.

- [ ] **Step 6: Run tests**

Run: `cd server && npm test`
Expected: all new tests pass, no regressions.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/sortingService.js server/src/services/sortingWorkflowService.js server/src/routes/sorting.js server/src/__tests__/sortingFaseComplete.test.js
git commit -m "feat(sorting): manual markSessionSorted + Fase 2-optional auto-complete"
```

---

### Task 9: Update `syncCompatibilitySortingLines` denominator

**Files:**
- Modify: `server/src/services/sortingWorkflowService.js` (`syncCompatibilitySortingLines`, line 207)
- Modify: `server/src/__tests__/sorting.test.js`

- [ ] **Step 1: Failing test — legacy lines sum to catalogue weight, not asset net weight**

```javascript
it('legacy SortingLine total matches sum(catalogue) when gap exists', async () => {
  // seed: asset net 100 kg, catalogue entries sum 90 kg, processing outcomes fully cover catalogue
  await triggerCompletionFlow(SESSION_ID);
  const lines = await prisma.sortingLine.findMany({ where: { sorting_session_id: SESSION_ID } });
  const total = lines.reduce((s, l) => s + Number(l.weight_kg), 0);
  expect(total).toBeCloseTo(90, 1);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd server && npx vitest run src/__tests__/sorting.test.js -t "legacy SortingLine"`
Expected: FAIL.

- [ ] **Step 3: Update `syncCompatibilitySortingLines`**

Change the denominator source from `asset.net_weight_kg` to `sum(catalogueEntries[assetId].weight_kg)`. Representative diff:

```javascript
const catalogueByAsset = new Map();
for (const entry of session.catalogue_entries) {
  catalogueByAsset.set(entry.asset_id, (catalogueByAsset.get(entry.asset_id) ?? 0) + Number(entry.weight_kg));
}

for (const assetId of assetIds) {
  const denominator = catalogueByAsset.get(assetId) ?? 0;
  if (denominator === 0) continue; // no Fase 1 content -> no line

  // ... existing route-percentage math but divide by `denominator` instead of asset.net_weight_kg ...
}
```

- [ ] **Step 4: Run tests**

Run: `cd server && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/sortingWorkflowService.js server/src/__tests__/sorting.test.js
git commit -m "fix(workflow): sync legacy SortingLine using sum(catalogue) denominator"
```

---

### Task 10: Invoice-state guard in `reopenAsset` and `reopenSession`

**Files:**
- Modify: `server/src/services/processingService.js` (`reopenAsset`)
- Modify: `server/src/services/sortingService.js` (`reopenSession`)
- Modify: `server/src/__tests__/processing.test.js`

- [ ] **Step 1: Failing test**

```javascript
it('reopenAsset blocks when related order is INVOICED unless force=true', async () => {
  await prisma.order.update({ where: { id: ORDER_ID }, data: { status: 'INVOICED' } });
  const token = await getAuthToken('admin@statice.nl');
  const res = await request(app)
    .post(`/api/processing/sessions/${SESSION_ID}/assets/${ASSET_ID}/reopen`)
    .set('Authorization', `Bearer ${token}`)
    .send({ reason_code: 'DATA_ENTRY_ERROR' });
  expect(res.status).toBe(409);
  expect(res.body.error).toMatch(/invoiced/i);
});

it('reopenAsset allows force=true when order is INVOICED', async () => {
  const token = await getAuthToken('admin@statice.nl');
  const res = await request(app)
    .post(`/api/processing/sessions/${SESSION_ID}/assets/${ASSET_ID}/reopen`)
    .set('Authorization', `Bearer ${token}`)
    .send({ reason_code: 'DATA_ENTRY_ERROR', force: true });
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Run, expect failures**

Run: `cd server && npx vitest run src/__tests__/processing.test.js -t "INVOICED"`
Expected: FAIL.

- [ ] **Step 3: Implement guard**

In `reopenAsset`, at the start of the transaction:

```javascript
const session = await tx.sortingSession.findUnique({ where: { id: sessionId }, include: { inbound: { include: { order: true } } } });
if (session.inbound.order.status === 'INVOICED' && !data.force) {
  throw new HttpError(409, 'Cannot reopen: related order is already invoiced. Pass force=true as ADMIN to override.');
}
```

Add the same guard in `reopenSession`.

- [ ] **Step 4: Run tests**

Run: `cd server && npx vitest run src/__tests__/processing.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/processingService.js server/src/services/sortingService.js server/src/__tests__/processing.test.js
git commit -m "feat(reopen): guard against reopening invoiced orders without force"
```

---

### Phase C — Seed & Migration Reset

### Task 11: Backfill `average_weight_kg` + reset sample processes in seed

**Files:**
- Modify: `server/prisma/seed.js`

- [ ] **Step 1: Update MaterialMaster seeds**

In `seed.js`, augment each of the 5 seeded materials with plausible averages (per WEEE research; units kg):

```javascript
const materialSeeds = [
  { id: 'mat-hdd', code: 'MAT-HDD', name: 'Hard Disk Drives', average_weight_kg: 0.65, /* …existing fields… */ },
  { id: 'mat-pcb', code: 'MAT-PCB', name: 'Printed Circuit Boards', average_weight_kg: 0.25, /* … */ },
  { id: 'mat-sha', code: 'MAT-SHA', name: 'Small Household Appliances', average_weight_kg: 2.5, /* … */ },
  { id: 'mat-lha', code: 'MAT-LHA', name: 'Large Household Appliances', average_weight_kg: 45.0, /* … */ },
  { id: 'mat-scr', code: 'MAT-SCR', name: 'Screens (TVs, monitors)', average_weight_kg: 18.0, /* … */ },
];
```

- [ ] **Step 2: Reset existing sessions / catalogue / processing data**

Delete seed-bootstrap blocks that created sample catalogue entries or processing records on previous runs. Instead, seed only `SortingSession` shells (status: PLANNED) so developer flows start fresh.

Representative deletes (before creation):

```javascript
await prisma.processingOutcomeLine.deleteMany({});
await prisma.processingRecord.deleteMany({});
await prisma.reusableItem.deleteMany({});
await prisma.assetCatalogueEntry.deleteMany({});
await prisma.sortingLine.deleteMany({});
await prisma.sortingSession.deleteMany({});
```

Keep these destructive deletes before inserts, and gate them with a check on `NODE_ENV !== 'production'` as a safety rail.

- [ ] **Step 3: Run seed + verify**

Run: `cd server && node prisma/seed.js`

Verify: `cd server && npx prisma studio` — inspect Material rows show `average_weight_kg`, SortingSession rows exist but have no catalogue/processing children.

- [ ] **Step 4: Run full test suite**

Run: `cd server && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/seed.js
git commit -m "chore(seed): backfill material average_weight_kg + reset sample processes"
```

---

### Phase D — Frontend: Tab + Forms

### Task 12: Rename + reorder tabs to Fase 1 / Fase 2

**Files:**
- Modify: `client/src/pages/sorting/SortingPage.jsx`
- Modify: `client/src/pages/sorting/SortingProcessListPage.jsx` (any references)
- Modify: `client/src/pages/sorting/__tests__/SortingPage.test.jsx`

- [ ] **Step 1: Update test**

```jsx
it('renders tabs in order: Fase 1, Fase 2, Reusables, Reports', () => {
  renderSortingPage();
  const tabs = screen.getAllByRole('tab');
  expect(tabs[0]).toHaveTextContent('Fase 1');
  expect(tabs[1]).toHaveTextContent('Fase 2');
  expect(tabs[2]).toHaveTextContent('Reusables');
  expect(tabs[3]).toHaveTextContent('Reports');
});

it('defaults to Fase 1 tab on load', () => {
  renderSortingPage();
  expect(screen.getByRole('tab', { name: /Fase 1/ })).toHaveAttribute('aria-selected', 'true');
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd client && npx vitest run src/pages/sorting/__tests__/SortingPage.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Reorder tabs**

In `SortingPage.jsx`:
- Change `const [activeTab, setActiveTab] = useState('processing')` → `useState('fase1')`.
- Update the tabs array to render in this order with these keys + labels:
  - `fase1` → "Fase 1" (wraps current catalogue content)
  - `fase2` → "Fase 2" (wraps current processing content)
  - `reusables` → "Reusables" (unchanged)
  - `reports` → "Reports" (unchanged)
- Rename the `activeTab === 'catalogue'` branch to `activeTab === 'fase1'` and `activeTab === 'processing'` to `activeTab === 'fase2'`.

- [ ] **Step 4: Check sibling pages**

Per feedback rule #1 (cross-tab consistency): grep the client for `'catalogue'` and `'processing'` tab key usages (e.g. `SortingProcessListPage`, any breadcrumb helpers). Update labels only where the user-facing strings say Catalogue/Processing referring to these tabs. Do not touch schema-level identifiers.

Run: `grep -rn "Catalogue\|Shredding\|Processing" client/src/pages/sorting client/src/components/sorting`

- [ ] **Step 5: Run tests**

Run: `cd client && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/sorting client/src/components/sorting
git commit -m "feat(ui): rename tabs to Fase 1/Fase 2 and reorder Fase 1 first"
```

---

### Task 13: Catalogue entry form — pcs/kg toggle

**Files:**
- Modify: `client/src/pages/sorting/SortingPage.jsx` (or extract to new `client/src/components/sorting/CatalogueEntryForm.jsx`)
- Create: `client/src/components/sorting/__tests__/CatalogueEntryForm.test.jsx`

- [ ] **Step 1: Extract form into its own component** (if not already)

If the catalogue form is still inline, extract it to `client/src/components/sorting/CatalogueEntryForm.jsx`. Props: `{ materials, onSubmit, defaultValues, onCancel }`.

- [ ] **Step 2: Write failing test for pcs/kg toggle**

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import CatalogueEntryForm from '../CatalogueEntryForm';

const materials = [
  { id: 'mat-hdd', code: 'MAT-HDD', name: 'HDD', average_weight_kg: 0.65 },
  { id: 'mat-pcb', code: 'MAT-PCB', name: 'PCB', average_weight_kg: null },
];

it('auto-computes weight from quantity × average_weight_kg when reusable', () => {
  const onSubmit = vi.fn();
  render(<CatalogueEntryForm materials={materials} onSubmit={onSubmit} />);

  fireEvent.change(screen.getByLabelText(/Material/i), { target: { value: 'mat-hdd' } });
  fireEvent.click(screen.getByLabelText(/Reusable/i));
  fireEvent.change(screen.getByLabelText(/Quantity/i), { target: { value: '4' } });

  expect(screen.getByLabelText(/Weight/i)).toHaveValue(2.6);
  expect(screen.getByLabelText(/Weight/i)).toBeDisabled();
});

it('disables reusable toggle when material lacks average_weight_kg', () => {
  render(<CatalogueEntryForm materials={materials} onSubmit={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(/Material/i), { target: { value: 'mat-pcb' } });
  const reusableToggle = screen.getByLabelText(/Reusable/i);
  expect(reusableToggle).toBeDisabled();
  expect(screen.getByText(/no average_weight/i)).toBeInTheDocument();
});

it('allows manual kg entry when not reusable', () => {
  const onSubmit = vi.fn();
  render(<CatalogueEntryForm materials={materials} onSubmit={onSubmit} />);
  fireEvent.change(screen.getByLabelText(/Material/i), { target: { value: 'mat-hdd' } });
  fireEvent.change(screen.getByLabelText(/Weight/i), { target: { value: '12.5' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ weight_kg: 12.5, is_reusable: false }),
  );
});
```

- [ ] **Step 3: Run, expect failure**

Run: `cd client && npx vitest run src/components/sorting/__tests__/CatalogueEntryForm.test.jsx`
Expected: FAIL.

- [ ] **Step 4: Implement toggle**

Inside the form:

```jsx
const selectedMaterial = materials.find((m) => m.id === form.material_id);
const canBeReusable = Boolean(selectedMaterial?.average_weight_kg);
const computedWeight = form.is_reusable && canBeReusable
  ? Number((Number(form.reuse_eligible_quantity || 0) * Number(selectedMaterial.average_weight_kg)).toFixed(3))
  : null;

useEffect(() => {
  if (form.is_reusable && computedWeight != null) {
    setForm((f) => ({ ...f, weight_kg: computedWeight }));
  }
}, [form.is_reusable, form.reuse_eligible_quantity, form.material_id]);

// render:
<label>
  <input type="checkbox" disabled={!canBeReusable} checked={form.is_reusable} onChange={...} />
  Reusable
</label>
{!canBeReusable && form.material_id && (
  <p className="text-xs text-yellow-700">no average_weight_kg configured for this material</p>
)}
{form.is_reusable ? (
  <input type="number" min={1} step={1} label="Quantity" ... />
) : null}
<input type="number" label="Weight (kg)" value={form.weight_kg} disabled={form.is_reusable} ... />
```

On submit, translate `form.is_reusable` to the request body:

```javascript
const payload = form.is_reusable
  ? { material_id: form.material_id, is_reusable: true, reuse_eligible_quantity: Number(form.reuse_eligible_quantity), notes: form.notes }
  : { material_id: form.material_id, weight_kg: Number(form.weight_kg), notes: form.notes };
```

- [ ] **Step 5: Run tests**

Run: `cd client && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/sorting/CatalogueEntryForm.jsx client/src/components/sorting/__tests__ client/src/pages/sorting/SortingPage.jsx
git commit -m "feat(ui): catalogue form pcs/kg toggle driven by average_weight_kg"
```

---

### Task 14: Admin material form — `average_weight_kg` input

**Files:**
- Modify: `client/src/pages/admin/MaterialsManagementPage.jsx` (or actual admin material form component — verify via grep).

- [ ] **Step 1: Locate the form**

Run: `grep -rn "createMaterial\|updateMaterial" client/src/pages/admin client/src/components` to find the form component.

- [ ] **Step 2: Write a failing UI test**

Add to the form's test file (create one if absent) a test that submits `average_weight_kg` and asserts the API mock received it.

- [ ] **Step 3: Add the input**

Add a number input labelled "Average weight (kg) — required for reusable tracking" with step=`0.001`, min=0, help text explaining that leaving blank disables reusable toggle.

- [ ] **Step 4: Pass through to `updateMaterial` / `createMaterial` calls**

Confirm the submit handler includes `average_weight_kg: form.average_weight_kg ? Number(form.average_weight_kg) : null`.

- [ ] **Step 5: Run tests + commit**

```bash
cd client && npm test
git add client/src/pages/admin
git commit -m "feat(admin-ui): material form exposes average_weight_kg"
```

---

### Task 15: Balance warning dialog + wiring into "Mark as Sorted"

**Files:**
- Create: `client/src/components/sorting/BalanceWarningDialog.jsx`
- Create: `client/src/components/sorting/__tests__/BalanceWarningDialog.test.jsx`
- Modify: `client/src/pages/sorting/SortingPage.jsx`
- Modify: `client/src/api/sorting.js`
- Modify: `client/src/store/sortingStore.js`

- [ ] **Step 1: Add API helper**

In `client/src/api/sorting.js`:

```javascript
export async function markSessionSorted(sessionId, payload = {}) {
  const res = await apiClient.patch(`/sorting/${sessionId}/mark-sorted`, payload);
  return res.data;
}
```

- [ ] **Step 2: Write failing dialog test**

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import BalanceWarningDialog from '../BalanceWarningDialog';

const LOSS_REASONS = ['MOISTURE', 'DUST', 'MEASUREMENT_VARIANCE', 'SPILLAGE', 'CONTAMINATION_REMOVED', 'OTHER'];

it('requires a reason when gap ratio > threshold and calls onConfirm with chosen reason', () => {
  const onConfirm = vi.fn();
  render(
    <BalanceWarningDialog
      open
      gapKg={-11}
      gapRatio={0.022}
      threshold={0.05}
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  );

  // Within threshold: reason is optional, button enabled
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
  expect(onConfirm).toHaveBeenCalledWith({ reason: null, notes: null });
});

it('blocks confirm until a reason is chosen when above threshold', () => {
  const onConfirm = vi.fn();
  render(
    <BalanceWarningDialog
      open
      gapKg={-30}
      gapRatio={0.1}
      threshold={0.05}
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'MOISTURE' } });
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
  expect(onConfirm).toHaveBeenCalledWith({ reason: 'MOISTURE', notes: null });
});
```

- [ ] **Step 3: Run, expect failure**

Run: `cd client && npx vitest run src/components/sorting/__tests__/BalanceWarningDialog.test.jsx`
Expected: FAIL.

- [ ] **Step 4: Implement dialog**

`client/src/components/sorting/BalanceWarningDialog.jsx`:

```jsx
import { useState } from 'react';
// Reuse project-native Dialog primitives (shadcn/ui or existing component)

const REASONS = ['MOISTURE', 'DUST', 'MEASUREMENT_VARIANCE', 'SPILLAGE', 'CONTAMINATION_REMOVED', 'OTHER'];

export default function BalanceWarningDialog({ open, gapKg, gapRatio, threshold, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  if (!open) return null;

  const aboveThreshold = Math.abs(gapRatio) > threshold;
  const ratioPct = (gapRatio * 100).toFixed(1);

  const confirmDisabled = aboveThreshold && !reason;

  return (
    <div role="dialog" className="...">
      <h2>Balance gap detected</h2>
      <p>
        Gap: <strong>{gapKg.toFixed(1)} kg</strong> ({ratioPct}%) vs. tolerance {(threshold * 100).toFixed(0)}%
      </p>
      {aboveThreshold ? (
        <p className="text-orange-700">A loss reason is required to continue.</p>
      ) : (
        <p className="text-grey-700">Within tolerance — reason optional.</p>
      )}
      <label>
        Reason
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">— none —</option>
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label>
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel}>Cancel</button>
        <button
          disabled={confirmDisabled}
          onClick={() => onConfirm({ reason: reason || null, notes: notes || null })}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire into SortingPage Mark-as-Sorted button**

In `SortingPage.jsx`, add a button above or near the tabs (visible only when Fase 1 status is COMPLETED and session status is PLANNED):

```jsx
{session.catalogue_status === 'COMPLETED' && session.status === 'PLANNED' && (
  <button onClick={() => setMarkAsSortedOpen(true)}>Mark as Sorted</button>
)}
<BalanceWarningDialog
  open={markAsSortedOpen}
  gapKg={fase1GapKg}
  gapRatio={fase1GapRatio}
  threshold={balanceThresholds.fase1}
  onCancel={() => setMarkAsSortedOpen(false)}
  onConfirm={async ({ reason, notes }) => {
    await markSessionSorted(sessionId, {
      fase1_loss_kg: fase1GapKg,
      fase1_loss_reason: reason,
      fase1_loss_notes: notes,
    });
    setMarkAsSortedOpen(false);
    await fetchSession(sessionId);
  }}
/>
```

Compute `fase1GapKg` and `fase1GapRatio` from the session data:

```javascript
const assetNetTotal = session.inbound.assets.reduce((s, a) => s + Number(a.net_weight_kg), 0);
const catalogueTotal = session.catalogue_entries.reduce((s, e) => s + Number(e.weight_kg), 0);
const fase1GapKg = catalogueTotal - assetNetTotal;
const fase1GapRatio = assetNetTotal > 0 ? fase1GapKg / assetNetTotal : 0;
```

- [ ] **Step 6: Run tests**

Run: `cd client && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/sorting/BalanceWarningDialog.jsx client/src/pages/sorting/SortingPage.jsx client/src/api/sorting.js
git commit -m "feat(ui): balance warning dialog + manual mark-as-sorted flow"
```

---

### Task 16: Fase 2 manual "Add Processing Record" flow

**Files:**
- Modify: `client/src/pages/sorting/SortingPage.jsx`
- Modify: `client/src/api/processing.js`
- Modify: `server/src/services/processingService.js` (expose `createRecordForEntry`)
- Modify: `server/src/routes/processing.js`
- Modify: `server/src/__tests__/processing.test.js`

Because auto-creation was removed in Task 4, the UI now needs an explicit "Add record" affordance. The backend endpoint must exist first.

- [ ] **Step 1: Backend failing test**

```javascript
it('creates a ProcessingRecord from a catalogue entry on demand', async () => {
  const token = await getAuthToken('sorter@statice.nl');
  const res = await request(app)
    .post(`/api/processing/sessions/${SESSION_ID}/records`)
    .set('Authorization', `Bearer ${token}`)
    .send({ catalogue_entry_id: ENTRY_ID });
  expect(res.status).toBe(201);
  expect(res.body.status).toBe('DRAFT');
  expect(res.body.catalogue_entry_id).toBe(ENTRY_ID);
});
```

- [ ] **Step 2: Implement service method**

Add `createRecordForEntry(sessionId, { catalogue_entry_id }, userId)` mirroring the fields that `createEntry` previously set. Include `material_code_snapshot`, `material_name_snapshot`, `weee_category_snapshot`, `version_no=1`, `is_current=true`, `status=DRAFT`.

- [ ] **Step 3: Wire route**

`POST /api/processing/sessions/:sessionId/records` → PROCESSING_ROLES.

- [ ] **Step 4: Run backend tests**

Run: `cd server && npm test`
Expected: PASS.

- [ ] **Step 5: Add API helper + UI button**

`client/src/api/processing.js`:

```javascript
export async function createProcessingRecord(sessionId, payload) {
  const res = await apiClient.post(`/processing/sessions/${sessionId}/records`, payload);
  return res.data;
}
```

In `SortingPage.jsx` Fase 2 tab, for each catalogue entry that has no associated processing record, render an "Add Fase 2 record" button that calls the helper and reloads the session.

- [ ] **Step 6: Run client tests**

Run: `cd client && npm test`

- [ ] **Step 7: Commit**

```bash
git add server/src/services/processingService.js server/src/routes/processing.js server/src/__tests__/processing.test.js client/src/api/processing.js client/src/pages/sorting/SortingPage.jsx
git commit -m "feat(processing): explicit record creation from catalogue entry"
```

---

### Phase E — Cross-cutting Cleanups

### Task 17: Downstream report per-material rule — drop Fase-2-less materials

**Files:**
- Modify: `server/src/services/reportDataService.js` (or wherever RPT-DS data is assembled — confirm via grep)
- Modify: relevant test file

- [ ] **Step 1: Locate report data function**

Run: `grep -rn "downstream\|RPT-DS\|Downstream" server/src/services`

- [ ] **Step 2: Failing test**

Assert: given a session where one asset-material pair has catalogue entries but no processing records, the downstream report payload must NOT include that pair.

```javascript
it('omits materials without processing records from downstream report', async () => {
  // seed: mat-lha has only catalogue entry, mat-sha has entries + confirmed outcomes
  const data = await reportDataService.buildDownstream(SESSION_ID);
  const materialIds = data.materials.map((m) => m.material_id);
  expect(materialIds).toContain('mat-sha');
  expect(materialIds).not.toContain('mat-lha');
});
```

- [ ] **Step 3: Implement filter**

In the data assembly loop, skip materials where `processing_records.filter(r => r.status === 'CONFIRMED' && r.is_current).length === 0`.

- [ ] **Step 4: Run tests + commit**

```bash
cd server && npm test
git add server/src/services/reportDataService.js server/src/__tests__
git commit -m "fix(reports): downstream report shows only materials with confirmed Fase 2"
```

---

### Task 18: Full regression pass + E2E sanity

**Files:**
- Run full suites, capture failures, file targeted fixes

- [ ] **Step 1: Backend**

Run: `cd server && npm test`
Expected: 100% pass.

- [ ] **Step 2: Client**

Run: `cd client && npm test`
Expected: 100% pass.

- [ ] **Step 3: Playwright E2E (optional but recommended)**

Run: `cd client && npx playwright test -c playwright.local.config.js tests/sorting-flow.e2e.playwright.js` if such a file exists, otherwise add one covering: create catalogue entry → mark-as-sorted → verify session.status=SORTED without processing records.

- [ ] **Step 4: Manual smoke**

Start both servers (`server && npm run dev`, `client && npm run dev`), log in as admin, run through the golden flow: arrival → weighing → Fase 1 → Mark as Sorted → verify dashboard totals.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: regression fixes from fase-refactor sweep"
```

---

## Self-Review Checklist (do before handoff)

- [ ] Every enum/field referenced in frontend exists in schema (`average_weight_kg`, `fase1_loss_*`, `LossReason`).
- [ ] All `HttpError` codes (400 vs 409) match existing project conventions.
- [ ] `updateSessionWorkflowStates` no longer forces `SORTED` when Fase 1 completes but user hasn't manually marked — verify both auto (all Fase 2 confirmed) and manual (Mark as Sorted) paths are covered in tests.
- [ ] Reusable toggle: removing the reusable flag on an existing entry deletes `ReusableItem` rows and requires a manual `weight_kg` — tested.
- [ ] Invoice-state reopen guard runs for both `reopenAsset` and `reopenSession` — both tested.
- [ ] Seed file safety rail (`NODE_ENV !== 'production'`) on destructive deletes in place.
- [ ] No test references `Shredding` or "Catalogue" as a tab label anymore.
- [ ] `.env.example` updated with both balance tolerance vars.
- [ ] Feedback rule #1 (cross-tab consistency): all sibling pages using the same tab patterns updated in a single pass — confirmed via grep.
- [ ] Feedback rule #2 (ready-to-go setups): seed runs clean, tests green, UI works end-to-end.
- [ ] Feedback rule #16 (pattern-sweep after fix): confirmed by Task 12 Step 4 grep across `client/src/pages/sorting`.

---

## Execution Handoff

Plan complete and saved. Given the scope (~18 tasks across schema, services, seeds, routes, UI, tests), recommend **Inline Execution** with checkpoints — schema and service changes interlock tightly and need coherent context. Subagent-per-task is viable but adds coordination overhead for the tight backend/frontend coupling.
