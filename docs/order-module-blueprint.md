# Order Module Blueprint

> **Purpose:** Reusable product blueprint for building an Order module in waste management / MRF projects.
> When starting a new customer project, read this document to understand what to build, how to structure it, and what questions to ask about customer-specific customizations.

---

## 1. What the Order Module Does

### Business Problem

A Material Recovery Facility (MRF) or waste processing plant receives dozens to hundreds of deliveries per day. Without a structured order system, the facility cannot:

- **Plan capacity** — know what is arriving, when, and how much
- **Match arrivals to contracts** — verify that incoming material matches commercial agreements
- **Track chain of custody** — prove where material came from, who transported it, and what happened to it
- **Invoice accurately** — connect delivered material to contract rates for billing
- **Handle exceptions** — manage disputes, contamination, damage, and unplanned arrivals

The Order module is the **central scheduling and tracking entity** that connects suppliers (who send material), carriers (who transport it), and material/waste streams (what is being delivered).

### Who Uses It

| Role | What They Do |
|------|-------------|
| **Logistics Planner** | Creates orders, schedules deliveries, manages the planning board, resolves disputes |
| **Gate Operator** | Matches arriving vehicles to planned orders, creates ad-hoc orders for unplanned arrivals, reports incidents |
| **Admin** | Full access — create, edit, cancel, delete orders; manage all workflows |
| **Finance** | Views completed/invoiced orders; receives incident notifications for dispute resolution |

### What It Produces

- A **planned delivery schedule** that downstream modules (gate, weighing, sorting) can consume
- **Arrival matching** — links physical vehicle arrivals to planned orders
- **Completion data** — feeds invoicing, reporting, and compliance modules
- **Audit trail** — every order mutation is logged for regulatory compliance

---

## 2. Standard Data Model

### Core Entity: Order

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Primary key |
| `order_number` | String (unique) | Auto | Human-readable identifier (e.g., ORD-00001) |
| `supplier_id` | FK → Supplier | Yes | Who is sending the material |
| `carrier_id` | FK → Carrier | Yes | Who is transporting the material |
| `primary_material_stream_id` | FK → MaterialStream | Yes | Main material/waste type |
| `planned_date` | Date | Yes | Expected delivery date |
| `planned_time_window_start` | DateTime | No | Earliest expected arrival |
| `planned_time_window_end` | DateTime | No | Latest expected arrival |
| `expected_asset_count` | Integer (default: 1) | Yes | Number of containers/loads expected |
| `received_asset_count` | Integer (default: 0) | Tracked | Number of containers actually received |
| `vehicle_plate` | String | Recommended | Vehicle registration for arrival matching |
| `status` | Enum | Yes | Current lifecycle status (see Section 4) |
| `is_adhoc` | Boolean (default: false) | Yes | Whether this was an unplanned arrival |
| `is_large_vehicle` | Boolean (default: false) | No | Flag for oversized vehicles (customer-specific) |
| `client_reference` | String | No | Customer/supplier PO or reference number |
| `notes` | Text | No | Free-form notes |
| `incident_category` | Enum | No | Incident type if flagged (DAMAGE, DISPUTE, etc.) |
| `incident_notes` | Text | No | Incident description |
| `created_by` | FK → User | Yes | Who created the order |
| `created_at` | DateTime | Auto | Creation timestamp |
| `updated_at` | DateTime | Auto | Last update timestamp |

**Ad-hoc-specific fields** (only populated for unplanned arrivals):

| Field | Type | Description |
|-------|------|-------------|
| `adhoc_contact_name` | String | Name of the person delivering |
| `adhoc_id_reference` | String | ID document reference |

### Junction Entity: OrderMaterialStream

Allows one order to carry multiple material/waste streams.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `order_id` | FK → Order | Parent order |
| `material_stream_id` | FK → MaterialStream | Material/waste stream |
| `tracking_number` | String (optional) | Domain-specific tracking number per stream |

**Unique constraint:** `(order_id, material_stream_id)`

### Relationships

