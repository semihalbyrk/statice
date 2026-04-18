# Begeleidingsbrief AcroForm Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PDFKit-based Begeleidingsbrief renderer with `pdf-lib` AcroForm field filling against the official Dutch waste transport form, fixing all section mapping gaps (3B DisposerSite, 4B receiver, per-material packaging, two weight columns, role checkboxes).

**Architecture:** Two-file pipeline stays: `begeleidingsbriefService.js` maps DB data → flat `mappedData` object; `begeleidingsbriefGenerator.js` fills 120 named AcroForm fields in the official PDF template. The `outboundService.generateBgl()` wiring, `OutboundDocument` tracking, route, and download endpoint are unchanged.

**Tech Stack:** pdf-lib (new), Prisma, Vitest + Supertest (existing test framework)

**Spec:** `docs/superpowers/specs/2026-04-18-begeleidingsbrief-acroform-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `server/prisma/schema.prisma` | Modify | Add `disposer_site` relation on OutboundOrder + back-ref on DisposerSite |
| `server/package.json` | Modify | Add `pdf-lib` dependency |
| `server/src/assets/begeleidingsbrief-template.pdf` | Create | Official AcroForm template (copied from docs/) |
| `server/src/services/begeleidingsbriefService.js` | Rewrite | DB fetch + data mapping → `mappedData` |
| `server/src/services/begeleidingsbriefGenerator.js` | Rewrite | AcroForm field filling → PDF file on disk |
| `server/src/__tests__/outbounds.test.js` | Modify | Add file-existence assertion to BGL describe block |

---

## Task 1: Add disposer_site Prisma relation

`OutboundOrder.disposer_site_id` already exists as a DB column but has no Prisma relation, so it cannot be included in queries. We add the annotation-only relation — no migration needed.

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add relation to OutboundOrder model**

In `schema.prisma`, the `OutboundOrder` model currently ends at line ~1194. Add the `disposer_site` relation line directly after `outsourced_transporter`:

```prisma
// BEFORE (lines ~1188-1192):
  outsourced_transporter  Entity?             @relation("OutboundOrderOutsourcedTransporter", fields: [outsourced_transporter_id], references: [id])
  created_by_user         User                @relation(fields: [created_by], references: [id])

// AFTER — insert disposer_site between outsourced_transporter and created_by_user:
  outsourced_transporter  Entity?             @relation("OutboundOrderOutsourcedTransporter", fields: [outsourced_transporter_id], references: [id])
  disposer_site           DisposerSite?       @relation("OutboundOrderDisposerSite", fields: [disposer_site_id], references: [id])
  created_by_user         User                @relation(fields: [created_by], references: [id])
```

- [ ] **Step 2: Add back-reference to DisposerSite model**

The `DisposerSite` model (lines ~352-367) currently has `entity` and `contracts` relations. Add the back-reference:

```prisma
// BEFORE:
  entity    Entity             @relation(fields: [entity_id], references: [id])
  contracts SupplierContract[] @relation("ContractDisposerSite")
}

