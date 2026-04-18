# Begeleidingsbrief AcroForm Generation

**Date:** 2026-04-18  
**Branch:** feat/entity-refactor  
**Status:** Approved

## Overview

Replace the existing PDFKit-based Begeleidingsbrief renderer with `pdf-lib` AcroForm field filling against the official Dutch waste transport form (`default_wtn_acro_form`). The form has 120 named fields — text fields and checkboxes — covering all 6 sections and up to 11 waste stream rows.

The existing two-file architecture is preserved:
- `begeleidingsbriefService.js` — fetches and maps DB data into a flat `mappedData` object
- `begeleidingsbriefGenerator.js` — fills AcroForm fields from `mappedData` and saves the PDF

All other wiring (`POST /:id/generate-bgl`, `outboundService.generateBgl()`, `OutboundDocument` tracking, download endpoint) is unchanged.

## Files Changed

| File | Action |
|---|---|
| `server/src/assets/begeleidingsbrief-template.pdf` | New — copy of official AcroForm template |
| `server/src/services/begeleidingsbriefGenerator.js` | Rewrite — pdf-lib AcroForm filling |
| `server/src/services/begeleidingsbriefService.js` | Update — fix mapping gaps |
| `server/prisma/schema.prisma` | Add `disposer_site` relation on OutboundOrder |
| `server/package.json` | Add `pdf-lib` dependency |

## Schema Fix

`OutboundOrder.disposer_site_id` already exists as a DB column but has no Prisma relation annotation. Add it to both models — no migration required, only `prisma generate`.

```prisma
// In OutboundOrder model
disposer_site    Entity?   @relation("OutboundOrderDisposerSite", fields: [disposer_site_id], references: [id])

// In Entity model (back-reference)
outbound_orders_as_disposer_site OutboundOrder[] @relation("OutboundOrderDisposerSite")
```

## Data Mapping (begeleidingsbriefService.js)

The `mapBegeleidingsbrief(outboundId)` function fetches the Outbound record with a deep Prisma include and returns a `mappedData` object consumed by the generator.

### Prisma Include Required

```js
{
  outbound_order: {
    include: {
      sender: true,
      disposer: true,
      disposer_site: true,          // was missing — needs new relation
      transporter: true,
      outsourced_transporter: true,
      contract: {
        include: { invoice_entity: true }
      },
      waste_streams: {
        include: {
          receiver: true,           // was missing
          waste_stream: true,
        }
      }
    }
  },
  parcels: {
    include: { material: true }
  }
}
```

### mappedData Shape

```js
{
  // Section 1
  sender: {
    name, address, postalCity, vihb,
    isDisposer,   // → role_selection-waste_producer checkbox
    isReceiver,   // → role_selection-receiver checkbox
  },

  // Section 2
  invoiceEntity: { name, street, postalCity } | null,

  // Section 3A
  disposer: { name, address, postalCity },

  // Section 3B — fallback to disposer if disposer_site is null
  originSite: { name, address, postalCity },
  transportStartDate,  // format(order.planned_date, 'dd-MM-yyyy')

  // Section 4A — null if no outsourced_transporter
  outsourcedTransporter: { name, address, postalCity, vihb } | null,

  // Section 4B — from waste_streams[0].receiver
  destination: { name, address, postalCity },

  // Section 5
  transporter: { name, address, postalCity, vihb },
  vehiclePlate,
  hasOutsourcedTransporter,  // drives transported_by checkbox

  // Section 6 — one entry per waste stream (max 11)
  wasteLines: [
    {
      asn,
      materialName,
      packaging,       // per-material: parcels for this material_id → "2x 40m³"
      euralCode,
      processingMethod,
      estimatedWeight, // waste_stream.planned_amount_kg (string or '')
      measuredWeight,  // outbound.net_weight_kg if single stream, else ''
    }
  ]
}
```

### Key Mapping Rules

**Role checkbox (Section 1):**
- `role_selection-waste_producer` → `sender.is_disposer === true`
- `role_selection-receiver` → `sender.is_receiver === true`
- `role_selection-trader` / `role_selection-intermediary` → always `false` (no matching entity flag)

**Section 3B origin site:**
- Use `order.disposer_site` if non-null
- Fallback to `order.disposer` if `disposer_site_id` is null

**Section 4B destination:**
- Read from `order.waste_streams[0].receiver`
- All streams in an outbound are assumed to share the same receiver

**Section 6 packaging (per material):**
- Filter `outbound.parcels` where `parcel.material_id === waste_stream.material_id`
- Group by `volume_m3` if present, else by `container_type`
- Format: `"2x 40m³"` or `"3x Skip"`

**Section 6 weights:**
- `estimated_weight`: `waste_stream.planned_amount_kg?.toString() || ''`
- `measured_weight`: `outbound.net_weight_kg?.toString()` if `wasteLines.length === 1`, else `''`