```
Order
  ├── Supplier (M:1) — who sends the material
  ├── Carrier (M:1) — who transports it
  ├── MaterialStream (M:1) — primary stream
  ├── OrderMaterialStream[] (1:M) — all streams on this order
  ├── User (M:1) — created_by
  ├── Inbound[] (1:M) — physical arrival records
  ├── InvoiceLine[] (1:M) — billing line items
  └── Incident[] (1:M) — contamination/damage events
```

### Computed Fields (NOT stored — derived at read time)

| Field | Derivation |
|-------|-----------|
| `remaining_asset_count` | `max(0, expected_asset_count - received_asset_count)` |
| `is_partial_delivery` | `received_asset_count > 0 && received_asset_count < expected_asset_count` |

---

## 3. Standard Screens and UI Components

### 3.1 Order List Page

**Route:** `/orders`
**Access:** Planner, Admin

**Layout:**
- **Tabs:** "All Orders" (no date filter) | "Today" (filters to current date)
- **Search bar:** Search by order number (debounced, 300ms)
- **Filters:** Status dropdown, date range (optional)
- **Table columns:**
  1. Order # (clickable → detail page)
  2. Status (colored badge, clickable for transitions)
  3. Vehicle Plate
  4. Carrier
  5. Supplier (with type badge)
  6. Material Stream
  7. Planned Date
  8. Expected Assets
- **Pagination:** Page selector + items-per-page (10/20/50)
- **Actions:** Create Order button (role-gated)

### 3.2 Order Detail Page

**Route:** `/orders/:id`
**Access:** Planner, Admin

**Layout:**
- **Header:** Order number + status badge (clickable for transitions) + action menu (Edit, Cancel)
- **Info grid** (2-column on mobile, 4-column on desktop):
  - Carrier, Supplier (with type badge), Material Streams, Planned Date
  - Expected Assets, Vehicle Plate, Client Reference, Notes
  - Created By, Linked Contract (clickable link)
- **Incident section:** Category selector + notes input + Report button (hidden if COMPLETED/INVOICED)
- **Inbounds section:** Table of physical arrival records linked to this order (inbound number, status, vehicle, arrival time, material stream)

### 3.3 Order Create Page

**Route:** `/orders/new`
**Access:** Planner, Admin

**Full-page form with sections:**

1. **Parties:** Supplier dropdown, Carrier dropdown → triggers contract auto-lookup
2. **Material:** Multi-select for material streams (populated from matched contract if found). Shows contract match status banner.
3. **Scheduling:** Planned date (required), Time window start/end (optional), Vehicle plate
4. **Logistics:** Expected asset count, Large vehicle checkbox
5. **Reference:** Client reference, Notes

**Validation:** At least one material stream required. Vehicle plate recommended. Planned date cannot be in the past for new orders.

**Contract auto-matching:** When both supplier and carrier are selected, the system looks up active contracts to:
- Populate available material streams
- Pre-fill tracking numbers from contract configuration
- Show match status (green = found, red = no match)

### 3.4 Order Edit

**Same form as create,** pre-populated with existing data. Only available when order status is PLANNED. Uses the same route pattern: `/orders/:id/edit`.

> **Rule:** If Create is a full page, Edit must also be a full page. Never mix page/modal patterns for the same entity.

### 3.5 Planning Board Page

**Route:** `/planning`
**Access:** Planner, Gate Operator, Admin

**Layout:**
- **Date navigation:** Previous / Today / Next buttons
- **Filters:** Carrier, Supplier, Supplier Type, Material Stream, Status (all multi-select)
- **Card grid** (responsive: 1→3 columns):
  - Order number (clickable), Status badge
  - Time window badge
  - Carrier, Supplier, Material Stream
  - Expected assets, Completed inbounds counter ("X / Y")
  - Total net weight (if available)
  - Vehicle plate
  - Incident indicator (if flagged)
- **Summary footer:** "X deliveries for [date]"

### 3.6 Reusable Order Form Modal

