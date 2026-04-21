# Weighing Refactor: 1 Inbound = 1 Asset with Swap Weighing

**Date:** 2026-04-10  
**Status:** Design Approved  
**Trigger:** Soft kick-off meeting minutes (9 Apr) revealed gap between Statice's real weighing operation and current implementation.

## Context

Statice Helden BV weighs **one container at a time** — not the entire truck repeatedly. The current interleaved weighing model (N assets per inbound, N+1 weighings) does not match this. The real operation uses a **swap method**: weigh vehicle with full container, swap for empty similar container (or remove entirely if tare is known), weigh again. One weight bill per container.

**Source of truth:** `20260409_Minutes-soft-kick-off-Statice_AH.pdf` and real Pfister weight bill photo.

---

## 1. Data Model Changes

### New Enum: WeighingMode

```prisma
enum WeighingMode {
  SWAP      // New container — drop full, pick up empty similar
  DIRECT    // Known container — known tare, vehicle weighed alone after drop
  BULK      // No container — bulk material unloaded, vehicle weighed alone
}
```

### Inbound Model Changes

**Added field:**
- `weighing_mode WeighingMode?` — set when asset is registered (between W1 and W2)

**Enforcement:**
- Max 1 asset per inbound (service-layer validation, no schema change)
- Max 2 InboundWeighing records per inbound (sequence 1 = gross, sequence 2 = tare/swap)

### New Model: ContainerRegistry

A lookup table for known/reusable containers. Enables dropdown selection during weighing (DIRECT mode) instead of free-text entry.

```prisma
model ContainerRegistry {
  id              String    @id @default(uuid())
  container_label String    @unique   // physical label e.g. "SKIP-001"
  container_type  SkipType            // OPEN_TOP, CLOSED_TOP, GITTERBOX, PALLET, OTHER
  tare_weight_kg  Decimal             // verified empty weight
  volume_m3       Decimal?            // optional capacity
  notes           String?             // optional notes
  is_active       Boolean   @default(true)  // soft delete — inactive = not selectable
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
}
```

**Admin page** (`/admin/containers`): simple list + kebab menu (Edit, Delete)
- Edit: updates future uses only — historical inbound data unchanged
- Delete: soft-delete (sets `is_active = false`) — no longer selectable but historical references preserved
- No complex features — just CRUD with standard list patterns (RowActionMenu, StatusBadge, etc.)

**Usage in weighing flow**: When operator selects "Known Container" (DIRECT mode), a dropdown lists active ContainerRegistry entries. On selection, auto-populates: container_type, tare_weight_kg, volume_m3.

### Preserved

- Asset model (parcel_type, container_type, estimated_tare_weight_kg, container_label, etc.)
- PfisterTicket model (device_id already exists, ticket_number already exists)
- InboundOrder → Inbound (1:N) relationship
- Inbound → SortingSession (1:1) relationship
- InboundWeighing model

---

## 2. Weighing Flow — 3 Modes

All modes follow the same sequence: W1 → Register Asset → W2. The difference is the physical process between weighings and the net weight formula.

### SWAP Mode (New Container, Unknown Tare)

```
Physical:  Vehicle + full container → scale → W1
           Driver drops full container, picks up empty similar container
           Vehicle + empty swap container → scale → W2
Formula:   Net cargo ≈ W1 - W2
```

The swap containers are same type, so their tare weights approximately cancel out. Net is an approximation of pure cargo weight.

### DIRECT Mode (Known Container, Known Tare)

```
Physical:  Vehicle + full known container → scale → W1
           Driver drops container entirely (no swap)
           Vehicle alone → scale → W2
Formula:   Container gross = W1 - W2
           Net cargo = (W1 - W2) - known_tare
```

### BULK Mode (No Container)

```
Physical:  Vehicle + bulk material → scale → W1
           Material is unloaded
           Vehicle alone → scale → W2
Formula:   Net = W1 - W2
```

### Net Weight Calculation (recalculateInboundWeights)

```javascript
const w1 = weighings.find(w => w.sequence === 1); // gross
const w2 = weighings.find(w => w.sequence === 2); // tare/swap

if (w1 && w2) {
  const diff = roundWeight(w1.weight_kg - w2.weight_kg);

  if (mode === 'DIRECT' && asset.estimated_tare_weight_kg) {
    // Known container: diff = container + cargo
    asset.gross_weight_kg = diff;
    asset.tare_weight_kg = asset.estimated_tare_weight_kg;
    asset.net_weight_kg = roundWeight(diff - asset.estimated_tare_weight_kg);
  } else {
    // SWAP or BULK: W1-W2 = net (swap containers cancel, or no container)
    asset.gross_weight_kg = w1.weight_kg;
    asset.tare_weight_kg = w2.weight_kg;
    asset.net_weight_kg = diff;
  }

  // Inbound totals mirror the single asset
  inbound.gross_weight_kg = w1.weight_kg;
  inbound.tare_weight_kg = w2.weight_kg;
  inbound.net_weight_kg = asset.net_weight_kg;
}
```