**Section 6 row limit:**
- Max 11 rows (form constraint)
- If `waste_streams.length > 11`: fill first 10 rows normally, set row 11 `waste_name` to `"+ {n} more streams — see order {order_number}"`

## PDF Generation (begeleidingsbriefGenerator.js)

```js
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '../assets/begeleidingsbrief-template.pdf');

async function generateBegeleidingsbriefPDF(mappedData, outputPath) {
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // Section 1
  setCheckbox(form, 'role_selection-waste_producer', mappedData.sender.isDisposer);
  setCheckbox(form, 'role_selection-receiver', mappedData.sender.isReceiver);
  setText(form, 'sender_name', mappedData.sender.name);
  setText(form, 'sender_address', mappedData.sender.address);
  setText(form, 'sender_postal_city', mappedData.sender.postalCity);
  setText(form, 'sender_vihb', mappedData.sender.vihb);

  // Section 2
  if (mappedData.invoiceEntity) {
    setText(form, 'invoice_address', mappedData.invoiceEntity.name);
    setText(form, 'invoice_pobox_street', mappedData.invoiceEntity.street);
    setText(form, 'invoice_postal_city', mappedData.invoiceEntity.postalCity);
  }

  // Section 3A
  setText(form, 'waste_producer', mappedData.disposer.name);
  setText(form, 'waste_producer_address', mappedData.disposer.address);
  setText(form, 'waste_producer_postal_city', mappedData.disposer.postalCity);

  // Section 3B
  setText(form, 'waste_origin_location', mappedData.originSite.name);
  setText(form, 'waste_origin_address', mappedData.originSite.address);
  setText(form, 'waste_origin_postal_city', mappedData.originSite.postalCity);
  setText(form, 'transport_start_date', mappedData.transportStartDate);

  // Section 4A
  if (mappedData.outsourcedTransporter) {
    setText(form, 'contracted_transporter', mappedData.outsourcedTransporter.name);
    setText(form, 'contracted_transporter_address', mappedData.outsourcedTransporter.address);
    setText(form, 'contracted_transporter_postal_city', mappedData.outsourcedTransporter.postalCity);
    setText(form, 'contracted_transporter_vihb', mappedData.outsourcedTransporter.vihb);
  }

  // Section 4B
  setText(form, 'destination_location', mappedData.destination.name);
  setText(form, 'destination_address', mappedData.destination.address);
  setText(form, 'destination_postal_city', mappedData.destination.postalCity);

  // Section 5
  setCheckbox(form, 'transported_by-transporter', !mappedData.hasOutsourcedTransporter);
  setCheckbox(form, 'transported_by-contracted_transporter', mappedData.hasOutsourcedTransporter);
  setText(form, 'receiver_details', mappedData.transporter.name);
  setText(form, 'receiver_address', mappedData.transporter.address);
  setText(form, 'receiver_postal_city', mappedData.transporter.postalCity);
  setText(form, 'receiver_vihb', mappedData.transporter.vihb);
  setText(form, 'license_plate', mappedData.vehiclePlate || '');
  setCheckbox(form, 'route_collection-no', true);
  setCheckbox(form, 'collector_regulation-no', true);
  setCheckbox(form, 'repetitive_shipments-no', true);

  // Section 6
  mappedData.wasteLines.forEach((line, idx) => {
    const i = idx + 1;
    setText(form, `waste_stream_number-${i}`, line.asn || '');
    setText(form, `waste_name-${i}`, line.materialName || '');
    setText(form, `waste_packaging-${i}`, line.packaging || '');
    setText(form, `eural_code-${i}`, line.euralCode || '');
    setText(form, `processing_method-${i}`, line.processingMethod || '');
    setText(form, `estimated_weight-${i}`, line.estimatedWeight || '');
    setText(form, `measured_weight-${i}`, line.measuredWeight || '');
  });

  form.flatten();
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

function setText(form, fieldName, value) {
  try { form.getTextField(fieldName).setText(value || ''); } catch (_) {}
}

function setCheckbox(form, fieldName, checked) {
  try {
    const cb = form.getCheckBox(fieldName);
    checked ? cb.check() : cb.uncheck();
  } catch (_) {}
}
```

## Error Handling

- Missing `disposer_site`: fallback to disposer silently (no error)
- Missing `invoice_entity`: skip Section 2 fields (leave blank)
- Missing `outsourced_transporter`: skip Section 4A fields (leave blank)
- `waste_streams.length === 0`: generate PDF with empty Section 6 (still valid)
- `waste_streams.length > 11`: truncate at 11 with overflow note in last row
- PDF field `setText`/`setCheckbox` wrapped in try/catch — unknown field names are silently skipped

## Testing

- Unit test `mapBegeleidingsbrief()` with mock Prisma data covering: single stream, multiple streams, null disposer_site, null invoice_entity, null outsourced_transporter
- Integration test: call `generateBgl` on a real outbound fixture, assert `OutboundDocument` record created with `status: GENERATED`
- Manual: download generated PDF and visually verify field fill for each section