A modal version of the order form, used for:
- **Ad-hoc arrival flow:** Gate operator creates an order from the arrival screen
- **Quick edit:** When inline editing is sufficient

Supports 3 modes: `create`, `edit`, `adhoc` — each shows/hides relevant fields.

### Component Library Requirements

| Component | Purpose |
|-----------|---------|
| `StatusBadge` | Color-coded status display |
| `ClickableStatusBadge` | Badge + dropdown for status transitions |
| `FilterBar` | Reusable row of filter dropdowns |
| `PaginatedTable` | Table with pagination controls |
| `InfoGrid` | Two/four-column label-value display |
| `DatePicker` | Date + optional time window inputs |
| `MultiSelect` | Checkbox-based multi-select dropdown |

---

## 4. Standard Workflows

### 4.1 Status State Machine

```
PLANNED ──────→ ARRIVED ──────→ IN_PROGRESS ──────→ COMPLETED ──────→ INVOICED
   │               │                  │                                  (terminal)
   │               │                  │
   │               ├──→ DISPUTE ──────┤
   │               │       ↑          │
   │               │       └──────────┘
   │               │
   ├──→ CANCELLED ←┤←─────────────────┘
   ↑                                   
   └──────── (reactivation) ──────────┘
```

**Transition table:**

| From | Allowed To |
|------|-----------|
| PLANNED | ARRIVED, CANCELLED |
| ARRIVED | IN_PROGRESS, DISPUTE, CANCELLED |
| IN_PROGRESS | COMPLETED, DISPUTE, CANCELLED |
| DISPUTE | IN_PROGRESS, COMPLETED, CANCELLED |
| COMPLETED | INVOICED |
| INVOICED | *(terminal — no transitions)* |
| CANCELLED | PLANNED *(reactivation)* |

**Implementation:** A standalone utility file (`orderStateMachine.js`) with:
- `canTransition(from, to)` → boolean
- `getAllowedTransitions(from)` → string[]

Server enforces transitions. UI reads allowed transitions to render available actions.

### 4.2 Normal Order Flow

1. Planner creates order → status: **PLANNED**
2. Vehicle arrives at gate, operator matches plate → status: **ARRIVED**
3. Vehicle goes to scale for weighing → status: **IN_PROGRESS**
4. All material weighed and sorted → status: **COMPLETED**
5. Finance generates invoice → status: **INVOICED**

### 4.3 Ad-hoc Arrival Flow

1. Vehicle arrives without a planned order
2. Gate operator enters vehicle plate → no match found
3. Operator creates ad-hoc order (minimal info: supplier, carrier, material, vehicle plate)
4. System creates order (`is_adhoc: true`) + immediate inbound record in one transaction
5. Notifications sent to all Planners
6. Flow continues as normal from step 3 above

### 4.4 Vehicle Plate Matching

When a vehicle arrives, the system searches for matching orders:

| Tier | Criteria | Score |
|------|----------|-------|
| **Exact + Same Day** | Plate matches AND planned_date = today | 100 |
| **Exact + Window** | Plate matches AND planned_date within ±N days | 80 - day_delta |
| **Manual Override** | All active orders in window (no plate match) | 20 - day_delta |

- Search window: ±7 days (configurable per customer)
- Only orders in active statuses: PLANNED, ARRIVED, IN_PROGRESS, DISPUTE
- Returns ranked candidates for operator selection
- If no match and no suitable candidate → offer ad-hoc creation

### 4.5 Cancellation Flow

- Allowed from: PLANNED, ARRIVED, IN_PROGRESS, DISPUTE
- CANCELLED orders can be **reactivated** back to PLANNED
- Reactivation should clear incident fields
- Cancellation writes audit log entry

### 4.6 Partial Delivery

- Order expects N assets, but only M arrive (M < N)
- Track via `expected_asset_count` vs `received_asset_count`
- Compute `remaining_asset_count` and `is_partial_delivery` server-side (not stored)
- UI shows progress: "M / N received"

### 4.7 Incident Handling

