# Outbound Lines Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone `OutboundParcel` entity with inline `OutboundLine` children on `Outbound`, and update the Begeleidingsbrief (BGL) packaging generator accordingly.

**Architecture:** Add `OutboundLine` + `VolumeUom` to the Prisma schema alongside the existing parcel model, build and test the new service/controller/routes, rewrite BGL packaging logic, migrate the UI, then remove all outbound parcel code in a final cleanup phase. This preserves a buildable state throughout.

**Tech Stack:** Node.js 20, Express, Prisma, PostgreSQL, Vitest + Supertest (server); React 18, React Router v6, Tailwind, Zustand, Vitest + RTL (client); Playwright (E2E).

**Spec reference:** `docs/superpowers/specs/2026-04-22-outbound-lines-refactor-design.md`

---

## Phase 1 — Prisma schema & migration

### Task 1: Add `OutboundLine` model and `VolumeUom` enum

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add `VolumeUom` enum near other enums (after `SkipType` block, around line 140)**

```prisma
enum VolumeUom {
  M3
  L
}
```

- [ ] **Step 2: Add `OutboundLine` model (place alongside `OutboundParcel`, around line 1323)**

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
  material MaterialMaster @relation(fields: [material_id], references: [id])

  @@map("outbound_lines")
  @@index([outbound_id])
  @@index([material_id])
}
```

- [ ] **Step 3: Add reverse relation on `Outbound` model — locate `parcels OutboundParcel[]` and add below:**

```prisma
  lines OutboundLine[]
```

- [ ] **Step 4: Add reverse relation on `MaterialMaster` model — locate where `OutboundParcel[]` is listed and add below:**

```prisma
  outbound_lines OutboundLine[]
```

- [ ] **Step 5: Create migration file**

Run:
```bash
cd server && mkdir -p prisma/migrations/$(date -u +%Y%m%d%H%M%S)_add_outbound_lines
```

Create `prisma/migrations/<timestamp>_add_outbound_lines/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "VolumeUom" AS ENUM ('M3', 'L');

