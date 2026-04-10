# Process Module Blueprint

> **Purpose:** This document is a reusable blueprint for building a Process module in any waste management / MRF (Material Recovery Facility) customer project. When starting a new project, read this file to understand what to build, how to structure it, and what questions to ask about customer-specific customizations.

---

## Table of Contents

1. [What the Process Module Does](#1-what-the-process-module-does)
2. [Standard Data Model](#2-standard-data-model)
3. [Standard Screens and UI Components](#3-standard-screens-and-ui-components)
4. [Standard Workflows](#4-standard-workflows)
5. [Integration Points](#5-integration-points)
6. [Customer-Variable Parts](#6-customer-variable-parts)
7. [Implementation Principles](#7-implementation-principles)
8. [Common Mistakes and Things to Watch Out For](#8-common-mistakes-and-things-to-watch-out-for)
9. [Reference: Statice Implementation](#9-reference-statice-implementation)

---

## 1. What the Process Module Does

### Business Problem

After material arrives at a facility and is weighed in, it needs to be **classified, processed, and tracked** through one or more transformation steps until it becomes output material (recyclable fractions, reusable items, or waste). Regulatory bodies require detailed reporting on what went in, what came out, and where it went — with full traceability.

The Process module sits between **Inbound** (receiving and weighing) and **Downstream** (reporting, invoicing, logistics to processors). It is the core value-creation step in any MRF operation.

### What It Receives

- Weighed inbound containers/parcels with known gross, tare, and net weights
- Material type expectations from the inbound order (e.g., "this shipment should contain small household appliances")
- Contract context: which supplier sent it, what recovery rates are expected, what contamination penalties apply

### What It Produces

- A detailed material breakdown: what was actually inside each container
- Output fractions with weights and treatment routes (recycled, reused, disposed)
- Recovery rate calculations per material type
- Contamination incident records with calculated penalties
- Compliance data for environmental reporting (CBS, WEEELABEX, LMA, etc.)
- Data that feeds into invoicing (processing fees, contamination penalties, material value)

### Who Uses It

| Role | What They Do |
|------|-------------|
| **Processing Operator** | Classifies materials, records output fractions and weights, submits completed batches |
| **Quality / Compliance Officer** | Reviews and confirms finalized processing records, ensures regulatory compliance |
| **Administrator** | Reopens confirmed records for corrections, manages master data (materials, fractions, processors) |
| **Finance** | Views contamination penalties for invoicing; consumes recovery data for billing |

### How It Fits in the Flow

```
Inbound (Weighing)
    ↓
    Container with known net weight
    ↓
┌─────────────────────────────────────────┐
│  PROCESS MODULE                         │
│                                         │
│  1. Catalogue: classify what's inside   │
│  2. Process: record output fractions    │
│  3. Finalize: validate weight balance   │
│  4. Confirm: compliance sign-off        │
│  5. Contamination: record quality issues│
└─────────────────────────────────────────┘
    ↓
Downstream (Reports, Invoicing, Processor Transfers)
```

---

## 2. Standard Data Model

### Entity Overview

```
ProcessSession (1:1 with inbound event)
├── CatalogueEntry[] (material classification per container)
│   ├── ProcessingRecord[] (output breakdown per material)
│   │   └── OutcomeLine[] (individual fraction outputs)
│   └── ReusableItem[] (items eligible for reuse)
├── ProcessLine[] (legacy/summary recovery rates)
└── ContaminationIncident[] (quality issues)

MaterialMaster (input material types)
└── MaterialFraction[] ←→ FractionMaster (output fraction types)

Processor (downstream recyclers/reprocessors)
└── ProcessorCertificate
    └── CertificateMaterialScope[]
```

### Core Entities

#### ProcessSession
The top-level container that links an inbound event to its processing work.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| inbound_id | FK (unique) | 1:1 link to the inbound/weighing event |
| order_id | FK | Link to the inbound order |
| recorded_by | FK (User) | Who created the session |
| recorded_at | DateTime | When created |
| status | Enum | PLANNED → COMPLETED |
| catalogue_status | Enum | NOT_STARTED → IN_PROGRESS → COMPLETED |
| processing_status | Enum | NOT_STARTED → IN_PROGRESS → COMPLETED |
| notes | Text? | Free-form notes |

**Key design decisions:**
- 1:1 with inbound event — one session per inbound, always
- Two sub-statuses (catalogue + processing) track progress of the two phases independently
- Session status is derived: it becomes COMPLETED only when both sub-statuses are COMPLETED

#### CatalogueEntry
First phase of processing — classifying what's inside each container.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| session_id | FK | Parent session |
| container_id | FK | Which container this classification is for |
| material_id | FK | What material type was identified |
| weight_kg | Decimal | Weight of this material in the container |
| reuse_eligible_quantity | Int | Number of items eligible for reuse |
| entry_order | Int | Display order |
| notes | Text? | |

**One container can have multiple catalogue entries** — e.g., a skip might contain 60 kg of PCBs and 40 kg of small appliances.

#### ProcessingRecord
Second phase — recording what output fractions were produced from each catalogued material.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| session_id | FK | Parent session |
| container_id | FK | Which container |
| catalogue_entry_id | FK? | Link to catalogue entry |
| material_id | FK | Input material type |
| material_code_snapshot | String | Frozen material code at time of processing |
| material_name_snapshot | String | Frozen material name |
| status | Enum | DRAFT → FINALIZED → CONFIRMED → SUPERSEDED |
| version_no | Int | Version number (increments on reopen) |
| is_current | Boolean | Only the current version is active |
| supersedes_id | FK? | Previous version (self-reference) |
| balance_delta_kg | Decimal | Difference: sum(outcomes) - container net weight |
| finalized_by | FK? | Who finalized |
| finalized_at | DateTime? | When finalized |
| confirmed_by | FK? | Who confirmed (compliance) |
| confirmed_at | DateTime? | When confirmed |
| reason_code | String? | Why it was reopened (if applicable) |
| reason_notes | Text? | |

**Critical design decisions:**
- **Snapshot fields** — freeze material code/name at processing time so reports remain stable even if master data changes later
- **Version tracking** — never delete records; supersede them. This gives a full audit trail
- **Balance tracking** — `balance_delta_kg` is recomputed after every outcome change; must be within tolerance at finalization

#### OutcomeLine
Individual output fractions from processing a material.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| processing_record_id | FK | Parent record |
| fraction_id | FK | Output fraction/material type |
| fraction_label | String | Human-readable fraction name |
| weight_kg | Decimal | Weight of this output |
| share_pct | Decimal | % of container weight this represents |
| treatment_route | Enum | RECYCLED / REUSED / DISPOSED |
| recovery_method_breakdown | JSON or multiple % fields | How the fraction is treated (see below) |
| process_description | Text? | Description of recovery process |
| notes | Text? | |

**Recovery method breakdown** — depending on regulatory requirements, you may need:
- `prepared_for_reuse_pct`
- `recycling_pct`
- `other_material_recovery_pct`
- `energy_recovery_pct`
- `thermal_disposal_pct`

These must sum to 100%. Some customers only need the top-level treatment route; others need the full breakdown.

#### ContaminationIncident
Quality issues found during processing.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| incident_number | String (unique) | Auto-generated identifier |
| order_id | FK | Which order |
| session_id | FK? | Which processing session (optional) |
| contamination_type | Enum | Customer-defined types |
| description | Text | What was found |
| weight_kg | Decimal? | Weight of contamination |
| percentage | Decimal? | % of total inbound |
| estimated_hours | Decimal? | Labor hours for remediation |
| fee_amount | Decimal? | Calculated penalty |
| is_invoiced | Boolean | Whether penalty has been billed |
| recorded_by | FK | Who recorded it |
| recorded_at | DateTime | When |

**Fee calculation** is contract-driven — the contamination service looks up the supplier's contract, finds the penalty configuration for the contamination type, and calculates the fee based on rate type (fixed, percentage, per-kg, per-hour) with min/max caps and tolerance thresholds.

#### MaterialMaster (Input Materials)
Master data for the types of materials the facility processes.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| code | String (unique) | Material code |
| name | String | Human-readable name |
| waste_stream_id | FK | Which waste stream this belongs to |
| regulatory_codes | Various | CBS code, EURAL code, WEEE category, etc. |
| default_process_description | Text? | |
| is_active | Boolean | |

#### FractionMaster (Output Fractions)
Master data for the output materials produced by processing.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| code | String (unique) | Fraction code |
| name | String | Human-readable name |
| regulatory_code | String | EURAL code or equivalent |
| default_recovery_percentages | Multiple % fields | Default treatment method breakdown |
| is_active | Boolean | |

#### MaterialFraction (M2M)
Links input materials to their possible output fractions.

| Field | Type | Description |
|-------|------|-------------|
| material_id | FK | Input material |
| fraction_id | FK | Possible output fraction |
| sort_order | Int | Display order |
| is_active | Boolean | |

#### Processor & Certificate
Downstream processors who receive output fractions.

**Processor:** name, address, country, environmental permit number, certification status, is_active

**ProcessorCertificate:** certificate number, certifying body, valid_from, valid_to, document URL, is_active

**CertificateMaterialScope:** M2M between certificate and materials it covers

#### ReusableItem
Items identified during cataloguing as suitable for reuse/resale.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| catalogue_entry_id | FK | Parent catalogue entry |
| material_id | FK | Material type |
| brand | String? | |
| model | String? | |
| type | String? | |
| serial_number | String? | |
| condition | String? | |
| notes | Text? | |

### Key Relationships

- **ProcessSession ↔ Inbound**: 1:1 (every inbound gets exactly one process session)
- **ProcessSession ↔ Order**: M:1 (multiple sessions can belong to one order)
- **CatalogueEntry ↔ Container**: M:1 (multiple materials per container)
- **ProcessingRecord ↔ CatalogueEntry**: M:1 (multiple records per entry, due to versioning)
- **OutcomeLine ↔ FractionMaster**: M:1 (each outcome references one fraction)
- **MaterialMaster ↔ FractionMaster**: M:M via MaterialFraction (defines valid fraction options)

---

## 3. Standard Screens and UI Components

### 3.1 Process Queue / List Page

**Purpose:** Show all processing sessions with their current status.

**Content:**
- Paginated table with columns: session ID/name, status badge, order reference, supplier, material type(s), container count, total weight, date
- Status column should be the 2nd column
- Filter bar: status dropdown, search (order ref, supplier), date range
- Pagination controls (10/20/50 per page)
- Click row → navigate to session detail

**Key UX:**
- Empty values shown as em-dash (—)
- Primary identifier column uses `font-medium`
- Only clickable text should be styled as links (colored/underlined)

### 3.2 Process Session Detail Page

**Purpose:** The main workspace where operators do their processing work.

**Layout:** Full page (not a modal — too many fields and sections for a popup).

**Sections:**

**Header:**
- Session info: order reference, supplier, status badge (clickable for transitions), date
- Inbound summary: container count, total net weight

**Container List (left panel or accordion):**
- List of containers in this inbound
- Per container: label, type, net weight, catalogue status indicator, processing status indicator
- Click to select → shows detail in main area

**Catalogue Tab (per container):**
- Table of material classifications: material code, material name, weight, reuse-eligible qty
- Add/edit/delete entries (only when session is in draft)
- Running total of classified weight vs. container net weight

**Processing Tab (per container):**
- For each catalogue entry → processing record with outcome lines
- Table: fraction code, fraction name, weight, share %, treatment route, recovery breakdown
- Add/edit/delete outcome lines
- Balance indicator: total outcome weight vs. catalogue entry weight (green if balanced, red if not)
- Finalize button (per material) → locks the record
- Confirm button (compliance officer only) → final sign-off

**Contamination Tab:**
- List of contamination incidents for this session/order
- Record new incident: type, description, weight/percentage, hours
- Fee auto-calculated and displayed
- Cannot edit after invoiced

**Summary / Yield Tab:**
- Per-container yield breakdown: input weight → output fractions → loss
- Recovery rate percentages
- Balance status for all containers

### 3.3 Master Data Screens

**Materials Management:**
- List of input material types with code, name, waste stream, status
- Create/edit form: code, name, waste stream, regulatory codes, associated fractions
- Fraction association: checkboxes or drag-and-drop to link fractions to materials

**Fractions Management:**
- List of output fraction types with code, name, EURAL code, status
- Create/edit form: code, name, regulatory code, default recovery percentages

**Processors Management:**
- List of downstream processors with name, country, certification status
- Detail page with certificates: certificate number, body, validity dates, material scope
- Certificate validation: check if a processor can handle a specific material on a specific date

### 3.4 Contamination List Page

- Paginated list of all contamination incidents
- Columns: incident number, order ref, supplier, type, weight, fee, invoiced status
- Filters: contamination type, date range, invoiced/not invoiced

### 3.5 Common UI Components

| Component | Usage |
|-----------|-------|
| StatusBadge | Consistent status display across all lists |
| ClickableStatusBadge | Status transitions via click (not separate buttons) |
| RowActionMenu | 3-dot kebab menu for row actions (edit, delete, etc.) |
| WeightDisplay | Formatted weight with unit (kg) and decimal precision |
| PercentageBar | Visual representation of recovery rate breakdown |
| BalanceIndicator | Shows weight balance (green/yellow/red) |

---

## 4. Standard Workflows

### 4.1 Main Processing Lifecycle

```
1. MATERIAL SELECTION
   Inbound event transitions to READY_FOR_PROCESSING
   → Process session auto-created (status: PLANNED)

2. CATALOGUING (Phase 1)
   Operator opens session, selects a container
   → Classifies contents: adds catalogue entries (material + weight)
   → Can identify reusable items
   → Catalogue status: NOT_STARTED → IN_PROGRESS → COMPLETED

3. PROCESSING (Phase 2)
   For each catalogue entry:
   → System creates a draft ProcessingRecord
   → Operator adds outcome lines (fraction + weight + treatment route)
   → System computes balance (outcome total vs. input weight)
   → Operator clicks Finalize when balanced (±tolerance)
   → Processing status: NOT_STARTED → IN_PROGRESS → COMPLETED

4. COMPLIANCE CONFIRMATION
   Compliance officer reviews finalized records
   → Confirms each container's processing (FINALIZED → CONFIRMED)
   → When all containers confirmed → session COMPLETED
   → Upstream: inbound marked as PROCESSED, order updated

5. COMPLETION
   Session fully confirmed
   → Data available for reporting and invoicing
   → Records become immutable (unless reopened by admin)
```

### 4.2 Correction / Reopen Flow

```
Admin initiates reopen on a confirmed record
→ Reason code + notes required
→ System clones current record to new version (version_no++)
→ Old record marked SUPERSEDED (is_current = false)
→ New record set to DRAFT
→ Session status reverts to IN_PROGRESS
→ Operator makes corrections on new version
→ Re-finalize → Re-confirm
```

**Why versioning instead of editing:** Regulatory compliance requires a complete audit trail. You must be able to show what was reported at any point in time.

### 4.3 Contamination Flow

```
During processing, operator discovers contamination
→ Records incident: type, description, weight/percentage
→ System looks up supplier contract → finds penalty config
→ Checks contamination tolerance threshold
→ If within tolerance: fee = 0
→ If exceeds: calculates fee by rate type (fixed/percentage/per-kg/per-hour)
→ Applies min/max caps
→ Incident saved with calculated fee
→ Finance can later mark as invoiced
```

### 4.4 Weight Balance Validation

At every step, the system tracks weight balance:

```
Container net weight (from weighing)
  = Sum of catalogue entry weights (cataloguing phase)
  = Sum of outcome line weights per entry (processing phase)
```

- **Cataloguing:** total classified weight should approximate container net weight (soft warning if different)
- **Processing:** total outcome weight must be within ±tolerance of catalogue entry weight (hard block at finalization)
- **Tolerance:** typically ±1 kg, but this is customer-configurable

### 4.5 Recovery Rate Calculation

Two levels of recovery tracking:

**Summary level (per product category):**
- recycled_pct + reused_pct + disposed_pct = 100%
- Used for high-level reporting (circularity statements)

**Detailed level (per output fraction):**
- prepared_for_reuse_pct + recycling_pct + other_material_recovery_pct + energy_recovery_pct + thermal_disposal_pct = 100%
- Used for detailed regulatory reporting

Default percentages come from master data (fraction defaults) but can be overridden per outcome line.

---

## 5. Integration Points

### 5.1 Upstream: Inbound Module

| Direction | Data | Trigger |
|-----------|------|---------|
| Inbound → Process | Container list with net weights, order context, supplier info | Inbound status reaches READY_FOR_PROCESSING |
| Process → Inbound | Status update (PROCESSED) | All containers confirmed |

**The process module never creates containers** — it only reads containers that were registered during inbound/weighing.

### 5.2 Downstream: Reporting Module

| Report Type | Data Consumed |
|------------|---------------|
| Supplier Circularity Statement | Recovery rates per material category, aggregated by supplier + period |
| Material Recovery Summary | Recovery rates per category across all suppliers |
| Chain of Custody | Full traceability: inbound → catalogue → processing → downstream processor |
| Downstream Material Statement | Output fractions by material, with treatment routes and processor info |
| Weight Register | Weighing data + processing summary |
| Waste Stream Analysis | Processing data grouped by waste stream |

### 5.3 Downstream: Invoicing Module

| Data | Usage |
|------|-------|
| Processing outcome weights + rates | Calculate processing fees per material |
| Contamination incidents + fees | Bill contamination penalties to suppliers |
| Recovery rates | Contract-based pricing adjustments |

### 5.4 External Systems

| System | Integration Type | Data Flow |
|--------|-----------------|-----------|
| **Weighing scales / machinery** | Real-time or batch | Weight readings → container weights |
| **Quality control systems** | Event-based | Contamination alerts, quality scores |
| **ERP system** | Batch sync | Material master data, processor info, invoicing data |
| **Environmental reporting portals** | Export/API | Recovery rates, waste stream data, EURAL codes |
| **Downstream processor systems** | Document exchange | Transfer documents, certificates of destruction |

### 5.5 Master Data Dependencies

The process module depends on these master data entities being set up first:
- **Waste Streams** — top-level grouping of material types
- **Material Types** — what the facility processes (input materials)
- **Output Fractions** — what the facility produces (output materials)
- **Material ↔ Fraction mappings** — which outputs can come from which inputs
- **Downstream Processors** — who receives the output, with valid certificates
- **Product Categories** — regulatory groupings for reporting (if applicable)
- **Contract Penalty Configuration** — contamination types, fee rates, tolerances

---

## 6. Customer-Variable Parts

When starting a new customer project, these are the things that **will** change. Ask about each one early.

### 6.1 Processing Types

Different facilities have different processing steps:
- **Manual sorting** (visual inspection, hand-sorting into bins)
- **Mechanical shredding** (size reduction, magnetic/eddy separation)
- **Disassembly** (component-level breakdown of devices)
- **Chemical treatment** (acid bath, solvent extraction)
- **Thermal treatment** (smelting, incineration)

**Question to ask:** What physical processing steps does this facility perform? Is it single-step or multi-step?

### 6.2 Number of Processing Phases

Some facilities have one phase (sort and done). Others have multiple sequential phases:
- Phase 1: Sorting → Phase 2: Shredding → Phase 3: Separation
- Each phase may have its own set of output fractions

**Question to ask:** How many distinct processing phases exist? Do materials flow between phases?

### 6.3 Material Taxonomy

Every customer has different material classifications:
- What waste streams do they handle? (WEEE, construction waste, automotive, etc.)
- What are their input material categories?
- What output fractions do they produce?
- What regulatory codes apply? (EURAL, CBS, LMA, Basel Convention, etc.)

**Question to ask:** Provide us your complete material catalogue — input types and output fractions with codes.

### 6.4 Yield Calculation Method

- **Weight-based:** output weight / input weight (most common)
- **Unit-based:** items processed / items received
- **Value-based:** recovered material value / input material value
- **Tolerance:** how much weight loss/gain is acceptable? (±1 kg? ±2%? configurable per material?)

**Question to ask:** How do you calculate yield/recovery? What's your acceptable tolerance?

### 6.5 Quality Criteria

- What contamination types exist? (varies by waste stream)
- What are tolerance thresholds?
- How are penalties calculated? (fixed fee? per-kg? percentage of order value?)
- Are there quality grades for output fractions?

**Question to ask:** What quality issues do you encounter? How do you penalize contamination?

### 6.6 Traceability Requirements

- Lot-level tracking? (which input lot produced which output?)
- Batch-level tracking? (group multiple inputs into one processing batch?)
- Item-level tracking? (serial numbers for reusable electronics?)
- Chain of custody requirements? (need to prove every kg is accounted for?)

**Question to ask:** What level of traceability do your regulators or customers require?

### 6.7 Environmental Compliance

- Which reporting frameworks apply? (WEEELABEX, CBS, LMA, Stichting Open, etc.)
- What report formats are needed? (PDF, XLSX, API submission?)
- Data retention requirements? (5 years? 10 years? indefinite?)
- Processor certification requirements? (must downstream processors have specific certifications?)

**Question to ask:** Which environmental regulations govern your operations? What reports must you produce?

### 6.8 Recovery Rate Granularity

- **Simple:** recycled / reused / disposed (3-way split, sums to 100%)
- **Detailed:** prepared_for_reuse / recycling / other_material_recovery / energy_recovery / thermal_disposal (5-way split)
- **Custom:** some customers have additional categories

**Question to ask:** What recovery method breakdown does your regulator require?

### 6.9 Workflow Rigidity

- Can operators skip the catalogue phase and go straight to processing?
- Is compliance confirmation required or optional?
- Can records be reopened, or are they immutable after finalization?
- Who can reopen? (admin only? compliance officer? operator?)

**Question to ask:** Describe your approval workflow. Who signs off at each stage?

---

## 7. Implementation Principles

### 7.1 Architecture

**Backend:**
- Thin controllers — only request/response handling, no business logic
- Business logic in service layer — one service per domain concept
- Workflow logic in a dedicated workflow service — keeps state transitions centralized
- Every mutation in a database transaction — no partial writes
- Every mutation writes to audit log — no exceptions

**Frontend:**
- One Zustand store per domain concept (session detail store + list store)
- API client layer mirrors backend routes 1:1
- Full-page forms for complex entities (not modals)
- Consistent add/edit pattern: same component, different mode (create vs. edit via route params)

### 7.2 State Management

Processing records go through strict state transitions. Implement a state machine — don't rely on ad-hoc status checks scattered across the codebase.

```
Allowed transitions:
  DRAFT → FINALIZED (operator finalizes)
  FINALIZED → CONFIRMED (compliance confirms)
  CONFIRMED → SUPERSEDED (admin reopens → old record)
  CONFIRMED → DRAFT (admin reopens → new version created)
```

Validate transitions at the service layer. Never allow skipping states.

### 7.3 Weight Balance

Compute balance after every outcome change — don't defer it to finalization only. The operator needs real-time feedback on whether their weights add up.

Store `balance_delta_kg` on the processing record so the UI can display it without recalculating.

### 7.4 Versioning

When reopening a confirmed record:
1. Clone the record and all its outcome lines
2. Set the old record to `is_current = false`, `status = SUPERSEDED`
3. Increment `version_no` on the new record
4. Set `supersedes_id` pointing to the old record
5. Reset the new record to DRAFT

Never edit confirmed records in-place. This breaks the audit trail.

### 7.5 Snapshot Fields

When creating a processing record, snapshot the material code and name from master data. Reports generated months later must reflect what was true at processing time, not what master data says today.

### 7.6 Percentage Validation

Any set of percentages that must sum to 100% should be validated server-side at submission/finalization, not just client-side. Use a small tolerance (±0.01) for floating-point rounding.

### 7.7 API Design

```
# Session-scoped operations
GET    /processing/sessions/:sessionId/records
POST   /processing/sessions/:sessionId/containers/:containerId/finalize
POST   /processing/sessions/:sessionId/containers/:containerId/confirm
POST   /processing/sessions/:sessionId/containers/:containerId/reopen

# Record-scoped operations
GET    /processing/records/:recordId/history
POST   /processing/records/:recordId/outcomes
PUT    /processing/outcomes/:outcomeId
DELETE /processing/outcomes/:outcomeId
```

Pattern: session-scoped for lifecycle operations, record-scoped for CRUD on child entities.

### 7.8 Role-Based Access

- Processing operators: create/edit/finalize
- Compliance officers: confirm
- Admins: reopen + all of the above
- Finance: read-only access to contamination fees

Enforce at both route middleware and service layer.

---

## 8. Common Mistakes and Things to Watch Out For

### 8.1 Weight Discrepancies

**Problem:** Output weights don't match input weights, and the system silently accepts it.
**Solution:** Always enforce a balance tolerance at finalization. Make the tolerance configurable per customer. Show running balance in the UI in real-time.

### 8.2 Orphaned Records

**Problem:** A processing record exists but its parent session was deleted or its inbound was cancelled.
**Solution:** Never hard-delete sessions or inbounds. Use status transitions. Cascade status changes downward.

### 8.3 Editing Confirmed Records

**Problem:** Someone edits a confirmed record directly, breaking the audit trail.
**Solution:** Immutability after confirmation. The only way to change a confirmed record is the reopen flow, which creates a new version.

### 8.4 Missing Audit Trail

**Problem:** Changes are made without audit logging, making it impossible to trace who changed what.
**Solution:** Every service-layer mutation must call `writeAuditLog`. No exceptions. Include the user ID, action type, entity type, entity ID, and a diff of what changed.

### 8.5 Coupled Status Transitions

**Problem:** Session status changes but the upstream inbound/order status doesn't, creating inconsistency.
**Solution:** Centralize coupled transitions in the workflow service. When session becomes COMPLETED, the workflow service also transitions the inbound and order. Test these cascades thoroughly.

### 8.6 Percentage Rounding

**Problem:** Five percentages that should sum to 100% sum to 99.99% or 100.01% due to floating-point math.
**Solution:** Store as Decimal (not Float). Validate with a tolerance (±0.01). Round to 2 decimal places consistently. Use a `roundWeight` utility everywhere.

### 8.7 Master Data Changes After Processing

**Problem:** Someone renames a material code after processing records reference it. Old reports now show the new name.
**Solution:** Snapshot fields on the processing record. The record stores the material code/name as it was at processing time.

### 8.8 Contamination Fee Calculation Edge Cases

**Problem:** Fee calculation fails silently when contract has no penalty config, or tolerance threshold is misconfigured.
**Solution:** Validate that the supplier's contract has contamination penalty configuration before allowing incident recording. Surface clear error messages if config is missing.

### 8.9 UI States Not Handled

**Problem:** Empty processing session shows a blank page instead of helpful guidance.
**Solution:** Always handle four UI states: loading (skeleton), error (retry), empty (guidance text + CTA), and success (data). Every screen, every time.

### 8.10 Inconsistent Status Display

**Problem:** Status badges look different across pages — different colors, different patterns, some clickable, some not.
**Solution:** Use a single StatusBadge component. Status transitions always via ClickableStatusBadge (not separate buttons). Status column always in the 2nd position in tables.

---

## 9. Reference: Statice Implementation

> **WARNING:** This section is a specific implementation example. It should not be copied as-is into new projects — adapt it to your own project's requirements and customer needs.

### Technology Stack
- Frontend: React 18, React Router v6, Tailwind CSS, shadcn/ui, Zustand
- Backend: Node.js, Express.js, Prisma ORM, PostgreSQL
- Auth: JWT (access token in memory, refresh token HttpOnly cookie)

### File Structure

```
server/
  src/
    routes/         sorting.js, processing.js, catalogue.js, contamination.js, processors.js
    controllers/    sortingController.js, processingController.js, catalogueController.js, contaminationController.js, processorController.js
    services/       sortingService.js, processingService.js, sortingWorkflowService.js, catalogueService.js, contaminationService.js, processorService.js
    middleware/     sortingValidation.js (percentage sum, session draft checks)
    utils/          weighingStateMachine.js, contaminationNumber.js
  prisma/
    schema.prisma   ~13 process-related models

client/
  src/
    pages/
      sorting/      SortingPage.jsx (detail), SortingProcessListPage.jsx (list)
    components/
      sorting/      ContaminationRecordModal.jsx
      ui/           StatusBadge.jsx, ClickableStatusBadge.jsx
    store/          sortingStore.js, sortingListStore.js
    api/            sorting.js, processing.js, catalogue.js, contamination.js, processors.js, assets.js
```

### Key Prisma Models
- `SortingSession` — process session (status: PLANNED/SORTED)
- `SortingLine` — legacy recovery rate allocations per product category
- `AssetCatalogueEntry` — material classification per container (asset)
- `ProcessingRecord` — versioned output breakdown (status: DRAFT/FINALIZED/CONFIRMED/SUPERSEDED)
- `ProcessingOutcomeLine` — individual fraction outputs with 5-way recovery breakdown
- `ContaminationIncident` — quality issues with auto-calculated fees
- `MaterialMaster` — input material types (mapped as "ProductTypeMaster" in DB)
- `FractionMaster` — output fraction types with default percentages
- `Processor` / `ProcessorCertificate` / `ProcessorCertificateMaterialScope`
- `ReusableItem` — items eligible for reuse

### Statice-Specific Enums
- `InboundStatus`: ARRIVED → WEIGHED_IN → WEIGHED_OUT → READY_FOR_SORTING → SORTED
- `ProcessingRecordStatus`: DRAFT → FINALIZED → CONFIRMED → SUPERSEDED
- `TreatmentRoute`: RECYCLED / REUSED / DISPOSED
- `AcceptantStage`: FIRST_ACCEPTANT / FOLLOWING
- `ContaminationType`: NON_WEEE / HAZARDOUS / EXCESSIVE_MOISTURE / SORTING_REQUIRED
- `WorkflowStageStatus`: NOT_STARTED / IN_PROGRESS / COMPLETED

### Statice-Specific Business Rules
- Balance tolerance: ±1 kg
- Recovery percentages: 5-way split (prepared_for_reuse, recycling, other_material_recovery, energy_recovery, thermal_disposal)
- Regulatory frameworks: CBS, WEEELABEX, LMA, Stichting Open
- Processing is two-phase: catalogue (classify materials) → processing (record outcomes)
- Contamination fee types: FIXED, PERCENTAGE, PER_KG, PER_HOUR with min/max caps and tolerance thresholds
- Data retention: 10 years minimum

### Seed Data (for reference)
- 20 WEEE product categories (WEEE-01 through WEEE-20)
- 5 material types: Hard Disk Drives, PCB Assemblies, Small Household Appliances, Large Household Appliances, Screens and Monitors
- 7 output fractions: Ferrous Metals, Copper, Aluminium, PCBs, Plastics Mix, Glass, Residual/Shredder Fluff