- Gate operator or admin reports an incident on an order
- Categories: DAMAGE, DISPUTE, CONTAMINATION, SPECIAL_HANDLING (customer-configurable)
- **Auto-transition:** Certain categories (e.g., DAMAGE, DISPUTE) automatically move the order to DISPUTE status
- Notifications sent to Planners and Finance on incident creation
- Incident details visible on order detail page

### 4.8 Contract Auto-Match on Completion

When an order transitions to COMPLETED:
1. System queries all materials found during sorting
2. For each material, looks up active contract rate lines for the supplier
3. Stores matched rate information for invoicing
4. Logs each match in audit trail

---

## 5. Integration Points

### 5.1 Inbound / Receiving Module

| Direction | What | When |
|-----------|------|------|
| Order → Inbound | `order_id` FK on inbound record | Inbound created on vehicle arrival |
| Inbound → Order | Update `received_asset_count` | As assets are received and weighed |
| Read | Order detail shows linked inbounds | Always |

An order can have **multiple inbound records** (e.g., a vehicle makes two trips, or multiple vehicles for one order).

### 5.2 Contract Module

| Direction | What | When |
|-----------|------|------|
| Contract → Order | Available material streams + tracking numbers | During order creation (auto-lookup) |
| Order → Contract | Rate line matching for invoicing | On COMPLETED transition |
| Read | Order detail shows linked contract | Always |

Auto-lookup criteria: supplier + carrier + date within contract validity period.

### 5.3 Invoice Module

| Direction | What | When |
|-----------|------|------|
| Order → Invoice | Order data feeds invoice line items | COMPLETED → INVOICED transition |
| Invoice → Order | Status updated to INVOICED | On invoice finalization |

### 5.4 Reports

Orders feed into these standard report types:

| Report | Order Data Used |
|--------|----------------|
| **Daily Delivery** | Order #, Supplier, Carrier, Vehicle, Assets, Weights, Material Stream |
| **Chain of Custody** | Order Reference, Delivery Date, Vehicle, Carrier, Supplier, Net Weight |
| **Material Recovery** | Orders as source for material flow tracking |
| **Circularity Statement** | Per-supplier recycling/reuse/disposal percentages |

### 5.5 Notification System

| Event | Who Gets Notified |
|-------|------------------|
| Incident reported (DAMAGE/DISPUTE) | Planners, Finance |
| Ad-hoc arrival created | Planners |

### 5.6 Audit Log

**Every mutation** writes to the audit log:

| Action | Logged Data |
|--------|------------|
| CREATE | Full order snapshot (after) |
| UPDATE | Before + after diff |
| CANCEL | Before + after with status change |
| INCIDENT | Incident fields + status change if applicable |
| CONTRACT_MATCH | Matched contract and rate line details |

### 5.7 External Systems (Customer-Dependent)

| System | Integration Type | Description |
|--------|-----------------|-------------|
| **ERP** | Import/Export | Order data synced to/from customer ERP |
| **Waste Registry** (e.g., LMA in NL) | Export | Regulatory reporting of waste movements |
| **ASN / Tracking** | Lookup | Domain-specific tracking numbers per material stream |
| **Scale System** | Read | Weighing data linked via inbound records |

---

## 6. Customer-Variable Parts

These are the **configuration points** that change per customer. When starting a new project, ask about each:

| Configuration Point | Default / Recommendation | Example Variations |
|---------------------|--------------------------|-------------------|
| **Order number format** | `ORD-NNNNN` (zero-padded sequential) | `WO-YYYYMMDD-NNN`, `INB-NNNNN`, `DEL-NNNNN` |
| **Material classification name** | "material_stream" | "waste_stream", "commodity", "waste_category", "material_type" |
| **Domain tracking number** | Optional per-stream field | NL: "afvalstroomnummer", UK: waste transfer note, DE: Entsorgungsnachweis |
| **Supplier type taxonomy** | Generic (no subtypes) | PRO / Third Party / Private Individual; Commercial / Municipal / Residential |
| **Supplier validation rules** | None beyond existence check | PRO suppliers must have registered tracking numbers |
| **Vehicle classification flag** | `is_large_vehicle` (boolean) | NL: LZV flag, AU: B-double, specific vehicle type enum |
| **Incident categories** | DAMAGE, DISPUTE, CONTAMINATION, SPECIAL_HANDLING | Customer-specific enum, may include DRIVER_INSTRUCTION, REGULATORY, etc. |
| **Roles and permissions** | Admin, Planner, Gate Operator | Customer role names and granularity vary |
| **Planning board grouping** | By time window | By carrier, by material stream, by zone, by dock |
| **Plate match window** | ±7 days | Customer-configurable (±3, ±14, etc.) |
| **Asset terminology** | "assets" / "containers" | "skips", "parcels", "bins", "loads", "roll-offs" |
| **Status labels** | English defaults | Customer language + branding |
| **Auto-transition rules** | DAMAGE/DISPUTE → DISPUTE status | Customer may want different auto-transitions |
| **Regulatory fields** | None by default | Country-specific waste codes, transport documents, environmental permits |
| **Approval workflows** | None (direct status transitions) | Some customers need manager approval for cancellation or completion |
| **Working hours / scheduling** | No constraints | Some facilities have receiving windows, dock assignments |

### Questions to Ask the Customer

1. What do you call your deliveries? (orders, work orders, delivery notes, tickets)
2. What material classification system do you use? Do streams have regulatory tracking numbers?
3. What supplier types do you distinguish? Any special validation per type?
4. What vehicle types matter for your operation? Any oversized vehicle flags?
5. What incident categories are relevant? Which should auto-change order status?
6. What roles exist in your organization? Who can create/edit/cancel orders?
7. Do you need approval workflows for any status transitions?
8. What external systems need to send or receive order data?
9. What regulatory reporting requirements apply? (waste transfer notes, manifests, etc.)
10. How far in advance are deliveries typically planned? (affects plate match window)

---

## 7. Implementation Principles

### 7.1 Backend Architecture

```
Route (HTTP layer)
  → Controller (request validation, response formatting)
    → Service (business logic, transactions)
      → Prisma (data access)
        → Database
```

**Rules:**
- **Controllers stay thin.** Validate input, call service, format response. No business logic.
- **Services own business logic.** Status transitions, validation, enrichment, notifications.
- **Every mutation in a transaction.** Order + junction table + audit log = single `prisma.$transaction()`.
- **State machine is a standalone utility.** Imported by the service, never bypassed.
- **Audit log writes inside the transaction.** If the mutation fails, the audit entry rolls back too.
- **Order number generation inside the transaction.** Prevents race conditions on concurrent creates.

### 7.2 API Design

```
GET    /orders                    — List with query params (status, search, page, limit, date_from, date_to)
GET    /orders/:id                — Detail with full relations
POST   /orders                    — Create
PUT    /orders/:id                — Update (fields and/or status transition)
DELETE /orders/:id                — Cancel (soft — sets status to CANCELLED)

GET    /orders/match-plate        — Vehicle plate matching (query: plate)
POST   /orders/adhoc-arrival      — Create ad-hoc order + immediate inbound
GET    /orders/planning-board     — Daily planning view (query: date, filters)
POST   /orders/:id/incident       — Report incident on order
```

**Pagination:** Server-side. Default `limit: 20`, max `100`. Return `{ data: [], total: N }`.

**Error responses:**
- `400` — Validation error (missing fields, invalid data)
- `404` — Order not found
- `409` — Invalid status transition
- `403` — Insufficient role permissions

### 7.3 Frontend Architecture

**State management (Zustand):**
```javascript
// One store per module
{
  orders: [],              // List data
  totalCount: 0,           // For pagination
  currentOrder: null,      // Detail view
  filters: {               // Persisted filter state
    status: '',
    search: '',
    page: 1,
    limit: 20,
    date_from: '',
    date_to: ''
  },
  loading: false,
  error: null,

  // Actions
  setFilters(partial),     // Merge filters, auto-reset page to 1
  clearFilters(),
  fetchOrders(),           // GET list with current filters
  fetchOrder(id),          // GET detail
  createOrder(data),       // POST
  updateOrder(id, data),   // PUT
  cancelOrder(id),         // DELETE
}
```