### Pfister weighingType

The INTERMEDIATE type is no longer used. Every inbound has exactly:
- Sequence 1 → `weighingType = 'GROSS'`
- Sequence 2 → `weighingType = 'TARE'`

### Status Transitions (Unchanged)

```
ARRIVED → (W1 triggered) → WEIGHED_IN → (W2 triggered) → WEIGHED_OUT → (confirmed) → READY_FOR_SORTING → SORTED
```

---

## 3. Arrival Page UX

### Current Flow
"Register Arrival" → creates 1 inbound → navigates to `/inbounds/{id}`

### New Flow
1. Operator enters license plate → order matches
2. Order card shows existing inbounds (status + net weight)
3. Operator clicks **"+ Add Inbound"** → inbound created (ARRIVED) → opens in **new browser tab** (`window.open`)
4. Operator returns to arrival page → order card refreshed → can add more inbounds
5. Repeat until all containers registered

### Order Card Layout (on Arrival Page)

```
┌──────────────────────────────────────────────┐
│ ORD-2026-001   Coolblue KV                   │
│ ● ARRIVED      Ref: V0-1204                  │
│──────────────────────────────────────────────│
│ Inbounds:                                     │
│   IN-001  ● WEIGHED_OUT   Net: 2.060 kg     │
│   IN-002  ● WEIGHED_IN    Net: —             │
│                                               │
│ [+ Add Inbound]                               │
└──────────────────────────────────────────────┘
```

---

## 4. Weighing Page UX

### Simplified Layout (Single Asset)

Since 1 inbound = 1 asset, the parcels table (right panel) is removed. The weighing flow becomes the main content:

```
┌─────────────────────┬────────────────────────────────┐
│ Order & Vehicle      │ Weighing Flow                  │
│                      │                                │
│ Supplier: Coolblue   │ [Trigger Gross Weighing]       │
│ Carrier: DHL         │                                │
│ Plate: AB-123-CD     │ ── W1: 18.020 kg  10:52:50 ── │
│ Waste: Mixed WEEE    │                                │
│                      │ [Register Asset]               │
│                      │   Mode: ○ New  ○ Known  ○ Bulk │
│                      │   Type: [OPEN_TOP ▼]           │
│                      │                                │
│                      │ ── SKP-20260408-001  SWAP ──── │
│                      │                                │
│                      │ [Trigger Tare Weighing]        │
│                      │                                │
│                      │ ── W2: 15.960 kg  11:55:29 ── │
│                      │                                │
│                      │ ══════════════════════════     │
│                      │ Netto: 2.060 kg                │
│                      │                                │
│                      │ [Download Weight Bill]  [✓ OK] │
├─────────────────────┴────────────────────────────────┤
│ Order ORD-2026-001 — 2 inbounds                       │
│  IN-001 ● WEIGHED_OUT  2.060 kg                      │
│  IN-002 ● ARRIVED       —                             │
└──────────────────────────────────────────────────────┘
```

### Button Visibility States

| State | Visible Buttons |
|-------|----------------|
| ARRIVED, 0 weighings | "Trigger Gross Weighing" |
| WEIGHED_IN, 1 weighing, 0 assets | "Register Asset" form |
| WEIGHED_IN, 1 weighing, 1 asset | "Trigger Tare Weighing" |
| WEIGHED_OUT | "Download Weight Bill" + "Confirm" |
| READY_FOR_SORTING+ | Read-only summary |

### Asset Registration Form

Three modes, triggered by parcel_type selection:

**New Container (SWAP):**
- Container type dropdown (OPEN_TOP, CLOSED_TOP, GITTERBOX, PALLET, OTHER)
- Container label auto-generated
- Waste stream (from order or manual select)
- Material category (optional)
- Notes (optional)
- ~~estimated_tare_weight_kg~~ — not shown (swap makes it irrelevant)

**Known Container (DIRECT):**
- Container label input (scan/enter)
- Auto-populate: type, tare weight from lookup (or manual entry)
- Waste stream, material category, notes