// AFTER:
  entity          Entity             @relation(fields: [entity_id], references: [id])
  contracts       SupplierContract[] @relation("ContractDisposerSite")
  outbound_orders OutboundOrder[]    @relation("OutboundOrderDisposerSite")
}
```

- [ ] **Step 3: Run prisma generate**

```bash
cd server && npx prisma generate
```

Expected output ends with: `✔ Generated Prisma Client`  
No migration file is created because the DB column already exists.

- [ ] **Step 4: Commit**

```bash
cd server && git add prisma/schema.prisma && git commit -m "feat: add disposer_site relation on OutboundOrder"
```

---

## Task 2: Install pdf-lib and copy template

**Files:**
- Modify: `server/package.json`
- Create: `server/src/assets/begeleidingsbrief-template.pdf`

- [ ] **Step 1: Install pdf-lib**

```bash
cd server && npm install pdf-lib
```

Expected: `added 1 package` (pdf-lib has no extra dependencies beyond its bundled dependencies).

- [ ] **Step 2: Create assets directory and copy template**

```bash
mkdir -p server/src/assets
cp "docs/Begeleidingsbrief/default_wtn_acro_form (1).pdf" server/src/assets/begeleidingsbrief-template.pdf
```

- [ ] **Step 3: Verify the template has 120 AcroForm fields**

```bash
python3 -c "
from pypdf import PdfReader
r = PdfReader('server/src/assets/begeleidingsbrief-template.pdf')
fields = r.get_fields()
print(f'Fields: {len(fields)}')
assert len(fields) == 120, f'Expected 120, got {len(fields)}'
print('OK')
"
```

Expected output: `Fields: 120` then `OK`.

- [ ] **Step 4: Commit**

```bash
git add server/package.json server/package-lock.json server/src/assets/begeleidingsbrief-template.pdf
git commit -m "feat: add pdf-lib and begeleidingsbrief AcroForm template"
```

---

## Task 3: Add PDF file-existence assertion to existing test

The existing `outbounds.test.js` BGL describe block verifies `documents[0].status === 'GENERATED'` but does not check the PDF file actually exists on disk. Add that assertion so we have a failing test that our new generator must satisfy.

**Files:**
- Modify: `server/src/__tests__/outbounds.test.js`

- [ ] **Step 1: Add `fs` import at top of test file**

Find the top of `outbounds.test.js` (around line 1-3). Add `fs` import:

```js
const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');
const fs = require('fs');  // ADD THIS LINE
```

- [ ] **Step 2: Extend the generate-bgl test to check file existence**

Find the `it('generates BGL for WEIGHED outbound → transitions to DOCUMENTS_READY'` block (around line 292). Extend the assertions:

```js
it('generates BGL for WEIGHED outbound → transitions to DOCUMENTS_READY', async () => {
  const res = await request(app)
    .post(`/api/outbounds/${weighedOutboundId}/generate-bgl`)
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  expect(res.body.data.status).toBe('DOCUMENTS_READY');
  expect(res.body.data.documents_ready_at).toBeTruthy();
  expect(res.body.data.documents).toBeDefined();
  expect(res.body.data.documents.length).toBeGreaterThan(0);

  const doc = res.body.data.documents[0];
  expect(doc.document_type).toBe('BEGELEIDINGSBRIEF');
  expect(doc.status).toBe('GENERATED');

  // ADD: verify the PDF file exists on disk
  expect(fs.existsSync(doc.storage_path)).toBe(true);
  // ADD: verify it's a real PDF (starts with %PDF)
  const header = Buffer.alloc(4);
  const fd = fs.openSync(doc.storage_path, 'r');
  fs.readSync(fd, header, 0, 4, 0);
  fs.closeSync(fd);
  expect(header.toString()).toBe('%PDF');
});
```

- [ ] **Step 3: Run the test to see current state**

```bash
cd server && npm test -- --reporter=verbose outbounds
```

The `generates BGL` test will either pass (if current generator writes a valid PDF) or fail on `fs.existsSync`. Note the result — this is the baseline before our rewrites.

---

## Task 4: Rewrite begeleidingsbriefService.js

Full rewrite of the data mapping service. Key changes vs current:
- Section 3B: use `order.disposer_site` (DisposerSite model, `site_name` field) with fallback to disposer
- Section 4B: use `order.waste_streams[0].receiver` instead of `order.buyer`
- `wasteLines`: per-material packaging (filter parcels by `material_id`), split `quantity` into separate `estimatedWeight` + `measuredWeight`
- Sender role flags: `isDisposer`, `isReceiver` added to sender object
- `invoiceEntity` (renamed from `invoice`), `originSite` (renamed from `origin`)

**Files:**
- Rewrite: `server/src/services/begeleidingsbriefService.js`

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `server/src/services/begeleidingsbriefService.js` with:

```js
const prisma = require('../utils/prismaClient');

// ── helpers ──────────────────────────────────────────────────────────

/**
 * Groups parcels (filtered to one material) by volume or container_type.
 * Returns e.g. "2 x 40m³" or "1 x OPEN_TOP, 2 x CLOSED_TOP"
 */
function formatPackaging(parcels) {
  if (!parcels || parcels.length === 0) return '';
  const groups = {};
  for (const p of parcels) {
    const key = p.volume_m3 ? `${Number(p.volume_m3)}m³` : p.container_type;
    groups[key] = (groups[key] || 0) + 1;
  }
  return Object.entries(groups)
    .map(([key, count]) => `${count} x ${key}`)
    .join(', ');
}

function formatDateNL(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

// ── main mapper ──────────────────────────────────────────────────────

async function mapBegeleidingsbrief(outboundId) {
  const outbound = await prisma.outbound.findUnique({
    where: { id: outboundId },
    include: {
      outbound_order: {
        include: {
          contract: { include: { invoice_entity: true } },
          sender: true,
          disposer: true,
          disposer_site: true,
          transporter: true,
          outsourced_transporter: true,
          waste_streams: {
            include: {
              waste_stream: true,
              receiver: true,
            },
          },
        },
      },
      parcels: { include: { material: true } },
    },
  });

  if (!outbound) throw new Error(`Outbound ${outboundId} not found`);

  const order = outbound.outbound_order;
  const contract = order.contract;

  // Fetch MaterialMaster (name + eural_code) for all waste stream materials
  const materialIds = order.waste_streams.map((ws) => ws.material_id).filter(Boolean);
  let materialsMap = {};
  if (materialIds.length > 0) {
    const materials = await prisma.materialMaster.findMany({
      where: { id: { in: materialIds } },
      select: { id: true, name: true, eural_code: true },
    });
    materialsMap = Object.fromEntries(materials.map((m) => [m.id, m]));
  }

  // Section 1 — Afzender (Sender)
  const sender = {
    name: order.sender.company_name,
    address: order.sender.street_and_number,
    postalCity: `${order.sender.postal_code} ${order.sender.city}`,
    vihb: order.sender.vihb_number || '',
    isDisposer: Boolean(order.sender.is_disposer),
    isReceiver: Boolean(order.sender.is_receiver),
  };

  // Section 2 — Factuuradres
  const invoiceEntity = contract.invoice_entity
    ? {
        name: contract.invoice_entity.company_name,
        street: contract.invoice_entity.street_and_number,
        postalCity: `${contract.invoice_entity.postal_code} ${contract.invoice_entity.city}`,
      }
    : null;

  // Section 3A — Ontdoener (Disposer)
  const disposer = {
    name: order.disposer.company_name,
    address: order.disposer.street_and_number,
    postalCity: `${order.disposer.postal_code} ${order.disposer.city}`,
  };

  // Section 3B — Locatie van herkomst (DisposerSite with fallback to disposer)
  const site = order.disposer_site;
  const originSite = site
    ? {
        name: site.site_name,
        address: site.street_and_number,
        postalCity: `${site.postal_code} ${site.city}`,
      }
    : {
        name: order.disposer.company_name,
        address: order.disposer.street_and_number,
        postalCity: `${order.disposer.postal_code} ${order.disposer.city}`,
      };

  // Section 4A — Uitbesteed vervoerder (only when set)
  const outsourcedTransporter = order.outsourced_transporter
    ? {
        name: order.outsourced_transporter.company_name,
        address: order.outsourced_transporter.street_and_number,
        postalCity: `${order.outsourced_transporter.postal_code} ${order.outsourced_transporter.city}`,
        vihb: order.outsourced_transporter.vihb_number || '',
      }
    : null;

  // Section 4B — Locatie van bestemming (receiver from first waste stream)
  const firstReceiver = order.waste_streams[0]?.receiver;
  const destination = firstReceiver
    ? {
        name: firstReceiver.company_name,
        address: firstReceiver.street_and_number,
        postalCity: `${firstReceiver.postal_code} ${firstReceiver.city}`,
      }
    : { name: '', address: '', postalCity: '' };

  // Section 5 — Vervoerder
  const transporter = {
    name: order.transporter.company_name,
    address: order.transporter.street_and_number,
    postalCity: `${order.transporter.postal_code} ${order.transporter.city}`,
    vihb: order.transporter.vihb_number || '',
  };

  // Section 6 — Waste lines (max 11 AcroForm rows)
  const isSingleStream = order.waste_streams.length === 1;
  const streams = order.waste_streams.slice(0, 11);

  const wasteLines = streams.map((ws) => {
    const material = materialsMap[ws.material_id];
    // Parcels belonging to this material only
    const materialParcels = outbound.parcels.filter(
      (p) => p.material_id === ws.material_id,
    );
    return {
      asn: ws.asn || '',
      materialName: material?.name || ws.waste_stream?.name || '',
      packaging: formatPackaging(materialParcels),
      euralCode: material?.eural_code || '',
      processingMethod: ws.processing_method || '',
      estimatedWeight:
        ws.planned_amount_kg != null ? String(Number(ws.planned_amount_kg)) : '',
      // measuredWeight only populated for single-stream outbounds
      measuredWeight:
        isSingleStream && outbound.net_weight_kg != null
          ? String(Number(outbound.net_weight_kg))
          : '',
    };
  });

  // Overflow note when order has more than 11 waste streams
  if (order.waste_streams.length > 11) {
    const overflow = order.waste_streams.length - 10;
    wasteLines[10].materialName = `+ ${overflow} more — see order ${order.order_number}`;
    wasteLines[10].asn = '';
  }

  return {
    documentNumber: outbound.outbound_number,
    sender,
    invoiceEntity,
    disposer,
    originSite,
    transportStartDate: formatDateNL(order.planned_date),
    outsourcedTransporter,
    destination,
    hasOutsourcedTransporter: Boolean(order.outsourced_transporter),
    transporter,
    vehiclePlate: outbound.vehicle_plate || order.vehicle_plate || '',
    wasteLines,
  };
}

module.exports = { mapBegeleidingsbrief, formatDateNL, formatPackaging };
```

- [ ] **Step 2: Verify the server still starts (no syntax errors)**

```bash
cd server && node -e "require('./src/services/begeleidingsbriefService.js'); console.log('OK')"
```

Expected: `OK`

---

## Task 5: Rewrite begeleidingsbriefGenerator.js

Full rewrite from PDFKit to pdf-lib AcroForm filling. Maintains the same function signature: `generateBegeleidingsbriefPDF(mappedData)` → returns `{ fileName, filePath, fileSize }`.

**Files:**
- Rewrite: `server/src/services/begeleidingsbriefGenerator.js`

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `server/src/services/begeleidingsbriefGenerator.js` with:

```js
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '../assets/begeleidingsbrief-template.pdf');
const OUTPUT_DIR = path.join(__dirname, '../../uploads/outbounds');

// ── field helpers ────────────────────────────────────────────────────

function setText(form, fieldName, value) {
  try {
    form.getTextField(fieldName).setText(value || '');
  } catch (_) {
    // Unknown field names are silently skipped
  }
}

function setCheckbox(form, fieldName, checked) {
  try {
    const cb = form.getCheckBox(fieldName);
    if (checked) {
      cb.check();
    } else {
      cb.uncheck();
    }
  } catch (_) {
    // Unknown field names are silently skipped
  }
}

// ── main generator ───────────────────────────────────────────────────

/**
 * Fills the official Begeleidingsbrief AcroForm PDF with mappedData
 * produced by begeleidingsbriefService.mapBegeleidingsbrief().
 *
 * @param {object} mappedData - Output of mapBegeleidingsbrief()
 * @returns {{ fileName: string, filePath: string, fileSize: number }}
 */
async function generateBegeleidingsbriefPDF(mappedData) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // ── Section 1: Afzender (Sender) ────────────────────────────────
  setCheckbox(form, 'role_selection-waste_producer', mappedData.sender.isDisposer);
  setCheckbox(form, 'role_selection-receiver', mappedData.sender.isReceiver);
  setCheckbox(form, 'role_selection-trader', false);
  setCheckbox(form, 'role_selection-intermediary', false);
  setText(form, 'sender_name', mappedData.sender.name);
  setText(form, 'sender_address', mappedData.sender.address);
  setText(form, 'sender_postal_city', mappedData.sender.postalCity);
  setText(form, 'sender_vihb', mappedData.sender.vihb);

  // ── Section 2: Factuuradres (Invoice address) ────────────────────
  if (mappedData.invoiceEntity) {
    setText(form, 'invoice_address', mappedData.invoiceEntity.name);
    setText(form, 'invoice_pobox_street', mappedData.invoiceEntity.street);
    setText(form, 'invoice_postal_city', mappedData.invoiceEntity.postalCity);
  }

  // ── Section 3A: Ontdoener (Disposer) ────────────────────────────
  setText(form, 'waste_producer', mappedData.disposer.name);
  setText(form, 'waste_producer_address', mappedData.disposer.address);
  setText(form, 'waste_producer_postal_city', mappedData.disposer.postalCity);

  // ── Section 3B: Locatie van herkomst (Origin site) ──────────────
  setText(form, 'waste_origin_location', mappedData.originSite.name);
  setText(form, 'waste_origin_address', mappedData.originSite.address);
  setText(form, 'waste_origin_postal_city', mappedData.originSite.postalCity);
  setText(form, 'transport_start_date', mappedData.transportStartDate);

  // ── Section 4A: Uitbesteed vervoerder (conditional) ─────────────
  if (mappedData.outsourcedTransporter) {
    setText(form, 'contracted_transporter', mappedData.outsourcedTransporter.name);
    setText(form, 'contracted_transporter_address', mappedData.outsourcedTransporter.address);
    setText(form, 'contracted_transporter_postal_city', mappedData.outsourcedTransporter.postalCity);
    setText(form, 'contracted_transporter_vihb', mappedData.outsourcedTransporter.vihb);
  }

  // ── Section 4B: Locatie van bestemming (Destination) ────────────
  setText(form, 'destination_location', mappedData.destination.name);
  setText(form, 'destination_address', mappedData.destination.address);
  setText(form, 'destination_postal_city', mappedData.destination.postalCity);

  // ── Section 5: Vervoerder (Transporter) ─────────────────────────
  // Uncheck all transported-by options first, then check the correct one
  setCheckbox(form, 'transported_by-sender', false);
  setCheckbox(form, 'transported_by-waste_producer', false);
  setCheckbox(form, 'transported_by-receiver', false);
  setCheckbox(form, 'transported_by-collector', false);
  setCheckbox(form, 'transported_by-transporter', !mappedData.hasOutsourcedTransporter);
  setCheckbox(form, 'transported_by-contracted_transporter', mappedData.hasOutsourcedTransporter);

  setText(form, 'receiver_details', mappedData.transporter.name);
  setText(form, 'receiver_address', mappedData.transporter.address);
  setText(form, 'receiver_postal_city', mappedData.transporter.postalCity);
  setText(form, 'receiver_vihb', mappedData.transporter.vihb);
  setText(form, 'license_plate', mappedData.vehiclePlate);

  // Hardcoded NEE per spec
  setCheckbox(form, 'route_collection-yes', false);
  setCheckbox(form, 'route_collection-no', true);
  setCheckbox(form, 'collector_regulation-yes', false);
  setCheckbox(form, 'collector_regulation-no', true);
  setCheckbox(form, 'repetitive_shipments-yes', false);
  setCheckbox(form, 'repetitive_shipments-no', true);

  // ── Section 6: Waste lines (1 row per waste stream, max 11) ─────
  mappedData.wasteLines.forEach((line, idx) => {
    const i = idx + 1; // form fields are 1-indexed
    setText(form, `waste_stream_number-${i}`, line.asn);
    setText(form, `waste_name-${i}`, line.materialName);
    setText(form, `waste_packaging-${i}`, line.packaging);
    setText(form, `eural_code-${i}`, line.euralCode);
    setText(form, `processing_method-${i}`, line.processingMethod);
    setText(form, `estimated_weight-${i}`, line.estimatedWeight);
    setText(form, `measured_weight-${i}`, line.measuredWeight);
  });

  // Flatten so fields are read-only in the final document
  form.flatten();

  const pdfBytes = await pdfDoc.save();
  const fileName = `begeleidingsbrief_${mappedData.documentNumber}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, pdfBytes);

  return {
    fileName,
    filePath,
    fileSize: fs.statSync(filePath).size,
  };
}

module.exports = { generateBegeleidingsbriefPDF };
```

- [ ] **Step 2: Verify no syntax errors**

```bash
cd server && node -e "require('./src/services/begeleidingsbriefGenerator.js'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Smoke-test PDF generation with a minimal fixture**

```bash
cd server && node -e "
const { generateBegeleidingsbriefPDF } = require('./src/services/begeleidingsbriefGenerator');
const data = {
  documentNumber: 'SMOKE-TEST-001',
  sender: { name: 'Statice B.V.', address: 'Industrieweg 1', postalCity: '3000 AA Rotterdam', vihb: 'VIHB-001', isDisposer: true, isReceiver: false },
  invoiceEntity: null,
  disposer: { name: 'Statice B.V.', address: 'Industrieweg 1', postalCity: '3000 AA Rotterdam' },
  originSite: { name: 'Statice Site A', address: 'Industrieweg 1', postalCity: '3000 AA Rotterdam' },
  transportStartDate: '01-05-2026',
  outsourcedTransporter: null,
  destination: { name: 'RecycleNL B.V.', address: 'Havenlaan 10', postalCity: '4000 BB Amsterdam' },
  hasOutsourcedTransporter: false,
  transporter: { name: 'Transport BV', address: 'Wegtransport 5', postalCity: '2000 CC Den Haag', vihb: 'VIHB-002' },
  vehiclePlate: 'NL-TEST-01',
  wasteLines: [{
    asn: '4001234567890',
    materialName: 'LCD Monitors',
    packaging: '2 x 40m\u00b3',
    euralCode: '16 02 13',
    processingMethod: 'R4',
    estimatedWeight: '5000',
    measuredWeight: '4920',
  }],
};
generateBegeleidingsbriefPDF(data).then(r => {
  const fs = require('fs');
  console.log('File:', r.fileName, 'Size:', r.fileSize, 'bytes');
  const buf = fs.readFileSync(r.filePath);
  console.log('PDF header:', buf.slice(0, 4).toString());
  // cleanup
  fs.unlinkSync(r.filePath);
  console.log('Smoke test PASSED');
}).catch(e => { console.error('FAILED:', e.message); process.exit(1); });
"
```

Expected output:
```
File: begeleidingsbrief_SMOKE-TEST-001.pdf Size: <N> bytes
PDF header: %PDF
Smoke test PASSED
```

---

## Task 6: Run full test suite and commit

- [ ] **Step 1: Run the server test suite**

```bash
cd server && npm test
```

Expected: All tests pass. Pay attention to the BGL describe block — both `generates BGL` and `rejects BGL generation` should pass. The `fs.existsSync(doc.storage_path)` assertion introduced in Task 3 should now pass.

- [ ] **Step 2: If generate-bgl test fails — diagnose**

If `documents[0].status` is `'FAILED'` instead of `'GENERATED'`, check the server logs for the generation error:

```bash
cd server && npm test -- --reporter=verbose 2>&1 | grep -A 5 "BGL generation error"
```

Common causes:
- Template file not found → verify `server/src/assets/begeleidingsbrief-template.pdf` exists
- Prisma include fails → verify `npx prisma generate` was run after schema change
- `pdf-lib` not installed → verify `node_modules/pdf-lib` exists

- [ ] **Step 3: Commit all changes**

```bash
git add \
  server/src/services/begeleidingsbriefService.js \
  server/src/services/begeleidingsbriefGenerator.js \
  server/src/__tests__/outbounds.test.js
git commit -m "feat: replace PDFKit BGL renderer with pdf-lib AcroForm filling

- Section 3B now uses DisposerSite (site_name) with fallback to disposer
- Section 4B now uses waste_stream[0].receiver instead of buyer
- Packaging is now per-material (filter parcels by material_id)
- Two weight columns: estimated (planned_amount_kg) + measured (net_weight_kg)
- Sender role checkboxes derived from entity.is_disposer / is_receiver
- Hardcoded: route_collection=NEE, inzamelaarsregeling=NEE, repeterende_vrachten=NEE"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Section 1 role checkbox from sender.is_disposer / is_receiver | Task 4 (service), Task 5 (generator) |
| Section 2 invoice_entity from contract | Task 4 |
| Section 3A disposer entity | Task 4 |
| Section 3B DisposerSite with fallback | Task 1 (schema), Task 4 |
| Datum aanvang transport = order.planned_date | Task 4 |
| Section 4A conditional outsourced transporter | Task 4, Task 5 |
| Section 4B waste_streams[0].receiver | Task 4 |
| Section 5 transporter, checkbox vervoerder/uitbesteed | Task 4, Task 5 |
| route_collection, inzamelaarsregeling, repeterende vrachten = NEE | Task 5 |
| Section 6 per-material ASN, name, packaging, eural, processing_method | Task 4, Task 5 |
| estimated_weight = planned_amount_kg | Task 4 |
| measured_weight = net_weight_kg (single stream only) | Task 4 |
| > 11 streams: overflow note in row 11 | Task 4 |
| pdf-lib AcroForm filling | Task 5 |
| form.flatten() | Task 5 |
| Return { fileName, filePath, fileSize } | Task 5 |

All spec requirements covered. ✓

**Type/name consistency:**
- `invoiceEntity` (service) → `mappedData.invoiceEntity` (generator) ✓
- `originSite` (service) → `mappedData.originSite` (generator) ✓
- `hasOutsourcedTransporter` (service) → `mappedData.hasOutsourcedTransporter` (generator) ✓
- `wasteLines[i].estimatedWeight` / `measuredWeight` (service) → `estimated_weight-${i}` / `measured_weight-${i}` (generator) ✓
- `formatPackaging` / `formatDateNL` exported from service ✓
- Generator exports only `generateBegeleidingsbriefPDF` (same as before) ✓
- Generator returns `{ fileName, filePath, fileSize }` (same contract as before) ✓