**API layer:** Separate file (`api/orders.js`) wrapping HTTP calls. One function per endpoint. Returns parsed data or throws.

**i18n:** One JSON file per locale per module (`i18n/en/orders.json`). All user-visible strings externalized. Include: field labels, status labels, toast messages, validation messages, empty states.

**Component patterns:**
- Status badges: color-coded with a LABELS map (never show raw enum values in UI)
- Filter changes reset pagination to page 1
- Debounce search input (300ms)
- Loading states on every async operation
- Empty states with helpful messages
- Toast notifications for all CRUD results

### 7.4 Enrichment Pattern

Computed fields are **derived at read time**, not stored:

```javascript
function enrichOrder(order) {
  return {
    ...order,
    expected_asset_count: order.expected_asset_count ?? order.expected_skip_count ?? 1,
    remaining_asset_count: Math.max(0, order.expected_asset_count - order.received_asset_count),
    is_partial_delivery: order.received_asset_count > 0 && order.received_asset_count < order.expected_asset_count,
  };
}
```

Call `enrichOrder()` in the service layer before returning data to the controller. This keeps the database schema clean and avoids sync issues.

---

## 8. Common Mistakes and Things to Watch Out For

### 8.1 Bypassing the State Machine

**Problem:** Directly writing status to the database without checking `canTransition()`.
**Fix:** Always call `canTransition(currentStatus, newStatus)` before any status update. Return 409 Conflict if invalid.

### 8.2 Order Number Collisions

**Problem:** Generating order numbers outside a transaction, leading to duplicates under concurrent requests.
**Fix:** Generate inside `prisma.$transaction()`. Use a counter table or DB sequence, not timestamp-based generation.

### 8.3 Forgetting Transaction Boundaries

**Problem:** Creating the order succeeds, but the junction table or audit log write fails — leaving inconsistent data.
**Fix:** Wrap Order + OrderMaterialStream + AuditLog writes in a single `$transaction()`. No exceptions.

### 8.4 Storing Computed Fields

**Problem:** Storing `remaining_asset_count` or `is_partial_delivery` as database columns. They drift out of sync.
**Fix:** Compute in an `enrichOrder()` function on read. Never store derived values.

### 8.5 Plate Matching Performance

**Problem:** The ±7 day window query scans too many rows without proper indexing.
**Fix:** Create a composite index on `(vehicle_plate, planned_date, status)`.

### 8.6 Missing Ad-hoc Notifications

**Problem:** Ad-hoc orders created by gate operators without notifying planners. Planners don't know about unplanned arrivals.
**Fix:** Always send notifications to Planner role on ad-hoc creation. Include this in the transaction.

### 8.7 Premature Contract Matching

**Problem:** Auto-matching contract rate lines on ARRIVED or IN_PROGRESS status, before sorting is complete.
**Fix:** Only match on COMPLETED transition, when full material data is available.

### 8.8 Junction Table Sync

**Problem:** Diffing material streams on update (add new, remove old) leads to complex, error-prone logic.
**Fix:** Delete-all-and-recreate inside the transaction. Simpler and equally performant for small junction tables.

### 8.9 Terminal Status Not Protected

**Problem:** INVOICED orders can be edited or status-transitioned.
**Fix:** INVOICED is terminal — reject ALL updates. CANCELLED → PLANNED reactivation should clear incident fields.

### 8.10 Filter State and Pagination

**Problem:** User changes a filter but pagination stays on page 3 → empty results.
**Fix:** Every filter change must reset `page` to 1. Implement this in the `setFilters()` action.

### 8.11 Showing Raw Enum Values in UI

**Problem:** Displaying `IN_PROGRESS`, `THIRD_PARTY`, `SPECIAL_HANDLING` directly to users.
**Fix:** Create a LABELS map for every enum. Map raw values to human-readable strings. Always.