**Bulk Material (BULK):**
- Waste stream
- Material category
- Notes

### Bottom Bar: Order Context

Shows all inbounds under the same order with status badges, net weights, and links. Gives operator visibility into overall delivery status without leaving the weighing page.

---

## 5. Weight Bill — Receipt-Style PDF

### Format

Compact, receipt-style PDF mimicking Pfister thermal printer output. Dutch labels.

```
┌─────────────────────────────────────────┐
│         [STATICE LOGO]                  │
│    Statice Elektronica Recycling        │
│    De Oude Kooien 15                    │
│    5986 PJ Beringe NL                   │
│    T +31 (0)77 306 0688                 │
│─────────────────────────────────────────│
│ Leverancier:  Coolblue KV              │
│ Referentie:   V0-1204                   │
│ Order:        ORD-2026-001              │
│ Inbound:      IN-2026-001              │
│ Kenteken:     AB-123-CD                 │
│ Asset:        SKP-20260408-001          │
│               OPEN_TOP / Mixed WEEE     │
│─────────────────────────────────────────│
│                                         │
│ 08/04/2026              10:52:50        │
│ Volgnummer                  9141        │
│ Weg                         1411        │
│ 1. Gewicht            18.020 kg         │
│                                         │
│ 08/04/2026              11:55:29        │
│ Volgnummer                  9142        │
│ Weg                         1411        │
│ 2. Gewicht            15.960 kg         │
│                                         │
│ Netto Gewicht          2.060 kg         │
│─────────────────────────────────────────│
│ Bevestigd door: Jan de Vries            │
│ Gegenereerd:   08-04-2026 12:05:00     │
│                                         │
│         [WEEELABEX LOGO]                │
└─────────────────────────────────────────┘
```

### DIRECT Mode Extra Lines

When weighing_mode = DIRECT (known container tare):

```
Bruto Container      2.360 kg     (W1 - W2)
Container Tarra        300 kg     (known)
Netto Lading         2.060 kg     (cargo only)
```

### Field Sources

| Field | Source |
|-------|--------|
| Leverancier | InboundOrder.supplier.name |
| Referentie | InboundOrder.client_reference |
| Order | InboundOrder.order_number |
| Inbound | Inbound.inbound_number |
| Kenteken | Vehicle.registration_plate |
| Asset | Asset.asset_label + container_type |
| Volgnummer | PfisterTicket.ticket_number |
| Weg | PfisterTicket.device_id |
| 1./2. Gewicht | InboundWeighing.weight_kg |
| Timestamp | PfisterTicket.timestamp |
| Netto Gewicht | Asset.net_weight_kg |
| Bevestigd door | User.full_name (confirmed_by) |

---

## 6. Order Status & Aggregation

### Order Status State Machine (Updated)

```
PLANNED      → first inbound created                → ARRIVED
ARRIVED      → first inbound reaches WEIGHED_OUT    → IN_PROGRESS
IN_PROGRESS  → all inbounds reach SORTED            → COMPLETED
any state    → manual cancellation                  → CANCELLED
```

### Order Detail Page — Inbound Cards with Parcel Detail

Each inbound is shown as a card. Inside the card, the registered parcel is displayed as a detail row:

```
┌─────────────────────────────────────────────────────────────────┐
│ IN-2026-001   ● WEIGHED_OUT   [Download Weight Bill]           │
│─────────────────────────────────────────────────────────────────│
│ Parcel ID       │ Container ID │ Type     │ Cargo Net │ Tare   │
│ SKP-20260408-001│ SKIP-001     │ OPEN_TOP │ 2.060 kg  │ 300 kg │
│                                                                 │
│ Material Net │ Volume  │ Notes                                  │
│ 2.060 kg     │ 12 m³   │ Mixed WEEE from Coolblue              │
└─────────────────────────────────────────────────────────────────┘
```

**Columns:**

| Column | Source | Notes |
|--------|--------|-------|
| Parcel ID | Asset.asset_label | Always shown |
| Container ID | Asset.container_label | From ContainerRegistry or auto-generated |
| Container Type | Asset.container_type | OPEN_TOP, CLOSED_TOP, etc. |
| Cargo Net (kg) | Asset.net_weight_kg | Net cargo weight |
| Tare Weight (kg) | Asset.estimated_tare_weight_kg | Only shown if DIRECT mode (known container) |
| Material Net (kg) | Asset.net_weight_kg | Same as Cargo Net for SWAP/BULK |
| Volume (m³) | Asset.estimated_volume_m3 | Optional, show `—` if null |
| Notes | Asset.notes | Optional |