-- CreateTable
CREATE TABLE "outbound_lines" (
    "id" TEXT NOT NULL,
    "outbound_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "container_type" "SkipType" NOT NULL,
    "volume" DECIMAL(10,2) NOT NULL,
    "volume_uom" "VolumeUom" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbound_lines_outbound_id_idx" ON "outbound_lines"("outbound_id");

-- CreateIndex
CREATE INDEX "outbound_lines_material_id_idx" ON "outbound_lines"("material_id");

-- AddForeignKey
ALTER TABLE "outbound_lines" ADD CONSTRAINT "outbound_lines_outbound_id_fkey"
  FOREIGN KEY ("outbound_id") REFERENCES "outbounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_lines" ADD CONSTRAINT "outbound_lines_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "ProductTypeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 6: Push schema to dev DB (shadow DB is broken per memory #923, use `db push`)**

Run: `cd server && npx prisma db push --skip-generate`
Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 7: Regenerate Prisma client**

Run: `cd server && npx prisma generate`
Expected: `Generated Prisma Client (...)`

- [ ] **Step 8: Verify table exists**

Run: `cd server && psql $DATABASE_URL -c '\d outbound_lines'`
Expected: table schema printout with 8 columns.

- [ ] **Step 9: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat(schema): add OutboundLine model and VolumeUom enum"
```

---

## Phase 2 — outboundLineService (TDD)

### Task 2: Create service scaffold

**Files:**
- Create: `server/src/services/outboundLineService.js`
- Create: `server/src/__tests__/outboundLines.test.js`

- [ ] **Step 1: Create test file with one failing smoke test**

Create `server/src/__tests__/outboundLines.test.js`:

```js
const { describe, it, expect } = require('vitest');
const service = require('../services/outboundLineService');

describe('outboundLineService', () => {
  it('exports the expected public API', () => {
    expect(typeof service.listByOutbound).toBe('function');
    expect(typeof service.createLine).toBe('function');
    expect(typeof service.updateLine).toBe('function');
    expect(typeof service.deleteLine).toBe('function');
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

Run: `cd server && npx vitest run src/__tests__/outboundLines.test.js`
Expected: FAIL — cannot find module `../services/outboundLineService`.

- [ ] **Step 3: Create minimal service file**

Create `server/src/services/outboundLineService.js`:

```js
const { PrismaClient } = require('@prisma/client');
const { writeAuditLog } = require('./auditService');

const prisma = new PrismaClient();

const LINE_INCLUDE = {
  material: true,
};

async function listByOutbound(outboundId) {
  return prisma.outboundLine.findMany({
    where: { outbound_id: outboundId },
    include: LINE_INCLUDE,
    orderBy: { created_at: 'asc' },
  });
}

async function createLine(outboundId, data, userId) {
  throw new Error('not implemented');
}

async function updateLine(outboundId, lineId, data, userId) {
  throw new Error('not implemented');
}

async function deleteLine(outboundId, lineId, userId) {
  throw new Error('not implemented');
}

module.exports = { listByOutbound, createLine, updateLine, deleteLine };
```

- [ ] **Step 4: Run test, confirm it passes**

Run: `cd server && npx vitest run src/__tests__/outboundLines.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/outboundLineService.js server/src/__tests__/outboundLines.test.js
git commit -m "feat(server): scaffold outboundLineService"
```

---

### Task 3: Implement `createLine` with validation (TDD)

**Files:**
- Modify: `server/src/services/outboundLineService.js`
- Modify: `server/src/__tests__/outboundLines.test.js`

- [ ] **Step 1: Add failing test — happy path**

Append to `outboundLines.test.js`:

```js
const { describe, it, expect, beforeAll, afterAll } = require('vitest');
const { PrismaClient } = require('@prisma/client');
const { createLine } = require('../services/outboundLineService');

const prisma = new PrismaClient();

describe('createLine', () => {
  let user, material, waste, order, outbound;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: { email: 'linetest@statice.test', password_hash: 'x', role: 'ADMIN', name: 'Line Test' },
    });
    material = await prisma.productTypeMaster.findFirstOrThrow({ where: { active: true } });
    waste = await prisma.wasteStream.findFirstOrThrow();
    // Minimal fixture — reuse existing seed outbound where waste_streams includes `material`.
    // Adjust to seed IDs available in your env.
    outbound = await prisma.outbound.findFirstOrThrow({
      where: { status: { in: ['CREATED', 'LOADING'] } },
      include: { outbound_order: { include: { waste_streams: true } } },
    });
  });

  afterAll(async () => {
    await prisma.outboundLine.deleteMany({ where: { outbound_id: outbound.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  it('creates a line with valid payload', async () => {
    const planned = outbound.outbound_order.waste_streams[0];
    const line = await createLine(
      outbound.id,
      {
        material_id: planned.material_id,
        container_type: 'OPEN_TOP',
        volume: 40,
        volume_uom: 'M3',
      },
      user.id,
    );
    expect(line.id).toBeDefined();
    expect(line.volume.toString()).toBe('40');
    expect(line.volume_uom).toBe('M3');
    expect(line.material).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the new test, confirm failure**

Run: `cd server && npx vitest run src/__tests__/outboundLines.test.js`
Expected: FAIL — `not implemented`.

- [ ] **Step 3: Implement `createLine`**

Replace the `createLine` stub in `outboundLineService.js`:

```js
const VOLUME_CAPS = { M3: 1000, L: 50000 };
const CONTAINER_TYPES = ['OPEN_TOP', 'CLOSED_TOP', 'GITTERBOX', 'PALLET', 'OTHER'];
const VOLUME_UOMS = ['M3', 'L'];
const MUTABLE_OUTBOUND_STATUSES = ['CREATED', 'LOADING'];

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  throw err;
}

function notFound(message = 'Not found') {
  const err = new Error(message);
  err.statusCode = 404;
  throw err;
}

function validatePayload(payload) {
  if (!payload.material_id) badRequest('material_id is required');
  if (!CONTAINER_TYPES.includes(payload.container_type)) badRequest('invalid container_type');
  if (!VOLUME_UOMS.includes(payload.volume_uom)) badRequest('invalid volume_uom');
  const volume = Number(payload.volume);
  if (!Number.isFinite(volume) || volume <= 0) badRequest('volume must be > 0');
  const cap = VOLUME_CAPS[payload.volume_uom];
  if (volume > cap) badRequest(`volume exceeds ${cap}${payload.volume_uom === 'M3' ? 'm³' : 'L'} cap`);
}

async function assertMaterialPlanned(tx, outboundId, materialId) {
  const outbound = await tx.outbound.findUnique({
    where: { id: outboundId },
    include: { outbound_order: { include: { waste_streams: true } } },
  });
  if (!outbound) notFound('outbound not found');
  if (!MUTABLE_OUTBOUND_STATUSES.includes(outbound.status)) {
    badRequest(`outbound is ${outbound.status}; lines can only be mutated in CREATED or LOADING`);
  }
  const material = await tx.productTypeMaster.findUnique({ where: { id: materialId } });
  if (!material) notFound('material not found');
  if (!material.active) badRequest('material is inactive');
  const planned = outbound.outbound_order.waste_streams.some((ws) => ws.material_id === materialId);
  if (!planned) badRequest('material not planned for this shipment');
  return outbound;
}

async function createLine(outboundId, data, userId) {
  validatePayload(data);
  return prisma.$transaction(async (tx) => {
    await assertMaterialPlanned(tx, outboundId, data.material_id);
    const line = await tx.outboundLine.create({
      data: {
        outbound_id: outboundId,
        material_id: data.material_id,
        container_type: data.container_type,
        volume: data.volume,
        volume_uom: data.volume_uom,
      },
      include: LINE_INCLUDE,
    });
    await writeAuditLog(tx, {
      user_id: userId,
      action: 'CREATE_OUTBOUND_LINE',
      entity_type: 'OutboundLine',
      entity_id: line.id,
      changes: { outbound_id: outboundId, payload: data },
    });
    return line;
  });
}
```

- [ ] **Step 4: Run test, confirm pass**

Run: `cd server && npx vitest run src/__tests__/outboundLines.test.js`
Expected: 2 tests pass.

- [ ] **Step 5: Add failing edge-case tests**

Append inside the `createLine` describe:

```js
it('rejects material not in waste_streams', async () => {
  const otherMaterial = await prisma.productTypeMaster.findFirst({
    where: {
      active: true,
      id: { notIn: outbound.outbound_order.waste_streams.map((w) => w.material_id) },
    },
  });
  if (!otherMaterial) return;
  await expect(
    createLine(outbound.id, {
      material_id: otherMaterial.id,
      container_type: 'OPEN_TOP',
      volume: 20,
      volume_uom: 'M3',
    }, user.id),
  ).rejects.toThrow(/not planned/);
});

it('rejects volume ≤ 0', async () => {
  const planned = outbound.outbound_order.waste_streams[0];
  await expect(
    createLine(outbound.id, {
      material_id: planned.material_id,
      container_type: 'OPEN_TOP',
      volume: 0,
      volume_uom: 'M3',
    }, user.id),
  ).rejects.toThrow(/> 0/);
});

it('rejects volume above cap', async () => {
  const planned = outbound.outbound_order.waste_streams[0];
  await expect(
    createLine(outbound.id, {
      material_id: planned.material_id,
      container_type: 'OPEN_TOP',
      volume: 1500,
      volume_uom: 'M3',
    }, user.id),
  ).rejects.toThrow(/cap/);
});
```

- [ ] **Step 6: Run tests, confirm all pass**

Run: `cd server && npx vitest run src/__tests__/outboundLines.test.js`
Expected: 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/outboundLineService.js server/src/__tests__/outboundLines.test.js
git commit -m "feat(server): implement createLine with validation"
```

---

### Task 4: Implement `updateLine` and `deleteLine` (TDD)

**Files:**
- Modify: `server/src/services/outboundLineService.js`
- Modify: `server/src/__tests__/outboundLines.test.js`

- [ ] **Step 1: Add failing tests for update & delete**

Append to the test file:

```js
describe('updateLine', () => {
  let user, outbound, line;
  beforeAll(async () => {
    user = await prisma.user.create({
      data: { email: 'update@statice.test', password_hash: 'x', role: 'ADMIN', name: 'U' },
    });
    outbound = await prisma.outbound.findFirstOrThrow({
      where: { status: { in: ['CREATED', 'LOADING'] } },
      include: { outbound_order: { include: { waste_streams: true } } },
    });
    const planned = outbound.outbound_order.waste_streams[0];
    line = await prisma.outboundLine.create({
      data: {
        outbound_id: outbound.id,
        material_id: planned.material_id,
        container_type: 'OPEN_TOP',
        volume: 40,
        volume_uom: 'M3',
      },
    });
  });
  afterAll(async () => {
    await prisma.outboundLine.deleteMany({ where: { outbound_id: outbound.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('updates volume and container_type', async () => {
    const { updateLine } = require('../services/outboundLineService');
    const updated = await updateLine(outbound.id, line.id, {
      volume: 60,
      volume_uom: 'M3',
      container_type: 'CLOSED_TOP',
      material_id: line.material_id,
    }, user.id);
    expect(updated.volume.toString()).toBe('60');
    expect(updated.container_type).toBe('CLOSED_TOP');
  });
});

describe('deleteLine', () => {
  it('removes the line', async () => {
    const { deleteLine, createLine } = require('../services/outboundLineService');
    const user = await prisma.user.create({
      data: { email: 'del@statice.test', password_hash: 'x', role: 'ADMIN', name: 'D' },
    });
    const outbound = await prisma.outbound.findFirstOrThrow({
      where: { status: { in: ['CREATED', 'LOADING'] } },
      include: { outbound_order: { include: { waste_streams: true } } },
    });
    const planned = outbound.outbound_order.waste_streams[0];
    const line = await createLine(outbound.id, {
      material_id: planned.material_id,
      container_type: 'PALLET',
      volume: 1,
      volume_uom: 'M3',
    }, user.id);
    await deleteLine(outbound.id, line.id, user.id);
    const gone = await prisma.outboundLine.findUnique({ where: { id: line.id } });
    expect(gone).toBeNull();
    await prisma.user.delete({ where: { id: user.id } });
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `cd server && npx vitest run src/__tests__/outboundLines.test.js`
Expected: FAIL — `not implemented`.

- [ ] **Step 3: Implement `updateLine` and `deleteLine`**

Replace stubs in `outboundLineService.js`:

```js
async function updateLine(outboundId, lineId, data, userId) {
  validatePayload(data);
  return prisma.$transaction(async (tx) => {
    await assertMaterialPlanned(tx, outboundId, data.material_id);
    const existing = await tx.outboundLine.findUnique({ where: { id: lineId } });
    if (!existing || existing.outbound_id !== outboundId) notFound('line not found');
    const updated = await tx.outboundLine.update({
      where: { id: lineId },
      data: {
        material_id: data.material_id,
        container_type: data.container_type,
        volume: data.volume,
        volume_uom: data.volume_uom,
      },
      include: LINE_INCLUDE,
    });
    await writeAuditLog(tx, {
      user_id: userId,
      action: 'UPDATE_OUTBOUND_LINE',
      entity_type: 'OutboundLine',
      entity_id: lineId,
      changes: { before: existing, after: data },
    });
    return updated;
  });
}

async function deleteLine(outboundId, lineId, userId) {
  return prisma.$transaction(async (tx) => {
    const outbound = await tx.outbound.findUnique({ where: { id: outboundId } });
    if (!outbound) notFound('outbound not found');
    if (!MUTABLE_OUTBOUND_STATUSES.includes(outbound.status)) {
      badRequest(`outbound is ${outbound.status}; lines can only be mutated in CREATED or LOADING`);
    }
    const existing = await tx.outboundLine.findUnique({ where: { id: lineId } });
    if (!existing || existing.outbound_id !== outboundId) notFound('line not found');
    await tx.outboundLine.delete({ where: { id: lineId } });
    await writeAuditLog(tx, {
      user_id: userId,
      action: 'DELETE_OUTBOUND_LINE',
      entity_type: 'OutboundLine',
      entity_id: lineId,
      changes: { deleted: existing },
    });
  });
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd server && npx vitest run src/__tests__/outboundLines.test.js`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/outboundLineService.js server/src/__tests__/outboundLines.test.js
git commit -m "feat(server): implement updateLine and deleteLine"
```

---

## Phase 3 — Controller + routes

### Task 5: Controller

**Files:**
- Create: `server/src/controllers/outboundLineController.js`

- [ ] **Step 1: Write controller**

```js
const service = require('../services/outboundLineService');

async function list(req, res, next) {
  try {
    const lines = await service.listByOutbound(req.params.id);
    res.json({ data: lines });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const line = await service.createLine(req.params.id, req.body, req.user.id);
    res.status(201).json({ data: line });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const line = await service.updateLine(req.params.id, req.params.lineId, req.body, req.user.id);
    res.json({ data: line });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await service.deleteLine(req.params.id, req.params.lineId, req.user.id);
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { list, create, update, remove };
```

- [ ] **Step 2: Commit**

```bash
git add server/src/controllers/outboundLineController.js
git commit -m "feat(server): outboundLineController"
```

---

### Task 6: Routes + registration

**Files:**
- Modify: `server/src/routes/outbounds.js`
- Modify: `server/src/index.js` (if any parcel route mount removal is needed later)

- [ ] **Step 1: Open `server/src/routes/outbounds.js` and locate the existing parcel routes**

Run: `grep -n "parcels" server/src/routes/outbounds.js`

- [ ] **Step 2: Add line routes alongside parcel routes**

Add near the existing parcel endpoints:

```js
const lineCtrl = require('../controllers/outboundLineController');

router.get('/:id/lines', requireRole(['ADMIN', 'LOGISTICS_PLANNER', 'GATE_OPERATOR']), lineCtrl.list);
router.post('/:id/lines', requireRole(['ADMIN', 'LOGISTICS_PLANNER']), lineCtrl.create);
router.put('/:id/lines/:lineId', requireRole(['ADMIN', 'LOGISTICS_PLANNER']), lineCtrl.update);
router.delete('/:id/lines/:lineId', requireRole(['ADMIN', 'LOGISTICS_PLANNER']), lineCtrl.remove);
```

- [ ] **Step 3: Add API integration test**

Create `server/src/__tests__/outboundLines.api.test.js`:

```js
const { describe, it, expect, beforeAll } = require('vitest');
const request = require('supertest');
const app = require('../index');
const { PrismaClient } = require('@prisma/client');
const { getAuthHeader } = require('./helpers/authFixtures');

const prisma = new PrismaClient();

describe('POST /api/outbounds/:id/lines', () => {
  let outbound, auth;
  beforeAll(async () => {
    auth = await getAuthHeader('ADMIN');
    outbound = await prisma.outbound.findFirstOrThrow({
      where: { status: { in: ['CREATED', 'LOADING'] } },
      include: { outbound_order: { include: { waste_streams: true } } },
    });
  });

  it('creates a line', async () => {
    const planned = outbound.outbound_order.waste_streams[0];
    const res = await request(app)
      .post(`/api/outbounds/${outbound.id}/lines`)
      .set(auth)
      .send({
        material_id: planned.material_id,
        container_type: 'OPEN_TOP',
        volume: 40,
        volume_uom: 'M3',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.volume).toBeDefined();
    await prisma.outboundLine.delete({ where: { id: res.body.data.id } });
  });

  it('rejects volume ≤ 0', async () => {
    const planned = outbound.outbound_order.waste_streams[0];
    const res = await request(app)
      .post(`/api/outbounds/${outbound.id}/lines`)
      .set(auth)
      .send({
        material_id: planned.material_id,
        container_type: 'OPEN_TOP',
        volume: 0,
        volume_uom: 'M3',
      });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4: Run API test, confirm pass**

Run: `cd server && npx vitest run src/__tests__/outboundLines.api.test.js`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/outbounds.js server/src/__tests__/outboundLines.api.test.js
git commit -m "feat(server): nested line routes under /api/outbounds/:id/lines"
```

---

## Phase 4 — BGL refactor

### Task 7: Rewrite `formatPackaging` for lines (TDD)

**Files:**
- Modify: `server/src/services/begeleidingsbriefService.js`
- Create: `server/src/__tests__/begeleidingsbriefPackaging.test.js`

- [ ] **Step 1: Write unit test**

Create `server/src/__tests__/begeleidingsbriefPackaging.test.js`:

```js
const { describe, it, expect } = require('vitest');
const { formatPackaging } = require('../services/begeleidingsbriefService');

describe('formatPackaging (lines)', () => {
  it('groups same volume+uom: 2 x 40m³', () => {
    const lines = [
      { volume: 40, volume_uom: 'M3' },
      { volume: 40, volume_uom: 'M3' },
    ];
    expect(formatPackaging(lines)).toBe('2 x 40m³');
  });

  it('keeps different volumes separate: 1 x 40m³, 1 x 60m³', () => {
    const lines = [
      { volume: 40, volume_uom: 'M3' },
      { volume: 60, volume_uom: 'M3' },
    ];
    expect(formatPackaging(lines)).toBe('1 x 40m³, 1 x 60m³');
  });

  it('mixes M3 and L: 2 x 40m³, 3 x 200L', () => {
    const lines = [
      { volume: 40, volume_uom: 'M3' },
      { volume: 40, volume_uom: 'M3' },
      { volume: 200, volume_uom: 'L' },
      { volume: 200, volume_uom: 'L' },
      { volume: 200, volume_uom: 'L' },
    ];
    expect(formatPackaging(lines)).toBe('2 x 40m³, 3 x 200L');
  });

  it('ignores container_type in grouping', () => {
    const lines = [
      { volume: 40, volume_uom: 'M3', container_type: 'OPEN_TOP' },
      { volume: 40, volume_uom: 'M3', container_type: 'CLOSED_TOP' },
    ];
    expect(formatPackaging(lines)).toBe('2 x 40m³');
  });

  it('returns empty string for no lines', () => {
    expect(formatPackaging([])).toBe('');
    expect(formatPackaging(undefined)).toBe('');
  });

  it('sorts by uom asc then volume asc: M3 before L; smaller before larger', () => {
    const lines = [
      { volume: 500, volume_uom: 'L' },
      { volume: 60, volume_uom: 'M3' },
      { volume: 200, volume_uom: 'L' },
      { volume: 40, volume_uom: 'M3' },
    ];
    expect(formatPackaging(lines)).toBe('1 x 40m³, 1 x 60m³, 1 x 200L, 1 x 500L');
  });
});
```

- [ ] **Step 2: Run test, confirm failure (old impl still uses parcels)**

Run: `cd server && npx vitest run src/__tests__/begeleidingsbriefPackaging.test.js`
Expected: FAIL — old `formatPackaging` returns parcel-style groupings.

- [ ] **Step 3: Rewrite `formatPackaging`**

Replace lines 9–19 of `begeleidingsbriefService.js`:

```js
const UOM_SYMBOL = { M3: 'm³', L: 'L' };
const UOM_ORDER = { M3: 0, L: 1 };

function formatPackaging(lines) {
  if (!lines || lines.length === 0) return '';
  const groups = new Map();
  for (const l of lines) {
    const key = `${l.volume_uom}|${Number(l.volume)}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  const entries = Array.from(groups.entries()).map(([key, count]) => {
    const [uom, volume] = key.split('|');
    return { uom, volume: Number(volume), count };
  });
  entries.sort((a, b) => (UOM_ORDER[a.uom] - UOM_ORDER[b.uom]) || (a.volume - b.volume));
  return entries
    .map((e) => `${e.count} x ${e.volume}${UOM_SYMBOL[e.uom]}`)
    .join(', ');
}
```

- [ ] **Step 4: Run test, confirm pass**

Run: `cd server && npx vitest run src/__tests__/begeleidingsbriefPackaging.test.js`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/begeleidingsbriefService.js server/src/__tests__/begeleidingsbriefPackaging.test.js
git commit -m "refactor(bgl): formatPackaging groups outbound lines by (uom, volume)"
```

---

### Task 8: Rewire `mapBegeleidingsbrief` to read lines

**Files:**
- Modify: `server/src/services/begeleidingsbriefService.js`

- [ ] **Step 1: Change `include` block (around line 49)**

Locate:
```js
parcels: { include: { material: true } },
```

Replace with:
```js
lines: { include: { material: true } },
```

- [ ] **Step 2: Replace `materialParcels` logic (around line 148)**

Find:
```js
const materialParcels = outbound.parcels.filter(
  (p) => p.material_id === ws.material_id,
);
```

Replace with:
```js
const materialLines = (outbound.lines || []).filter(
  (l) => l.material_id === ws.material_id,
);
```

- [ ] **Step 3: Update the call site**

Find `packaging: formatPackaging(materialParcels),` and replace with:
```js
packaging: formatPackaging(materialLines),
```

- [ ] **Step 4: Manual verification — start dev server and generate a BGL**

Run in one terminal: `cd server && npm run dev`
In another: seed one outbound to WEIGHED status with a couple of lines via the API, then:

```bash
curl -X POST http://localhost:3001/api/outbounds/<id>/bgl -H "Cookie: <auth>"
```

Expected: 200 with `documents` array containing a BEGELEIDINGSBRIEF entry.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/begeleidingsbriefService.js
git commit -m "refactor(bgl): mapBegeleidingsbrief sources packaging from outbound lines"
```

---

## Phase 5 — Outbound service integration

### Task 9: Require ≥1 line for LOADING → WEIGHED

**Files:**
- Modify: `server/src/services/outboundService.js`
- Modify: `server/src/__tests__/outbounds.test.js`

- [ ] **Step 1: Write failing test**

Append to `outbounds.test.js`:

```js
it('blocks WEIGHED transition when outbound has no lines', async () => {
  const auth = await getAuthHeader('GATE_OPERATOR');
  const outbound = await createOutboundInStatus('LOADING'); // existing helper or adapt
  // Ensure no lines
  await prisma.outboundLine.deleteMany({ where: { outbound_id: outbound.id } });
  const res = await request(app)
    .post(`/api/outbounds/${outbound.id}/weighings`)
    .set(auth)
    .send({ weighingType: 'GROSS', source: 'MANUAL', weightKg: 5000 });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/at least one line/i);
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `cd server && npx vitest run src/__tests__/outbounds.test.js -t "no lines"`
Expected: FAIL — transition succeeds.

- [ ] **Step 3: Locate `recordWeighing` in `outboundService.js` — add guard before status transition to WEIGHED**

Inside `recordWeighing`, before the `tx.outbound.update({ status: 'WEIGHED' })` call:

```js
if (nextStatus === 'WEIGHED') {
  const count = await tx.outboundLine.count({ where: { outbound_id: outboundId } });
  if (count === 0) {
    const err = new Error('Outbound must have at least one line before weighing');
    err.statusCode = 400;
    throw err;
  }
}
```

(Adjust variable name `nextStatus` to match the surrounding code's existing name.)

- [ ] **Step 4: Run test, confirm pass**

Run: `cd server && npx vitest run src/__tests__/outbounds.test.js -t "no lines"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/outboundService.js server/src/__tests__/outbounds.test.js
git commit -m "feat(outbound): require ≥1 line before WEIGHED"
```

---

### Task 10: Remove parcel SHIPPED bulk-transition from `confirmDeparture`

**Files:**
- Modify: `server/src/services/outboundService.js`

- [ ] **Step 1: Locate parcel bulk-update inside `confirmDeparture` (around line 482)**

Run: `grep -n "SHIPPED" server/src/services/outboundService.js`

- [ ] **Step 2: Remove the block that sets parcels to SHIPPED**

Delete any block resembling:
```js
await tx.outboundParcel.updateMany({
  where: { outbound_id: outboundId },
  data: { status: 'SHIPPED' },
});
```

- [ ] **Step 3: Run outbounds tests to verify nothing else depends on it**

Run: `cd server && npx vitest run src/__tests__/outbounds.test.js`
Expected: most pass; parcel-specific assertions may fail — mark them for Task 15 cleanup.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/outboundService.js
git commit -m "refactor(outbound): drop parcel SHIPPED bulk-transition in confirmDeparture"
```

---

## Phase 6 — Client: API wrapper

### Task 11: `client/src/api/outboundLines.js`

**Files:**
- Create: `client/src/api/outboundLines.js`

- [ ] **Step 1: Write the API module**

```js
import api from './axios';

export const listOutboundLines = (outboundId) =>
  api.get(`/outbounds/${outboundId}/lines`);

export const createOutboundLine = (outboundId, payload) =>
  api.post(`/outbounds/${outboundId}/lines`, payload);

export const updateOutboundLine = (outboundId, lineId, payload) =>
  api.put(`/outbounds/${outboundId}/lines/${lineId}`, payload);

export const deleteOutboundLine = (outboundId, lineId) =>
  api.delete(`/outbounds/${outboundId}/lines/${lineId}`);
```

(If the project uses a different axios import path, match the existing pattern in `client/src/api/parcels.js`.)

- [ ] **Step 2: Commit**

```bash
git add client/src/api/outboundLines.js
git commit -m "feat(client): outboundLines API wrapper"
```

---

## Phase 7 — Client: OutboundDetailPage refactor

### Task 12: Replace parcel panel with lines table

**Files:**
- Modify: `client/src/pages/outbounds/OutboundDetailPage.jsx`
- Create: `client/src/i18n/en/outboundLines.json`
- Create: `client/src/i18n/nl/outboundLines.json`
- Modify: `client/src/i18n/index.js`

- [ ] **Step 1: Create i18n files**

`client/src/i18n/en/outboundLines.json`:
```json
{
  "title": "Lines",
  "empty": "No lines yet. Add at least one line before weighing.",
  "addLine": "Add Line",
  "save": "Save",
  "cancel": "Cancel",
  "fields": {
    "material": "Material",
    "containerType": "Container Type",
    "volume": "Volume",
    "uom": "Unit"
  },
  "actions": {
    "edit": "Edit",
    "delete": "Delete"
  },
  "toast": {
    "created": "Line added",
    "updated": "Line updated",
    "deleted": "Line removed",
    "loadFailed": "Failed to load lines",
    "saveFailed": "Failed to save line",
    "deleteFailed": "Failed to remove line"
  },
  "confirmDelete": "Remove this line?",
  "totals": "{{count}} lines"
}
```

`client/src/i18n/nl/outboundLines.json`: same shape in Dutch (translate key phrases: title="Regels", empty="Nog geen regels...", etc. — follow existing NL tone in other files).

- [ ] **Step 2: Register namespace**

In `client/src/i18n/index.js`:

```js
import outboundLinesEN from './en/outboundLines.json';
import outboundLinesNL from './nl/outboundLines.json';
// ... inside the resources object:
en: { ..., outboundLines: outboundLinesEN, ... },
nl: { ..., outboundLines: outboundLinesNL, ... },
```

- [ ] **Step 3: Replace parcel UI inside `OutboundDetailPage.jsx`**

Key changes:
- Remove imports from `../../api/parcels` for outgoing parcel functions.
- Add `import { listOutboundLines, createOutboundLine, updateOutboundLine, deleteOutboundLine } from '../../api/outboundLines';`
- Replace the entire Parcels section with a Lines table component (inline, same file for MVP).
- State: `const [lines, setLines] = useState([]); const [editingLine, setEditingLine] = useState(null); const [showAddRow, setShowAddRow] = useState(false);`
- `const canMutateLines = ['CREATED', 'LOADING'].includes(outbound.status);`

Lines section skeleton:

```jsx
<section className="bg-white rounded-lg shadow p-5 mt-4">
  <header className="flex items-center justify-between mb-3">
    <h2 className="text-lg font-semibold">{t('outboundLines:title')}</h2>
    {canMutateLines && (
      <button
        type="button"
        className="px-3 py-1.5 rounded-md bg-green-700 text-white text-sm hover:bg-green-800"
        onClick={() => setShowAddRow(true)}
      >
        + {t('outboundLines:addLine')}
      </button>
    )}
  </header>

  {lines.length === 0 && !showAddRow ? (
    <p className="text-sm text-grey-500">{t('outboundLines:empty')}</p>
  ) : (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-grey-600 border-b">
          <th className="py-2">{t('outboundLines:fields.material')}</th>
          <th className="py-2">{t('outboundLines:fields.containerType')}</th>
          <th className="py-2">{t('outboundLines:fields.volume')}</th>
          <th className="py-2">{t('outboundLines:fields.uom')}</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          editingLine?.id === line.id
            ? <LineEditRow key={line.id} line={line} onCancel={() => setEditingLine(null)} onSave={handleSaveEdit} materials={materials} />
            : <LineViewRow key={line.id} line={line} canMutate={canMutateLines} onEdit={() => setEditingLine(line)} onDelete={() => handleDelete(line.id)} t={t} />
        ))}
        {showAddRow && <LineEditRow line={null} onCancel={() => setShowAddRow(false)} onSave={handleCreate} materials={materials} />}
      </tbody>
    </table>
  )}
</section>
```

Define `LineViewRow` and `LineEditRow` as local components. `LineEditRow` renders 4 inputs (material dropdown, container_type dropdown, volume input, uom dropdown) + Save/Cancel.

Handlers:

```js
const fetchLines = useCallback(async () => {
  const { data } = await listOutboundLines(outboundId);
  setLines(data.data || []);
}, [outboundId]);

useEffect(() => { if (outboundId) fetchLines(); }, [outboundId, fetchLines]);

const handleCreate = async (payload) => {
  try {
    await createOutboundLine(outboundId, payload);
    toast.success(t('outboundLines:toast.created'));
    setShowAddRow(false);
    await fetchLines();
  } catch (err) {
    toast.error(err.response?.data?.error || t('outboundLines:toast.saveFailed'));
  }
};

const handleSaveEdit = async (payload) => {
  try {
    await updateOutboundLine(outboundId, editingLine.id, payload);
    toast.success(t('outboundLines:toast.updated'));
    setEditingLine(null);
    await fetchLines();
  } catch (err) {
    toast.error(err.response?.data?.error || t('outboundLines:toast.saveFailed'));
  }
};

const handleDelete = async (lineId) => {
  if (!window.confirm(t('outboundLines:confirmDelete'))) return;
  try {
    await deleteOutboundLine(outboundId, lineId);
    toast.success(t('outboundLines:toast.deleted'));
    await fetchLines();
  } catch (err) {
    toast.error(err.response?.data?.error || t('outboundLines:toast.deleteFailed'));
  }
};
```

Remove: all state/handlers for `showAttachPanel`, `availableParcels`, `selectedParcelIds`, `showInlineCreate`, `newParcel`, `attachParcelsToOutbound`, `detachParcelFromOutbound`, `createOutgoingParcel`, `listOutgoingParcels`.

- [ ] **Step 4: Manual verify in browser**

Run: `cd server && npm run dev` and `cd client && npm run dev`
- Navigate to an outbound in CREATED status
- Add a line (material, OPEN_TOP, 40, M3) → appears in table
- Edit the line → volume changes persist
- Delete the line → row removed
- Advance outbound to WEIGHED → table becomes read-only (no Add button)

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/outbounds/OutboundDetailPage.jsx client/src/i18n/
git commit -m "feat(client): outbound detail shows lines table; drop parcel panel"
```

---

## Phase 8 — Client cleanup: remove outgoing parcel code

### Task 13: Remove outgoing parcel pages + routes

**Files:**
- Delete: `client/src/pages/parcels/OutgoingParcelCreatePage.jsx`
- Delete: `client/src/pages/parcels/OutgoingParcelDetailPage.jsx`
- Delete any matching `__tests__/Outgoing*.test.jsx`
- Modify: `client/src/App.jsx`
- Modify: `client/src/pages/parcels/ParcelsPage.jsx`
- Modify: `client/src/api/parcels.js`

- [ ] **Step 1: Delete outgoing parcel page files**

```bash
rm -f client/src/pages/parcels/OutgoingParcelCreatePage.jsx
rm -f client/src/pages/parcels/OutgoingParcelDetailPage.jsx
rm -rf client/src/pages/parcels/__tests__/OutgoingParcel*.test.jsx
```

- [ ] **Step 2: Remove outgoing parcel routes from App.jsx**

Locate in `client/src/App.jsx`:
```jsx
<Route path="/parcels/outgoing/new" element={...} />
<Route path="/parcels/outgoing/:id" element={...} />
```

Delete both lines plus the corresponding imports at the top:
```jsx
import OutgoingParcelCreatePage from './pages/parcels/OutgoingParcelCreatePage';
import OutgoingParcelDetailPage from './pages/parcels/OutgoingParcelDetailPage';
```

- [ ] **Step 3: Update ParcelsPage — remove Outgoing tab**

In `client/src/pages/parcels/ParcelsPage.jsx`:
- Remove the tab-switching UI
- Hard-code incoming parcel rendering only
- Remove any `listOutgoingParcels` imports/calls
- Rename page title if needed to "Incoming Parcels"

- [ ] **Step 4: Remove outgoing functions from `api/parcels.js`**

Delete: `listOutgoingParcels`, `getOutgoingParcel`, `createOutgoingParcel`, `updateOutgoingParcel`, `deleteOutgoingParcel`, `listOutboundParcels`, `attachParcelsToOutbound`, `detachParcelFromOutbound`.

- [ ] **Step 4b: Delete outboundParcels i18n files and unregister namespace**

```bash
rm -f client/src/i18n/en/outboundParcels.json client/src/i18n/nl/outboundParcels.json
```

Open `client/src/i18n/index.js` and remove:
```js
import outboundParcelsEN from './en/outboundParcels.json';
import outboundParcelsNL from './nl/outboundParcels.json';
```
and the `outboundParcels: outboundParcelsEN` / `outboundParcels: outboundParcelsNL` entries.

- [ ] **Step 5: Update client test files affected by removals**

Run: `cd client && grep -rn "OutgoingParcel\|listOutgoingParcels\|attachParcelsToOutbound" src/`

For each match in test files, either delete the test or refactor to lines equivalent.

- [ ] **Step 6: Verify client builds and tests pass**

Run: `cd client && npm test -- --run`
Expected: all tests pass.

Run: `cd client && npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A client/
git commit -m "refactor(client): remove OutgoingParcel UI and API"
```

---

## Phase 9 — Server cleanup: remove outbound parcel code

### Task 14: Delete parcel service/controller/routes/utils/tests

**Files:**
- Delete: `server/src/services/outboundParcelService.js`
- Delete: `server/src/controllers/outboundParcelController.js`
- Delete: `server/src/routes/outboundParcels.js`
- Delete: `server/src/utils/outboundParcelNumber.js`
- Delete: `server/src/__tests__/outboundParcels.test.js`
- Modify: `server/src/index.js`
- Modify: `server/src/routes/outbounds.js` (remove nested parcel routes)
- Modify: `server/src/__tests__/outbounds.test.js` (remove parcel fixtures/assertions)

- [ ] **Step 1: Delete the files**

```bash
rm -f server/src/services/outboundParcelService.js
rm -f server/src/controllers/outboundParcelController.js
rm -f server/src/routes/outboundParcels.js
rm -f server/src/utils/outboundParcelNumber.js
rm -f server/src/__tests__/outboundParcels.test.js
```

- [ ] **Step 2: Remove route registration in `server/src/index.js`**

Run: `grep -n "outbound-parcels\|outboundParcels" server/src/index.js`

Delete the `require('./routes/outboundParcels')` line and the `app.use('/api/outbound-parcels', ...)` line.

- [ ] **Step 3: Remove nested parcel routes from `server/src/routes/outbounds.js`**

Delete any routes mounted at `/:id/parcels` and the controller import if unused.

- [ ] **Step 3b: Clean parcel references from `outboundService.js`**

Run: `grep -n "parcel" server/src/services/outboundService.js`

For every include like `parcels: { include: { material: true } }`, replace with:
```js
lines: { include: { material: true } },
```

Remove any standalone parcel fetch/update logic. Leave line-based logic intact.

- [ ] **Step 4: Update `outbounds.test.js`**

Remove all `outboundParcel.create`, `attachParcelsToOutbound`, and SHIPPED-status assertions. Replace parcel fixture setup with line fixtures where the test still makes sense (e.g., BGL generation tests need lines to produce packaging output).

- [ ] **Step 5: Run the full server test suite**

Run: `cd server && npm test`
Expected: all tests pass. Any residual parcel reference will surface as a require-error; fix immediately.

- [ ] **Step 6: Commit**

```bash
git add -A server/
git commit -m "refactor(server): remove OutboundParcel service/controller/routes/tests"
```

---

## Phase 10 — Prisma final cleanup

### Task 15: Drop `OutboundParcel` model, enum, and table

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: new migration file

- [ ] **Step 1: Remove from schema**

Delete `model OutboundParcel { ... }` block.
Delete `enum OutboundParcelStatus { ... }` block.
Remove `parcels: OutboundParcel[]` relation on `Outbound` model.
Remove any reverse relation entry on `MaterialMaster` referencing `OutboundParcel`.

- [ ] **Step 2: Create migration**

```bash
cd server && mkdir -p prisma/migrations/$(date -u +%Y%m%d%H%M%S)_drop_outbound_parcels
```

Create the `migration.sql`:
```sql
-- DropForeignKey
ALTER TABLE "outbound_parcels" DROP CONSTRAINT IF EXISTS "outbound_parcels_outbound_id_fkey";
ALTER TABLE "outbound_parcels" DROP CONSTRAINT IF EXISTS "outbound_parcels_material_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "outbound_parcels";

-- DropEnum
DROP TYPE IF EXISTS "OutboundParcelStatus";
```

- [ ] **Step 3: Apply and regenerate**

Run: `cd server && npx prisma db push --skip-generate && npx prisma generate`
Expected: schema in sync; client regenerated.

- [ ] **Step 4: Verify table is gone**

Run: `cd server && psql $DATABASE_URL -c '\d outbound_parcels'`
Expected: `Did not find any relation named "outbound_parcels".`

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "refactor(schema): drop OutboundParcel model and table"
```

---

## Phase 11 — Seeds & E2E

### Task 16: Seed representative lines

**Files:**
- Modify: `server/prisma/seed.js`

- [ ] **Step 1: Locate the outbound seed section**

Run: `grep -n "outbound\." server/prisma/seed.js | head`

- [ ] **Step 2: After each seeded outbound creation, add lines**

For at least two of the seeded outbounds (one in LOADING, one in WEIGHED), insert 2-4 lines per outbound covering both UoM values. Example:

```js
await prisma.outboundLine.createMany({
  data: [
    { outbound_id: outbound1.id, material_id: materialA.id, container_type: 'OPEN_TOP', volume: 40, volume_uom: 'M3' },
    { outbound_id: outbound1.id, material_id: materialA.id, container_type: 'OPEN_TOP', volume: 40, volume_uom: 'M3' },
    { outbound_id: outbound1.id, material_id: materialB.id, container_type: 'CLOSED_TOP', volume: 60, volume_uom: 'M3' },
  ],
});
await prisma.outboundLine.createMany({
  data: [
    { outbound_id: outbound2.id, material_id: materialA.id, container_type: 'PALLET', volume: 200, volume_uom: 'L' },
    { outbound_id: outbound2.id, material_id: materialA.id, container_type: 'PALLET', volume: 200, volume_uom: 'L' },
    { outbound_id: outbound2.id, material_id: materialA.id, container_type: 'PALLET', volume: 200, volume_uom: 'L' },
  ],
});
```

Adjust to the seed script's actual variable names.

- [ ] **Step 3: Re-run seed against a fresh dev DB**

Run: `cd server && node prisma/seed.js`
Expected: seed completes without error; lines visible in Prisma Studio.

- [ ] **Step 4: Commit**

```bash
git add server/prisma/seed.js
git commit -m "chore(seed): add representative outbound lines"
```

---

### Task 17: Update E2E tests

**Files:**
- Modify: `client/src/__tests__/e2e/outbound-lifecycle.e2e.playwright.js`
- Modify: `client/src/__tests__/e2e/outbound-detail.e2e.playwright.js`

- [ ] **Step 1: Open lifecycle test and locate parcel steps**

Run: `grep -n "parcel\|Parcel" client/src/__tests__/e2e/outbound-lifecycle.e2e.playwright.js`

- [ ] **Step 2: Replace parcel attach steps with line add steps**

For each previous "click Attach → select parcel → confirm" block, replace with:
```js
await page.getByRole('button', { name: /add line/i }).click();
await page.getByLabel(/material/i).selectOption({ label: 'Material A' });
await page.getByLabel(/container type/i).selectOption('OPEN_TOP');
await page.getByLabel(/^volume$/i).fill('40');
await page.getByLabel(/unit/i).selectOption('M3');
await page.getByRole('button', { name: /save/i }).click();
await expect(page.getByText('40m³')).toBeVisible();
```

- [ ] **Step 3: Delete any `parcels.e2e.playwright.js` file's outgoing-parcel cases**

Run: `grep -l "OutgoingParcel" client/src/__tests__/e2e/`
If a dedicated outgoing test file exists, delete it.

- [ ] **Step 4: Run E2E suite**

Run: `cd client && npm run test:e2e`
Expected: all outbound E2E tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/__tests__/e2e/
git commit -m "test(e2e): outbound lifecycle uses lines instead of parcels"
```

---

## Phase 12 — Final verification

### Task 18: Full-stack verification

- [ ] **Step 1: Server test suite**

Run: `cd server && npm test`
Expected: all tests pass, 0 failures.

- [ ] **Step 2: Client test suite**

Run: `cd client && npm test -- --run`
Expected: all tests pass.

- [ ] **Step 3: Client build**

Run: `cd client && npm run build`
Expected: successful production build.

- [ ] **Step 4: Lint (if configured)**

Run: `cd server && npm run lint 2>/dev/null || true`
Run: `cd client && npm run lint 2>/dev/null || true`
Expected: no lint errors.

- [ ] **Step 5: Manual E2E smoke test**

Run dev servers and walk the full flow:
1. Log in as ADMIN
2. Create an outbound order with 2 waste streams (material A, material B)
3. Create an outbound from it
4. Add 3 lines: 2×(A, 40, M3), 1×(B, 60, M3)
5. Record TARE and GROSS weighings
6. Generate BGL → download → verify packaging column shows `2 x 40m³` for material A row and `1 x 60m³` for material B row
7. Confirm departure + delivery

- [ ] **Step 6: Final commit / tag**

```bash
git log --oneline -20
git status
```

Confirm clean working tree and log reflects all phases.

---

## Notes for the executor

- **Shadow DB is broken** (memory #923/#927): use `npx prisma db push` for all migration application steps. Still commit the raw `.sql` migration files so the migrate history stays legible.
- **Audit log**: `writeAuditLog(tx, { ... })` signature — match exactly what other services use. If the existing helper's signature differs, adapt rather than change the helper.
- **Never mock the database in integration tests** (memory feedback rule #1 equivalent in this project): these tests hit real Prisma.
- **Test data hygiene** (feedback rule #3): every test must clean up its fixtures in `afterAll`. Use realistic names (e.g., `linetest@statice.test`), not `TEST_FEE_123`-style placeholders.
- **PRD terminology** (feedback rule #4): new user-facing strings should use "Lines" in English, "Regels" in Dutch — match PRD if it specifies something different.
- **Cross-tab consistency** (feedback rule #1 UI): the Lines table should visually mirror the Inbound detail page's inline row pattern — same padding `py-3`, same em-dash `—` for empty values, same status rules.
- **Currency** (feedback rule #6): no currency fields in this refactor; none to worry about.
- **Atomic commits**: each Task ends with a commit — don't batch.