### 8.12 Inconsistent Create/Edit Patterns

**Problem:** Create is a full page, Edit is a modal (or vice versa). Fields differ between them.
**Fix:** Create and Edit must use the same component and the same route pattern (`/orders/new` and `/orders/:id/edit`).

---

## 9. Reference: Statice Implementation

> **WARNING:** This section is a specific implementation example from the Statice MRF project. It should NOT be copied as-is into new projects — adapt it to your own project's requirements and customer needs.

### Concept Mapping

| Generic Concept | Statice Implementation |
|-----------------|----------------------|
| Order entity | `InboundOrder` (Prisma model) |
| Material stream | `WasteStream` + junction `OrderWasteStream` |
| Domain tracking number | `afvalstroomnummer` (Dutch waste stream registration number) |
| Supplier validation | PRO suppliers must have registered afvalstroomnummers |
| Vehicle flag | `is_lzv` (Dutch "Lange Zware Voertuig" — long heavy vehicle) |
| Asset terminology | "skip count" / "parcels" |
| Order number format | `ORD-NNNNN` via `generateOrderNumber()` |
| Supplier types | PRO, THIRD_PARTY, PRIVATE_INDIVIDUAL |
| Incident categories | DAMAGE, DISPUTE, SPECIAL_HANDLING, DRIVER_INSTRUCTION |

### File Map

| Layer | File |
|-------|------|
| Prisma schema | `server/prisma/schema.prisma` (InboundOrder + OrderWasteStream) |
| State machine | `server/src/utils/orderStateMachine.js` |
| Order number gen | `server/src/utils/orderNumber.js` |
| Service (business logic) | `server/src/services/orderService.js` |
| Controller | `server/src/controllers/orderController.js` |
| Arrival controller | `server/src/controllers/arrivalController.js` |
| Planning controller | `server/src/controllers/planningController.js` |
| Routes | `server/src/routes/orders.js` |
| API client | `client/src/api/orders.js` |
| Zustand store | `client/src/store/ordersStore.js` |
| List page | `client/src/pages/orders/OrdersPage.jsx` |
| Detail page | `client/src/pages/orders/OrderDetailPage.jsx` |
| Create page | `client/src/pages/orders/OrderCreatePage.jsx` |
| Planning board | `client/src/pages/orders/PlanningBoardPage.jsx` |
| Form modal | `client/src/components/orders/OrderFormModal.jsx` |
| i18n (EN) | `client/src/i18n/en/orders.json` |
| i18n (NL) | `client/src/i18n/nl/orders.json` |
| Tests | `server/src/__tests__/orders.test.js` |

### Statice-Specific Patterns (Do NOT Copy Blindly)

- **`afvalstroomnummer`** — Netherlands-specific regulatory waste stream registration. Other countries have different tracking systems.
- **`is_lzv`** — Netherlands-specific vehicle classification for long heavy vehicles. Other regions have different oversized vehicle rules.
- **PRO supplier type** and its afvalstroomnummer validation — Statice's specific supplier taxonomy. Other customers may have completely different supplier classifications.
- **Dutch locale** (`nl`) — Customer-specific language. Always ask what locales the new customer needs.
- **"skip count" / "parcels"** — Statice's terminology for containers. Other customers may say "bins", "roll-offs", "loads", etc.

### Key Architectural Decisions in Statice

1. **Contract auto-match on creation AND completion.** On creation: populates available waste streams. On completion: matches rate lines for invoicing. Two different uses of the same contract module.
2. **Plate matching with 3-tier scoring.** Exact+same day (100), Exact+window (80-delta), Manual override (20-delta). Works well for facilities with 50-200 daily deliveries.
3. **Ad-hoc orders create order + inbound atomically.** Single transaction ensures no orphaned records.
4. **Enrichment function pattern.** `enrichOrder()` adds computed fields on every read. Keeps schema clean.
5. **Delete-and-recreate for junction table.** OrderWasteStream synced by deleting all + inserting new on every update. Simple and correct.