### Order Totals

- Total gross, total tare, total net (sum of all inbound nets)
- Order-level notes, incident tracking

### Process (SortingSession) — Unchanged

- 1 Inbound → 1 SortingSession (created on inbound confirmation)
- Each container sorted independently
- Inbound page links directly to sorting session (existing flow preserved)
- Order-level reporting aggregates across sorting sessions

---

## 7. Migration & Backward Compatibility

### Data Migration

Existing inbounds with multiple assets will NOT be migrated to 1:1. They remain as-is (legacy). The old `recalculateInboundWeights` logic is preserved behind a mode check:

```javascript
if (inbound.weighing_mode) {
  // New 1:1 logic (SWAP/DIRECT/BULK)
} else {
  // Legacy interleaved logic (for pre-migration inbounds)
}
```

### Database Migration

```sql
-- Add weighing_mode column (nullable for legacy data)
ALTER TABLE "WeighingEvent" ADD COLUMN "weighing_mode" TEXT;

-- Create enum type
CREATE TYPE "WeighingMode" AS ENUM ('SWAP', 'DIRECT', 'BULK');
ALTER TABLE "WeighingEvent" ALTER COLUMN "weighing_mode" TYPE "WeighingMode" USING "weighing_mode"::"WeighingMode";
```

No destructive changes. Existing data untouched.

---

## 8. Files to Modify

| File | Changes |
|------|---------|
| `server/prisma/schema.prisma` | Add WeighingMode enum, weighing_mode to Inbound, ContainerRegistry model |
| `server/src/services/inboundService.js` | Refactor triggerNextWeighing (max seq=2), registerParcel (max 1 asset, set weighing_mode), recalculateInboundWeights (3-mode formula) |
| `server/src/services/containerRegistryService.js` | **New** — CRUD for ContainerRegistry (list active, create, update, soft-delete) |
| `server/src/controllers/containerRegistryController.js` | **New** — thin controller for container registry API |
| `server/src/routes/containerRegistry.js` | **New** — `/api/containers` routes |
| `server/src/services/ticketGenerator.js` | Rewrite to receipt-style PDF with Dutch labels |
| `client/src/pages/admin/ContainerRegistryPage.jsx` | **New** — admin CRUD page (list, kebab menu, edit/delete modals) |
| `client/src/pages/weighing/WeighingEventPage.jsx` | Simplify to single-asset layout, 3-mode asset form with container dropdown, bottom order bar |
| `client/src/pages/arrival/ArrivalPage.jsx` | Add inbound list to order card, new-tab behavior for "Add Inbound" |
| `client/src/i18n/en/weighing.json` | Update labels for new flow |
| `client/src/i18n/nl/weighing.json` | Update Dutch labels |
| `server/src/__tests__/weighing.test.js` | Rewrite for 1:1 model, test all 3 modes |
| `client/src/pages/weighing/__tests__/WeighingEventPage.test.jsx` | Update frontend tests |

---

## 9. Verification Plan

### Unit/Integration Tests

1. **SWAP mode**: Create inbound → W1 → register new container → W2 → verify net = W1-W2
2. **DIRECT mode**: Create inbound → W1 → register known container (tare=300) → W2 → verify net = (W1-W2)-300
3. **BULK mode**: Create inbound → W1 → register bulk material → W2 → verify net = W1-W2
4. **Max 1 asset**: Attempt to register 2nd asset → expect error
5. **Max 2 weighings**: Attempt 3rd weighing → expect error
6. **Legacy compatibility**: Existing multi-asset inbound still calculates correctly
7. **Weight bill PDF**: Verify all fields present, Dutch labels, correct values
8. **Order status transitions**: PLANNED→ARRIVED→IN_PROGRESS→COMPLETED with multiple inbounds
9. **Container Registry CRUD**: Create, update, soft-delete containers; verify inactive containers not selectable
10. **DIRECT mode dropdown**: Register known container via ContainerRegistry selection → auto-populate tare, type, volume

### Manual Testing

1. Create order with 2 expected containers
2. From arrival page, add inbound 1 (opens new tab)
3. Complete weighing flow (SWAP mode) in new tab
4. Return to arrival page, verify inbound 1 shows in order card
5. Add inbound 2 (opens new tab)
6. Complete weighing flow (DIRECT mode) in new tab
7. Download both weight bills, verify receipt format
8. Verify order status progression
9. Verify both sorting sessions created independently

### Playwright E2E (if configured)

- Full flow: arrival → inbound creation → weighing → weight bill → sorting handoff
