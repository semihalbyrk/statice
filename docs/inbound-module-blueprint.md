# Inbound Module Blueprint

> **What is this?** A reusable product blueprint for building an inbound receiving module in waste management (MRF/recycling) applications. Read this before writing any code — it tells you what to build, how to structure it, and what to ask the customer.

---

## Table of Contents

1. [Purpose & Business Context](#1-purpose--business-context)
2. [Standard Data Model](#2-standard-data-model)
3. [Standard Screens & UI Components](#3-standard-screens--ui-components)
4. [Standard Workflows](#4-standard-workflows)
5. [Integration Points](#5-integration-points)
6. [Customer-Variable Parts](#6-customer-variable-parts)
7. [Implementation Principles](#7-implementation-principles)
8. [Common Mistakes & Lessons Learned](#8-common-mistakes--lessons-learned)
9. [Reference: Statice Implementation](#9-reference-statice-implementation)

---

## 1. Purpose & Business Context

### What the Inbound Module Does

The inbound module manages the physical receiving of waste materials at a processing facility. It tracks every delivery from the moment a vehicle arrives at the gate until the materials are handed off for sorting or processing. Its core job is to create a legally defensible, auditable record of **what arrived, how much it weighed, and in what condition**.

### Business Problems It Solves

- **Weight accuracy & fraud prevention**: Weighbridge-integrated gross/tare recording ensures suppliers are billed on actual net weight, not estimates.
- **Regulatory traceability**: Waste legislation (WEEE, LMA, Basel Convention) requires chain-of-custody documentation from origin to treatment. The inbound module is the first link in that chain.
- **Operational efficiency**: Gate operators process vehicles quickly via plate matching and pre-planned orders, reducing queue times.
- **Financial accuracy**: Accurate weights feed directly into invoicing — contamination penalties, material fees, and transport charges all depend on inbound data.
- **Discrepancy handling**: When what arrives doesn't match what was ordered (wrong material, damaged containers, contamination), the module captures the evidence.

### User Roles

| Role | What they do in the inbound module |
|------|-----------------------------------|
| **Gate Operator** | Registers arrivals, triggers weighings, registers parcels, reports incidents. The primary daily user. |
| **Logistics Planner** | Creates planned orders, schedules deliveries, reviews planning board. Sees inbound data but rarely operates it. |
| **Admin / Supervisor** | Overrides weights, confirms weighing tickets, manages manual matches. Handles exceptions. |
| **Finance** | Reviews completed inbounds for invoicing, checks contamination penalties. Read-only on inbound data. |
| **Sorting Employee** | Receives the handoff from inbound — sees what parcels arrived and their weights. Does not modify inbound data. |

### Relationship to Other Modules

```
Order Module (upstream)
  │
  │  An order is a planned delivery. One order can produce
  │  multiple inbounds (partial deliveries, return trips).
  │
  ▼
INBOUND MODULE ◄── Weighbridge System (external)
  │
  │  Each inbound produces parcels/assets with verified weights.
  │  When all parcels are registered, the inbound is handed off.
  │
  ▼
Sorting / Processing Module (downstream)
  │
  ▼
Invoice Module (downstream)
```

**What triggers an inbound**: A vehicle arrives at the facility gate. The operator either matches it to a pre-planned order or creates an ad-hoc order on the spot.

**What happens before**: A logistics planner creates an order specifying the supplier, carrier, waste stream, planned date, expected number of parcels, and vehicle plate.

**What happens after**: The parcels from the inbound are sorted (material identification, quality check, weight breakdown by material type), then the results feed into invoicing.

---

## 2. Standard Data Model

### Entity Overview

```
Order (1) ──────────► (Many) Inbound
                         │
                         ├──► (Many) Weighing Record
                         │        │
                         │        └──► (1) Weight Ticket
                         │                   │
                         │                   └──► (Many) Weight Amendment
                         │
                         ├──► (Many) Asset / Parcel
                         │
                         └──► (1) Sorting Session (downstream handoff)

Order ──► Supplier, Carrier, Waste Stream, Vehicle
```

### Entity: Order

Represents a planned or ad-hoc delivery. Created before the vehicle arrives.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Yes | Primary key |
| order_number | String | Yes | Unique, sequential (e.g., ORD-00001) |
| status | Enum | Yes | PLANNED → ARRIVED → IN_PROGRESS → COMPLETED → INVOICED / CANCELLED |
| supplier_id | FK | Yes | Who is sending the waste |
| carrier_id | FK | Yes | Who is transporting it |
| waste_stream_id | FK | Yes | Primary waste type (can have multiple via junction) |
| planned_date | Date | Yes | Expected delivery date |
| time_window_start | DateTime | No | Optional delivery window |
| time_window_end | DateTime | No | |
| expected_parcel_count | Int | Yes | How many parcels/skips expected (1–10) |
| received_parcel_count | Int | Yes | Auto-calculated as parcels are registered |
| vehicle_plate | String | No | Expected vehicle registration plate |
| is_adhoc | Boolean | Yes | True = walk-in delivery, not pre-planned |
| is_special_transport | Boolean | Yes | True = oversized vehicle (affects max parcels) |
| waste_registration_number | String | No | Country-specific waste tracking number |
| client_reference | String | No | Supplier's own reference |
| notes | String | No | Free text |
| incident_category | Enum | No | DAMAGE, DISPUTE, SPECIAL_HANDLING, DRIVER_INSTRUCTION |
| incident_notes | String | No | |
| created_by | FK | Yes | User who created the order |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

**For ad-hoc orders, add:**
| adhoc_contact_name | String | No | Walk-in person's name |
| adhoc_id_reference | String | No | Walk-in person's ID |

### Entity: Inbound

One weighing session for one vehicle arrival. An order can have multiple inbounds (partial deliveries).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Yes | Primary key |
| inbound_number | String | Yes | Unique, sequential (e.g., INB-00001) |
| status | Enum | Yes | ARRIVED → WEIGHED_IN → WEIGHED_OUT → READY_FOR_SORTING → SORTED |
| order_id | FK | Yes | Parent order |
| vehicle_id | FK | Yes | Resolved vehicle (may differ from order's expected plate) |
| arrived_at | DateTime | Yes | Gate arrival timestamp |
| gross_weight_kg | Decimal | No | Total vehicle weight with cargo |
| tare_weight_kg | Decimal | No | Empty vehicle weight |
| net_weight_kg | Decimal | No | Calculated: gross − tare |
| gross_ticket_id | FK | No | Link to gross weight ticket |
| tare_ticket_id | FK | No | Link to tare weight ticket |
| waste_stream_id | FK | No | Can override order's waste stream |
| match_strategy | Enum | No | How the order was matched: EXACT_SAME_DAY, EXACT_WINDOW, MANUAL, AD_HOC |
| is_manual_match | Boolean | Yes | True = operator manually selected the order |
| incident_category | Enum | No | Same enum as order |
| notes | String | No | |
| confirmed_by | FK | No | Supervisor who confirmed weighing |
| confirmed_at | DateTime | No | |
| created_at | DateTime | Yes | |

### Entity: Weighing Record

One record per interaction with the weighbridge. Enables sequential weighing (gross → intermediate → tare).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Yes | Primary key |
| inbound_id | FK | Yes | Parent inbound |
| sequence | Int | Yes | 1, 2, 3... Order of weighing |
| weight_ticket_id | FK | Yes | Link to actual weight measurement |
| weight_kg | Decimal | Yes | Weight value (copied from ticket for fast access) |
| is_tare | Boolean | Yes | True = this is a tare (empty) weighing |
| created_at | DateTime | Yes | |

**Unique constraint**: (inbound_id, sequence)

### Entity: Weight Ticket

Immutable record from the weighbridge system. Once confirmed, only amendments are allowed (never overwrite).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Yes | Primary key |
| ticket_number | String | Yes | Unique, from weighbridge system |
| weighing_type | Enum | Yes | GROSS, INTERMEDIATE, TARE |
| weight_kg | Decimal | Yes | Raw weight from scale |
| unit | String | Yes | Default: kg |
| timestamp | DateTime | Yes | Scale timestamp |
| raw_payload | JSON/String | Yes | Full response from weighbridge |
| is_manual | Boolean | Yes | True = manually entered (scale unavailable) |
| manual_reason | String | No | Required if is_manual = true |
| manual_entered_by | FK | No | |
| is_confirmed | Boolean | Yes | Supervisor confirmation |
| confirmed_by | FK | No | |
| confirmed_at | DateTime | No | |
| created_at | DateTime | Yes | |

### Entity: Weight Amendment

Audit trail for any changes to confirmed weight tickets. Never delete or overwrite — always append.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Yes | Primary key |
| weight_ticket_id | FK | Yes | Original ticket being amended |
| original_weight_kg | Decimal | Yes | Weight before change |
| amended_weight_kg | Decimal | Yes | New weight |
| reason | Enum | Yes | CALIBRATION_ERROR, EQUIPMENT_MALFUNCTION, INCORRECT_READING, SUPERVISOR_CORRECTION, OTHER |
| reason_notes | String | No | Free text explanation |
| amended_by | FK | Yes | User who made the change |
| created_at | DateTime | Yes | |

### Entity: Asset / Parcel

Individual container, skip, or bulk material unit within an inbound delivery.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Yes | Primary key |
| asset_label | String | Yes | Unique, sequential (e.g., P-00001) |
| inbound_id | FK | Yes | Parent inbound |
| sequence | Int | Yes | Order within inbound |
| parcel_type | Enum | Yes | CONTAINER or MATERIAL (bulk) |
| container_type | Enum | No | Required if CONTAINER: OPEN_TOP, CLOSED_TOP, GITTERBOX, PALLET, OTHER |
| container_label | String | No | Physical label on container (for reuse tracking) |
| waste_stream_id | FK | No | Material classification |
| estimated_tare_weight_kg | Decimal | No | Default tare for this container type |
| estimated_volume_m3 | Decimal | No | Operator estimate |
| gross_weighing_id | FK | No | Link to gross weighing record |
| tare_weighing_id | FK | No | Link to tare weighing record |
| gross_weight_kg | Decimal | No | From weighing record |
| tare_weight_kg | Decimal | No | From weighing record |
| net_weight_kg | Decimal | No | Calculated: gross − tare |
| notes | String | No | |
| created_at | DateTime | Yes | |

### Entity: Contamination Incident

Quality issues discovered during receiving or sorting. Feeds into penalty invoicing.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Yes | Primary key |
| incident_number | String | Yes | Unique, sequential |
| order_id | FK | Yes | Which order had the issue |
| sorting_session_id | FK | No | If discovered during sorting |
| contamination_type | Enum | Yes | NON_TARGET_MATERIAL, HAZARDOUS, MOISTURE_DAMAGE, REQUIRES_EXTRA_SORTING |
| description | String | Yes | What was found |
| contamination_weight_kg | Decimal | No | Weight of contaminated portion |
| contamination_pct | Decimal | No | Percentage of total |
| estimated_extra_hours | Decimal | No | Additional labor required |
| fee_amount | Decimal | No | Calculated or manual penalty |
| is_invoiced | Boolean | Yes | Prevents double-billing |
| recorded_by | FK | Yes | |
| recorded_at | DateTime | Yes | |
| notes | String | No | |

### Entity: Vehicle

Tracks physical vehicles for plate matching and carrier association.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | Yes | Primary key |
| registration_plate | String | Yes | Unique |
| carrier_id | FK | No | Default carrier for this vehicle |
| created_at | DateTime | Yes | |

### Key Enums Summary

| Enum | Values |
|------|--------|
| Order Status | PLANNED, ARRIVED, IN_PROGRESS, COMPLETED, INVOICED, CANCELLED, DISPUTE |
| Inbound Status | ARRIVED, WEIGHED_IN, WEIGHED_OUT, READY_FOR_SORTING, SORTED |
| Parcel Type | CONTAINER, MATERIAL |
| Container Type | OPEN_TOP, CLOSED_TOP, GITTERBOX, PALLET, OTHER (customer-variable) |
| Incident Category | DAMAGE, DISPUTE, SPECIAL_HANDLING, DRIVER_INSTRUCTION |
| Contamination Type | NON_TARGET_MATERIAL, HAZARDOUS, MOISTURE_DAMAGE, REQUIRES_EXTRA_SORTING |
| Match Strategy | EXACT_SAME_DAY, EXACT_WINDOW, MANUAL, AD_HOC |
| Weighing Type | GROSS, INTERMEDIATE, TARE |
| Amendment Reason | CALIBRATION_ERROR, EQUIPMENT_MALFUNCTION, INCORRECT_READING, SUPERVISOR_CORRECTION, OTHER |

---

## 3. Standard Screens & UI Components

### 3.1 Inbound List Page

**Route**: `/inbounds`
**Access**: Gate Operator, Admin

**Table columns** (in order):
1. Inbound Number — clickable, navigates to detail
2. Status — interactive badge with allowed transitions
3. Linked Order — clickable link to order
4. Vehicle Plate — monospace font
5. Carrier
6. Supplier — with supplier type badge
7. Waste Stream
8. Arrived At — formatted date/time
9. Parcels — count
10. Total Net Weight — formatted with locale

**Features**:
- Search by inbound number or order number (debounced, 300ms)
- Filter by status (dropdown)
- Pagination with configurable page size (10/20/50)
- Click row → navigate to detail page
- Status transitions directly from list via clickable badge dropdown

### 3.2 Arrival / Receiving Screen

**Route**: `/arrival`
**Access**: Gate Operator, Admin

**Purpose**: Register a vehicle arrival and link it to an order.

**Layout**:
1. **License plate input** — large, prominent input with country badge (e.g., "NL")
2. **Match results** — three sections by confidence:
   - Exact plate + same day (highest confidence, green)
   - Exact plate + nearby dates (±7 days, green)
   - Manual override candidates (lower confidence, orange)
3. **Order cards** — each shows: order number, status, planned date, carrier, supplier, waste stream, parcel progress, vehicle info
4. **Ad-hoc creation** — button to create an unplanned order when no match found, opens order form with plate pre-filled

**Flow**: Scan/enter plate → system shows matches → operator selects order → system creates inbound → navigates to weighing detail page.

### 3.3 Inbound Detail / Weighing Page

**Route**: `/inbounds/:id`
**Access**: Gate Operator, Admin

This is the central operational screen. The operator spends most of their time here.

**Layout**:

```
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb: Inbounds > INB-00042                        │
│ Title: INB-00042    [Status Badge]  [Incident Badge]    │
├─────────────────────────────────────────────────────────┤
│ Progress Bar: ● Arrived → ● Weighed In → ○ Weighed Out │
│               → ○ Ready for Sorting → ○ Sorted          │
├─────────────────────────────────────────────────────────┤
│ Info Card: Carrier | Supplier | Vehicle | Waste Stream  │
│            Contract Link | Order Link | Arrived At      │
├─────────────────────────────────────────────────────────┤
│ Incident Reporting: [Category ▼] [Notes] [Report]       │
├───────────────────────┬─────────────────────────────────┤
│ Weighing Flow         │ Registered Parcels              │
│                       │                                 │
│ [First Weighing btn]  │ Table:                          │
│ Weighing Timeline     │  Parcel ID | Container | Net   │
│ [Register Parcel form]│  P-00001   | CNT-001   | 475kg │
│ [Finalize Tare btn]   │  P-00002   | CNT-002   | 380kg │
│                       │  Total: 855kg                   │
├───────────────────────┴─────────────────────────────────┤
│ Actions: [Ready for Sorting] [Download PDF] [View Sort] │
└─────────────────────────────────────────────────────────┘
```

**Weighing Flow Section** (left panel):
- Trigger weighing buttons (First Weighing, Next Weighing, Finalize Tare)
- Weighing timeline showing interleaved weighings and parcels
- Parcel registration form (container type, waste stream, volume, notes)
- Manual weighing fallback dialog (when scale unavailable)
- Weight override dialog (admin only)

**Parcels Table** (right panel):
- All registered parcels with weights
- Columns: Parcel ID, Container Label, Cargo Net, Container Tare, Material Net
- Delete button per parcel (with confirmation)
- Total row

**Parcel Registration Form** — three modes:
1. **New container**: Select type, auto-generate label, set tare weight
2. **Existing container**: Scan/enter label, auto-populate from lookup
3. **Bulk material**: No container fields, just waste stream and notes

### 3.4 Weight Ticket PDF

Downloadable PDF containing:
- Facility info and logo
- Order details (order number, supplier, carrier, waste stream)
- Vehicle plate and arrival time
- Full weighing sequence table (sequence, type, weight, timestamp)
- Assets table (label, type, gross/tare/net, volume)
- Amendment history if any
- Confirmation status and confirming user
- Generated timestamp and footer

### 3.5 Common UI Components

| Component | Purpose |
|-----------|---------|
| **StatusBadge** | Read-only status display with color coding |
| **ClickableStatusBadge** | Interactive badge with dropdown for status transitions |
| **SupplierTypeBadge** | Shows supplier classification (PRO, Third Party, Private) |
| **ProgressBar** | 5-step horizontal progress through inbound statuses |
| **Breadcrumb** | Navigation trail (Inbounds > INB-00042) |
| **InfoField** | Label + value display for detail cards |
| **RowActionMenu** | 3-dot kebab menu for list row actions |

---

## 4. Standard Workflows

### 4.1 Main Flow: Order → Arrival → Weighing → Sorting Handoff

```
1. LOGISTICS PLANNER creates Order (status: PLANNED)
   └─ Specifies: supplier, carrier, waste stream, date, expected parcels, vehicle plate

2. VEHICLE ARRIVES at gate
   └─ Gate operator enters plate on Arrival screen
   └─ System matches to planned order(s)
   └─ Operator confirms match → system creates Inbound (status: ARRIVED)
   └─ Order transitions: PLANNED → ARRIVED

3. FIRST WEIGHING (gross)
   └─ Operator clicks "First Weighing"
   └─ System requests weight from weighbridge → creates Weight Ticket
   └─ Creates Weighing Record (sequence 1, is_tare=false)
   └─ Inbound updates: gross_weight_kg set, status → WEIGHED_IN
   └─ Order transitions: ARRIVED → IN_PROGRESS

4. PARCEL REGISTRATION + INTERMEDIATE WEIGHINGS (repeat per parcel)
   └─ Operator registers parcel (container type, waste stream)
   └─ System generates asset label, creates Asset record
   └─ Operator triggers next weighing → creates Weighing Record (sequence N)
   └─ Each parcel gets a gross weighing assigned

5. TARE WEIGHING (final)
   └─ All parcels unloaded, vehicle is empty
   └─ Operator clicks "Finalize Tare"
   └─ System requests tare weight → creates Weight Ticket
   └─ Inbound updates: tare_weight_kg set, net calculated, status → WEIGHED_OUT
   └─ All asset weights recalculated

6. HANDOFF TO SORTING
   └─ Operator clicks "Ready for Sorting"
   └─ System validates: all parcels have net weights
   └─ System auto-creates Sorting Session
   └─ Inbound status → READY_FOR_SORTING

7. SORTING COMPLETION (handled by sorting module)
   └─ When sorting session is finalized
   └─ Inbound status → SORTED
   └─ Order status → COMPLETED
```

### 4.2 Sequential Weighing Model (The 1:1 Rule)

The system enforces a strict alternation between weighings and parcel registrations:

```
Weighing 1 (gross)  →  Register Parcel 1  →  Weighing 2  →  Register Parcel 2  →  Weighing 3 (tare)
```

**Rule**: You cannot trigger a new weighing until the previous weighing's corresponding parcel has been registered (except for the tare weighing at the end).

**Why**: This ensures every parcel has a matching gross weight measurement. The tare weighing after the last parcel captures the empty vehicle weight.

**Implementation flags on the inbound object**:
- `can_weigh_first`: true when ARRIVED, no weighings yet
- `can_register_parcel`: true when weighing_count > asset_count (a weighing "gap" exists)
- `can_weigh_next`: true when weighing_count == asset_count (gap filled, ready for next)
- `can_weigh_tare`: true when at max parcels and gap is filled

### 4.3 Partial Delivery Handling

An order may expect 3 parcels but only 2 arrive. The system handles this by:
- Tracking `expected_parcel_count` on the order and `received_parcel_count` as assets are registered
- Showing a "partial delivery" indicator when received < expected
- Allowing multiple inbounds per order (vehicle returns later with remaining parcels)
- Not blocking the inbound from completing — the tare weighing can happen with fewer parcels than expected

### 4.4 Ad-Hoc / Walk-In Delivery

When a vehicle arrives without a pre-planned order:
1. Operator enters plate → no matches found
2. Operator clicks "Create Ad-Hoc Order"
3. System opens order form with plate pre-filled
4. Operator fills minimum required fields (supplier, carrier, waste stream)
5. For private individuals: capture contact name and ID reference
6. Order created with `is_adhoc=true`, status PLANNED
7. Immediately create inbound against it → proceed with weighing

### 4.5 Manual Weighing Fallback

When the weighbridge system is unavailable:
1. Normal weighing request fails
2. System opens manual entry dialog
3. Operator enters: weight (kg), reason (from dropdown), is_tare flag
4. System creates Weight Ticket with `is_manual=true`
5. Automatic notification sent to admins
6. Weight ticket clearly marked as manually entered in all views and PDFs
7. Requires supervisor confirmation before the inbound can complete

### 4.6 Weight Override / Amendment

When a recorded weight needs correction (calibration error, misread, etc.):

**If ticket is NOT yet confirmed**:
- Admin can directly update the weight
- Creates audit log entry

**If ticket IS confirmed** (immutable):
- System creates a new amended ticket (e.g., T-12345 → T-12345-A1)
- Creates a Weight Amendment record linking original → amended
- Original ticket preserved for audit trail
- All asset weights automatically recalculated

### 4.7 Incident Reporting

At any point during ARRIVED, WEIGHED_IN, or WEIGHED_OUT:
- Operator selects incident category: DAMAGE, DISPUTE, SPECIAL_HANDLING, DRIVER_INSTRUCTION
- Enters description in notes field
- System saves and shows incident badge on the inbound
- DAMAGE and DISPUTE incidents trigger automatic notifications to logistics planner and finance

---

## 5. Integration Points

### 5.1 Weighbridge / Scale System (Required)

The most critical integration. The inbound module must communicate with a physical weighbridge to get vehicle weights.

**Interface**:
- Request a weighing (type: GROSS/TARE, optional: previous weight for validation)
- Receive: ticket number, weight in kg, timestamp, raw payload
- Handle: timeouts, communication errors, calibration states

**Patterns**:
- Use a gateway/adapter service to isolate weighbridge-specific protocol
- Support manual fallback when the scale is unavailable
- Store the raw payload for compliance (prove the weight came from the scale)
- Support weight confirmation workflow (supervisor review before finalizing)

**Ask the customer**: What weighbridge system do they use? What protocol (serial, TCP/IP, REST API, file-based)? Do they need real-time polling or request/response?

### 5.2 Order Module (Upstream)

The inbound module reads from and writes back to the order module:
- **Reads**: planned orders for plate matching, order details for display
- **Writes**: updates order status (PLANNED → ARRIVED → IN_PROGRESS), updates received parcel count

### 5.3 Sorting / Processing Module (Downstream)

When an inbound reaches READY_FOR_SORTING:
- System auto-creates a sorting session linked to the inbound
- Passes: parcel list with weights, waste stream, container info
- Sorting module takes over from here

### 5.4 Invoice Module (Downstream)

Completed inbounds feed into invoicing:
- Net weights per material type → material fees
- Contamination incidents → penalty line items
- Contract rate tables determine pricing

### 5.5 External Systems

| System | Purpose | Ask the customer |
|--------|---------|-----------------|
| **LMA** (Landelijk Meldpunt Afvalstoffen) | Dutch waste notification system | Do they need LMA integration? Which waste streams require reporting? |
| **ASN** (Advance Shipping Notice) | Pre-arrival notification from supplier | Do suppliers send ASNs? What format (EDI, email, API)? |
| **Barcode / QR scanners** | Container identification | Do they scan container labels? What format? |
| **CCTV / camera systems** | Plate recognition, arrival evidence | Do they want ANPR integration for auto plate entry? |
| **ERP systems** | Master data sync (suppliers, carriers) | Is there an ERP to sync with? What's the source of truth? |

### 5.6 Container / Asset Tracking

Containers may be reusable. The system should:
- Generate unique container labels (e.g., CNT-00001)
- Support scanning existing container labels for reuse
- Auto-populate container properties (type, tare weight) from previous records
- Track container lifecycle across multiple inbounds

---

## 6. Customer-Variable Parts

These are the things that change per customer. **Ask about all of them before starting implementation.**

### 6.1 Material Categories & Waste Streams

Every customer has different waste streams (types of waste they accept). Examples:
- WEEE categories (screens, small appliances, cooling equipment, etc.)
- Mixed waste, construction waste, organic waste
- Hazardous vs. non-hazardous classifications

**Ask**: What waste streams do they handle? What classification system do they use? Do waste streams map to regulatory categories?

### 6.2 Container Types & Default Tare Weights

Different facilities use different container types with different weights.

**Example defaults** (waste management):
| Type | Typical Tare Weight |
|------|-------------------|
| Open Top Skip | 300 kg |
| Closed Top Skip | 350 kg |
| Gitterbox (wire cage) | 85 kg |
| Pallet | 25 kg |

**Ask**: What container types do they use? What are the standard tare weights? Do they need a container reuse tracking system?

### 6.3 Max Parcels Per Vehicle

May depend on vehicle type or transport regulations.

**Examples**:
- Standard vehicle: 2 parcels max
- LZV (Long Heavy Vehicle / special transport): 3 parcels max
- Flatbed: 1 parcel

**Ask**: Are there vehicle categories with different parcel limits? Is there a special transport flag?

### 6.4 Quality Inspection Criteria

What counts as contamination and how it's handled varies:
- Moisture thresholds
- Non-target material percentages
- Hazardous material detection
- Visual inspection checklists

**Ask**: What quality checks are performed at receiving? What triggers a contamination incident? Are there contractual thresholds?

### 6.5 Weighing Confirmation Requirements

Some facilities require supervisor confirmation of every weighing. Others only for manual entries or amendments.

**Ask**: Who needs to confirm weighings? All weighings or only exceptions? Is there a time limit for confirmation?

### 6.6 Regulatory Reporting

Country and region-specific waste documentation:
- Netherlands: LMA notification, CBS reporting, afvalstroomnummer
- Germany: eANV (electronic waste tracking)
- UK: Duty of Care waste transfer notes
- EU: WEEE reporting to producer responsibility organizations

**Ask**: What country/region? What regulatory reporting is required? Do they need digital waste transfer notes?

### 6.7 Arrival Matching Algorithm

How vehicles are matched to orders:
- **Plate-based**: Match registration plate to planned orders (most common)
- **ASN-based**: Match advance shipping notice number
- **Time-window**: Match by scheduled time slot
- **Manual only**: Operator always selects manually

**Ask**: How do they currently identify incoming deliveries? Do carriers send advance notice? Is plate recognition available?

### 6.8 Number Formats

Sequential numbering formats for orders, inbounds, assets, tickets:
- Prefix conventions (ORD-, INB-, P-, etc.)
- Year/date inclusion
- Zero-padding width

**Ask**: Do they have existing numbering conventions? Do numbers need to include year or site codes?

---

## 7. Implementation Principles

### 7.1 Component Structure

```
pages/
  inbounds/
    InboundsPage.jsx          # List with filters, search, pagination
  arrival/
    ArrivalPage.jsx           # Plate entry + order matching
  weighing/
    InboundDetailPage.jsx     # Main weighing/parcel workflow

components/
  ui/
    StatusBadge.jsx           # Read-only status display
    ClickableStatusBadge.jsx  # Interactive status transitions
    ProgressBar.jsx           # Step progress indicator
    Breadcrumb.jsx
    RowActionMenu.jsx         # Kebab menu for list actions

api/
  inbounds.js                 # All inbound API client functions
  orders.js                   # Order API (including plate matching)
  assets.js                   # Asset/container API

store/
  inboundsStore.js            # List state (filters, pagination, data)
```

### 7.2 State Management

- **List pages**: Zustand store for filters, pagination state, and fetched data. Allows navigating away and back without losing filters.
- **Detail/form pages**: Local component state. The data is specific to one inbound and doesn't need to be shared.
- **Never put weighing flow state in a global store** — it's complex, transient, and specific to one session.

### 7.3 API Design

- RESTful endpoints: `GET /api/inbounds`, `POST /api/inbounds/:id/weighing`, etc.
- **Thin controllers**: Parse request, call service, return response. No business logic.
- **Fat services**: All business logic, validation, state transitions, audit logging.
- **Prisma transactions**: Every mutation that touches multiple tables must be in a transaction.
- **Audit logging**: Every mutation writes to the audit log. No exceptions. Include before/after state.

### 7.4 Status as State Machine

Implement status transitions as an explicit state machine, not ad-hoc `if` checks:

```javascript
const VALID_TRANSITIONS = {
  ARRIVED:            ['WEIGHED_IN'],
  WEIGHED_IN:         ['WEIGHED_OUT'],
  WEIGHED_OUT:        ['READY_FOR_SORTING'],
  READY_FOR_SORTING:  ['SORTED'],
  SORTED:             [],
};

function canTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to);
}
```

Separate **automatic transitions** (triggered by operations like weighing) from **manual transitions** (user clicks a button). Only manual transitions should appear in the ClickableStatusBadge dropdown.

### 7.5 Enrichment Pattern

When returning an inbound from the API, enrich it with computed properties that the frontend needs:

```javascript
function enrichInbound(inbound) {
  const weighingCount = inbound.weighings.length;
  const assetCount = inbound.assets.length;
  const maxParcels = inbound.order.is_special_transport ? 3 : 2;
  
  return {
    ...inbound,
    can_weigh_first: inbound.status === 'ARRIVED' && weighingCount === 0,
    can_register_parcel: inbound.status === 'WEIGHED_IN' && weighingCount > assetCount,
    can_weigh_next: inbound.status === 'WEIGHED_IN' && weighingCount === assetCount && assetCount < maxParcels,
    can_weigh_tare: inbound.status === 'WEIGHED_IN' && assetCount >= 1 && weighingCount === assetCount,
    max_parcels: maxParcels,
    has_excess_weighing: weighingCount > assetCount && assetCount >= maxParcels,
  };
}
```

This keeps the frontend simple — it just reads flags instead of reimplementing business logic.

### 7.6 Weight Immutability

Once a weight ticket is confirmed (`is_confirmed = true`), the original record is immutable. Any corrections must go through the amendment flow, which creates a new ticket and an amendment record. This is non-negotiable for regulatory compliance.

### 7.7 Weight Recalculation

After any weighing operation (new weighing, override, amendment), recalculate ALL asset weights in the inbound from scratch. Don't try to incrementally update — it's error-prone. The recalculation function should:
1. Get all weighings ordered by sequence
2. For each asset, find its gross weighing (by sequence) and tare weighing
3. Calculate net = gross − tare
4. Update the asset
5. Update the inbound totals

### 7.8 Internationalization

Build with i18n from day one. The inbound module has many user-facing labels that must be translatable:
- Status names, button labels, column headers, tooltips, toast messages
- Date/time formatting (locale-aware)
- Number formatting (decimal separator, thousands separator)
- Currency display for contamination fees

---

## 8. Common Mistakes & Lessons Learned

### Architecture & Data

1. **Don't store weights only on the inbound — track them per parcel too.** A vehicle may carry multiple parcels of different materials. You need per-parcel weights for accurate invoicing and reporting.

2. **Don't use a single weighing record per inbound.** The sequential weighing model (one record per scale interaction) is essential for audit trail and for supporting intermediate weighings.

3. **Don't compute net weight on the fly without persisting it.** Store gross, tare, AND net on every entity. Recalculate and persist on every change. Floating-point drift and rounding issues will cause discrepancies between views.

4. **Don't let the frontend compute business-critical values.** Enrich on the backend, consume on the frontend. Weight calculations, status transition rules, and parcel limits should never be reimplemented in the UI.

### UI / UX

5. **Don't use popups/modals for the weighing detail page.** This page has too many sections and states. It needs a full-page layout with clear sections. Use modals only for confirmations, manual entry dialogs, and weight overrides.

6. **Don't show raw enum values in the UI.** Always create a labels map. `WEIGHED_IN` → "Weighing In Progress", `OPEN_TOP` → "Open Top", etc.

7. **Don't make non-clickable text look clickable.** If an identifier (inbound number, parcel label) doesn't navigate anywhere, don't color it green/blue. Use neutral dark text with font-weight.

8. **Status transitions should happen via the status badge, not separate buttons.** Don't add "Terminate", "Deactivate", or "Complete" buttons. The status badge is the single interaction point for status changes.

9. **The weighing detail page layout should be two-column on desktop**: weighing controls on the left, parcels table on the right. Single-column on mobile.

10. **Debounce search inputs** (300ms is a good default). The inbound list and plate matching both trigger API calls on input change.

### Workflows

11. **Don't skip the 1:1 rule between weighings and parcels.** It's tempting to simplify, but the alternating pattern ensures every parcel has a corresponding weight measurement. Breaking this rule breaks the audit trail.

12. **Always handle the "scale unavailable" case.** Weighbridges go offline. The manual fallback flow must exist from day one, not as an afterthought.

13. **Don't forget the tare weighing "excess" edge case.** When all parcels are registered and one extra weighing exists without a corresponding parcel, the operator needs a "Finalize Tare" button to recover.

14. **Arrival matching should be scored and categorized, not just a flat list.** Show same-day exact matches separately from ±7-day matches and manual overrides. Operators need confidence levels.

### Cross-Module Consistency

15. **When you fix a pattern in one list page, fix it in ALL list pages.** Same padding, same font, same empty-value character (em-dash), same status column position. Don't let pages diverge.

16. **Add and Edit must use the same form/pattern.** If creation is a full page, editing must be a full page. Never mix popup-for-create with page-for-edit.

17. **Every entity list should follow the same structure**: status in column 2, kebab action menu in the last column, consistent padding and typography.

---

## 9. Reference: Statice Implementation

> **WARNING: This section is a specific implementation example. It should not be copied as-is into new projects — adapt it to your own project's requirements and customer needs.**

### Tech Stack
- Frontend: React 18, React Router v6, Tailwind CSS, shadcn/ui, Zustand
- Backend: Node.js, Express.js, Prisma ORM
- Database: PostgreSQL
- Auth: JWT (access token in memory, refresh token HttpOnly cookie)
- Weighbridge: Pfister simulator (gateway service pattern)
- PDF: PDFKit

### File Locations

| Component | Path |
|-----------|------|
| Inbound list page | `client/src/pages/inbounds/InboundsPage.jsx` |
| Arrival page | `client/src/pages/arrival/ArrivalPage.jsx` |
| Weighing detail page | `client/src/pages/weighing/WeighingEventPage.jsx` |
| Inbound API client | `client/src/api/weighingEvents.js` |
| Inbound Zustand store | `client/src/store/weighingStore.js` |
| Inbound routes | `server/src/routes/weighingEvents.js` |
| Inbound controller | `server/src/controllers/weighingEventsController.js` |
| Inbound service (1044 lines) | `server/src/services/inboundService.js` |
| Order service (plate matching) | `server/src/services/orderService.js` |
| Arrival controller | `server/src/controllers/arrivalController.js` |
| Weight ticket PDF | `server/src/services/ticketGenerator.js` |
| Pfister gateway | `server/src/services/pfisterSimulator.js` |
| Prisma schema | `server/prisma/schema.prisma` |

### Statice-Specific Constants

```javascript
// Container types and default tare weights (kg)
CONTAINER_TARE_WEIGHTS = {
  OPEN_TOP: 300,
  CLOSED_TOP: 350,
  GITTERBOX: 85,
  PALLET: 25,
  OTHER: 0,
};

// Max parcels per vehicle
STANDARD_VEHICLE: 2
LZV_VEHICLE: 3

// Number formats
ORDER:   "ORD-NNNNN"
INBOUND: "INB-NNNNN"
ASSET:   "P-NNNNN"
CONTAINER: "CNT-NNNNN"
CONTAMINATION: "CON-NNNNN"
PFISTER_TICKET: "PF-YYYY-NNNNNN"
MANUAL_TICKET: "MAN-{timestamp}"

// Plate matching window: ±7 days from today
// Plate matching scoring: EXACT_SAME_DAY=100, EXACT_WINDOW=80-dayDelta, MANUAL=20-dayDelta
```

### Statice API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/inbounds` | List inbounds (paginated, filterable) |
| GET | `/api/inbounds/:id` | Get inbound with full enrichment |
| POST | `/api/inbounds` | Create inbound on arrival |
| PATCH | `/api/inbounds/:id/status` | Transition inbound status |
| POST | `/api/inbounds/:id/weighing` | Trigger sequential weighing |
| POST | `/api/inbounds/:id/parcels` | Register parcel/asset |
| POST | `/api/inbounds/:id/weight-override` | Override weight (admin) |
| PATCH | `/api/inbounds/:id/incident` | Set incident category |
| POST | `/api/inbounds/:id/weighing/:seq/confirm` | Confirm weighing ticket |
| GET | `/api/inbounds/:id/weighing/:seq/amendments` | Get amendment history |
| GET | `/api/inbounds/:id/ticket/pdf` | Download weight ticket PDF |
| GET | `/api/inbounds/asset-lookup` | Lookup asset by label |
| GET | `/api/orders/match-plate` | Match vehicle plate to orders |
| POST | `/api/orders/adhoc-arrival` | Create ad-hoc order |

### Statice Inbound Status Colors

| Status | Background | Text | Border |
|--------|-----------|------|--------|
| ARRIVED | blue-25 | blue-700 | blue-300 |
| WEIGHED_IN | blue-25 | blue-700 | blue-300 |
| WEIGHED_OUT | purple-25 | purple-700 | purple-300 |
| READY_FOR_SORTING | orange-25 | orange-700 | orange-300 |
| SORTED | green-25 | green-700 | green-400 |

### Statice Incident Categories

| Category | When used |
|----------|----------|
| DAMAGE | Physical damage to cargo or container |
| DISPUTE | Supplier/carrier claim or disagreement |
| SPECIAL_HANDLING | Requires non-standard processing |
| DRIVER_INSTRUCTION | Special instructions from the driver |

DAMAGE and DISPUTE incidents auto-notify LOGISTICS_PLANNER and FINANCE_MANAGER roles.
