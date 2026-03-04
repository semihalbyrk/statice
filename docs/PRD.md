# Product Requirements Document
## E-Waste MRF Management System — Statice Dashboard
**Prepared by:** Evreka Engineering  
**Version:** 2.0  
**Date:** 03 March 2026  
**Status:** Implementation Ready  
**Classification:** Internal — For Development Use Only  

---

## Table of Contents

1. Project Overview  
2. Tech Stack & Architecture  
3. User Roles & Permissions  
4. Module 1 — Inbound Cargo & Order Management  
5. Module 2 — Skip / Asset Registration  
6. Module 3 — Pfister Weighing Integration (Simulated)  
7. Module 4 — Sorting & Material Recording  
8. Module 5 — Reporting  
9. Data Model  
10. UI/UX Requirements  
11. Non-Functional Requirements  
12. Out of Scope  
13. Glossary  

---

## 1. Project Overview

### 1.1 Purpose

This document defines all functional and technical requirements for the Statice E-Waste MRF (Material Recovery Facility) Management System — referred to throughout this document as **the Dashboard**. It is written as a direct implementation guide for Claude Code and the Evreka engineering team, providing sufficient detail to build the system without additional specification input.

### 1.2 Background

Statice operates a certified e-waste recycling and re-use facility in the Netherlands. The facility receives inbound electronic waste from two primary source types:

- **Private individuals** — consumer drop-offs
- **Stichting Open (PRO)** — a Dutch foundation that operates collection containers for e-waste and recyclables; acts as the primary high-volume supplier

Inbound deliveries are transported by external carriers (e.g. Van Happen Recycling). A single truck may carry two or three skip containers (bakken), each registered separately but linked to one inbound order.

Currently, all operations are managed through **Excel spreadsheets and paper-based Pfister weight tickets**. This introduces significant manual data-entry risk and is incompatible with upcoming mandatory digital reporting obligations.

### 1.3 What This System Does

The Dashboard digitalises the following operational flows:

1. **Inbound cargo registration** — vehicle arrival, carrier/supplier linking, order matching
2. **Skip/asset management** — individual container tracking with unique asset IDs
3. **Pfister weighbridge integration** — automated gross/tare/net weight capture (simulated in this release via dummy controls)
4. **Sorting & material recording** — breakdown of inbound contents by product category post-receipt
5. **Reporting** — regulatory reports for Dutch authorities (CBS, LMA, Province), supplier circularity statements, and internal management reports

### 1.4 Business Goals

| ID | Goal | Metric |
|----|------|--------|
| G-01 | Eliminate paper weight tickets | 100% inbound weighings captured digitally |
| G-02 | Support multi-skip registration per order | At least 1 skip per vehicle linked to one order in all cases |
| G-03 | Pfister integration (simulated now, real in future release) | Dummy simulation accurately represents future live workflow |
| G-04 | Produce compliant regulatory and supplier reports | Reports accepted by LMA, CBS, Province without manual rework |
| G-05 | Full chain-of-custody traceability | Complete audit trail available for any inbound consignment |

---

## 2. Tech Stack & Architecture

### 2.1 Technology Decisions

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 with React Router v6 |
| UI Framework | Tailwind CSS + shadcn/ui component library |
| State Management | Zustand |
| Backend | Node.js with Express.js |
| Database | PostgreSQL 15 |
| ORM | Prisma |
| Authentication | JWT-based auth with refresh tokens; bcrypt for password hashing |
| File Export | PDFKit (PDF generation) + ExcelJS (XLSX generation) |
| Email | Nodemailer with SMTP relay |
| API Style | RESTful JSON API |
| Environment | Monorepo: /client (React) and /server (Node.js) |

### 2.2 Project Structure

```
/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── orders/
│   │   │   ├── assets/
│   │   │   ├── weighing/
│   │   │   ├── sorting/
│   │   │   └── reports/
│   │   ├── store/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── utils/
│   └── public/
├── server/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── services/
│   │   │   ├── pfisterSimulator.js
│   │   │   └── reportGenerator.js
│   │   └── utils/
│   ├── prisma/
│   │   └── schema.prisma
│   └── index.js
└── docker-compose.yml
```

### 2.3 Architecture Notes

- The backend exposes a REST API consumed exclusively by the React frontend.
- The Pfister integration is implemented as a **service layer** (pfisterSimulator.js) that mimics the real Pfister Cloudweigh TCP/IP interface. When the real integration is implemented, only this service file needs to be replaced — all controller and frontend logic remains unchanged.
- Reports are generated server-side and returned as file downloads (PDF/XLSX).
- All database mutations are wrapped in Prisma transactions to ensure atomic operations.
- An AuditLog table records every create/update/delete action with timestamp, user ID, entity type, entity ID, and a JSON diff.

---

## 3. User Roles & Permissions

### 3.1 Role Definitions

| Role | Internal Name | Description |
|------|---------------|-------------|
| Gate / Weighbridge Operator | GATE_OPERATOR | Creates arrival records, registers skips, triggers Pfister weighings |
| Logistics Planner | LOGISTICS_PLANNER | Creates and manages planned inbound orders; views daily schedule |
| Reporting Manager | REPORTING_MANAGER | Generates and schedules all report types |
| Administrator | ADMIN | Full system access; manages users, master lists, system config |

### 3.2 Permission Matrix

| Feature | GATE_OPERATOR | LOGISTICS_PLANNER | REPORTING_MANAGER | ADMIN |
|---------|:---:|:---:|:---:|:---:|
| View daily inbound schedule | Yes | Yes | Yes | Yes |
| Create arrival record | Yes | No | No | Yes |
| Create / edit inbound order | No | Yes | No | Yes |
| Register skips | Yes | No | No | Yes |
| Trigger Pfister weighing (dummy) | Yes | No | No | Yes |
| Override weight (with reason) | No | No | No | Yes |
| Record sorted material breakdown | Yes | No | No | Yes |
| Generate reports | No | No | Yes | Yes |
| Schedule recurring reports | No | No | Yes | Yes |
| Manage users | No | No | No | Yes |
| Manage master lists | No | No | No | Yes |
| View audit log | No | No | No | Yes |

### 3.3 Authentication Flow

1. User navigates to /login.
2. User submits email and password.
3. Server validates credentials, returns accessToken (15-minute expiry) and refreshToken (7-day expiry, stored in HttpOnly cookie).
4. Frontend stores accessToken in memory (Zustand store). Never in localStorage.
5. On 401 responses, frontend automatically calls /auth/refresh to obtain a new accessToken.
6. On logout, server invalidates the refresh token.

### 3.4 Default Seed Users (Development)

```
admin@statice.nl       / Admin1234!   -> ADMIN
planner@statice.nl     / Planner123!  -> LOGISTICS_PLANNER
gate@statice.nl        / Gate1234!    -> GATE_OPERATOR
reporting@statice.nl   / Report123!   -> REPORTING_MANAGER
```

---

## 4. Module 1 — Inbound Cargo & Order Management

### 4.1 Overview

This module covers the full lifecycle of an inbound delivery: from pre-planned order creation by the logistics planner, through vehicle arrival and registration at the gate, to order completion after weighing and sorting.

### 4.2 Inbound Order

#### 4.2.1 Data Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| order_id | UUID | Auto | Primary key |
| order_number | String | Auto | Format: ORD-YYYY-NNNN |
| carrier_id | FK -> Carrier | Yes | |
| supplier_id | FK -> Supplier | Yes | |
| planned_date | Date | Yes | Expected delivery date |
| planned_time_window_start | Time | No | Optional |
| planned_time_window_end | Time | No | Optional |
| expected_skip_count | Integer | Yes | Min 1, Max 10 |
| waste_stream_id | FK -> WasteStream | Yes | |
| afvalstroomnummer | String | No | Dutch waste stream reg. number |
| notes | Text | No | Max 500 chars |
| status | Enum | Auto | See state machine below |
| created_by | FK -> User | Auto | |
| created_at | Timestamp | Auto | |
| updated_at | Timestamp | Auto | |

#### 4.2.2 Order Status State Machine

States: PLANNED -> ARRIVED -> IN_PROGRESS -> COMPLETED

CANCELLED is reachable from PLANNED or ARRIVED only.

- PLANNED: Order created by logistics planner; vehicle not yet arrived.
- ARRIVED: Vehicle arrival record created and matched to this order.
- IN_PROGRESS: At least one weighing event has been started for this order.
- COMPLETED: All weighing events confirmed and sorting records submitted.
- CANCELLED: Order cancelled before completion.

Status transitions are enforced server-side. The API rejects invalid transitions with a 409 Conflict response.

#### 4.2.3 Planned Orders List Screen

Route: /orders  
Access: LOGISTICS_PLANNER, ADMIN

Layout:
- Page title: "Inbound Orders"
- Top-right button: "+ New Order" — opens Create Order form
- Filter bar: Date range picker | Status multi-select | Carrier dropdown | Supplier dropdown | Search by order number or vehicle plate
- Table columns: Order # | Planned Date | Time Window | Carrier | Supplier | Waste Stream | Expected Skips | Status | Actions
- Actions per row: View | Edit (only if PLANNED) | Cancel (only if PLANNED or ARRIVED)
- Pagination: 25 rows per page

Today's View:
- A "Today" tab shows only orders with planned_date = today, sorted by time window ascending.
- Orders with status ARRIVED or IN_PROGRESS are highlighted with a blue left border.

#### 4.2.4 Create / Edit Order Form

Fields:
- Carrier — searchable dropdown (from Carrier master list)
- Supplier — searchable dropdown (from Supplier master list)
- Planned Date — date picker (cannot be in the past for new orders)
- Time Window — optional start/end time pickers
- Expected Number of Skips — number input (1–10)
- Waste Stream — dropdown (from WasteStream master list)
- Afvalstroomnummer — text input (optional)
- Notes — textarea (max 500 chars)

Validation:
- Carrier and Supplier are required.
- Planned date is required and cannot be in the past for new orders.
- Expected skip count must be between 1 and 10.
- Form shows inline validation errors on submit attempt.

On Save: Order created with status PLANNED. Success toast: "Order ORD-YYYY-NNNN created."

### 4.3 Arrival Registration

Route: /arrivals/new  
Access: GATE_OPERATOR, ADMIN

This is the primary entry point for the gate operator when a vehicle arrives.

#### 4.3.1 Arrival Registration Flow

Step 1 — Vehicle Identification

Screen title: "Register Arrival"

- Large text input: "Vehicle Registration Plate"
  - Accepts alphanumeric input; auto-converts to uppercase
  - On input (debounced 300ms): system queries open orders matching the plate
  - If match found: display matched order card with: Order #, Carrier, Supplier, Planned Date, Expected Skips, Waste Stream
  - Operator clicks "Confirm Match" or "Not My Order" to search manually
  - If no match found: display "No planned order found for this plate" and button "Create Ad-Hoc Order"

Step 2 — Confirm or Create Order

If matched: operator confirms pre-filled order details. May edit only the Notes field.

If ad-hoc: simplified inline order creation form:
- Carrier — required, searchable dropdown
- Supplier — required, searchable dropdown
- Waste Stream — required dropdown
- Notes — optional textarea
- System auto-sets: planned_date = today, order_number generated, status = ARRIVED

Step 3 — Arrival Record Created

On confirmation:
- Order status transitions to ARRIVED
- arrived_at timestamp recorded from server clock
- System auto-navigates to the Weighing Event screen for this order

#### 4.3.2 Today's Arrivals Panel

Route: /dashboard (main dashboard, visible to all roles)

Shows a live list of today's inbound activity:
- Table: Arrived At | Vehicle Plate | Carrier | Supplier | Order # | Skips Registered | Status
- Auto-refreshes every 30 seconds (polling)
- Status badges are colour-coded (see Section 10.3)

### 4.4 Carrier & Supplier Master Lists

Route: /admin/carriers and /admin/suppliers  
Access: ADMIN only

Carrier Fields: carrier_id (UUID, auto), name (required), kvk_number, contact_name, contact_email, contact_phone, licence_number, is_active (default true)

Supplier Fields: supplier_id (UUID, auto), name (required), supplier_type (enum: PRIVATE_INDIVIDUAL / PRO / THIRD_PARTY, required), kvk_number, contact_name, contact_email, is_active (default true)

Stichting Open is pre-seeded as a supplier of type PRO.

---

## 5. Module 2 — Skip / Asset Registration

### 5.1 Overview

A skip (bak/container) is the physical unit of cargo carried on a vehicle. A single truck may carry up to 3 skips. Each skip is individually identified, weighed, and tracked. All skips registered during one weighing event are automatically linked to the same parent order.

### 5.2 Asset Data Model

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| asset_id | UUID | Auto | Internal PK |
| asset_label | String | Auto | Format: SKP-YYYYMMDD-NNN |
| weighing_event_id | FK | Yes | Parent weighing event |
| skip_type | Enum | Yes | OPEN_TOP / CLOSED_TOP / GITTERBOX / PALLET / OTHER |
| material_category_id | FK -> ProductCategory | Yes | Primary category |
| estimated_volume_m3 | Decimal | No | |
| gross_weight_kg | Decimal | No | From Pfister or manual |
| tare_weight_kg | Decimal | No | From Pfister or manual |
| net_weight_kg | Decimal | Computed | gross minus tare |
| notes | Text | No | |
| created_at | Timestamp | Auto | |

### 5.3 Skip Registration Screen

Route: /weighing-events/:eventId/skips  
Access: GATE_OPERATOR, ADMIN

This screen is accessed immediately after a weighing event is created.

Layout — Skip List Panel:
- Header: "Skips for Order [ORD-YYYY-NNNN] — Vehicle [PLATE]"
- Button: "+ Add Skip"
- Table showing all registered skips: Asset Label | Skip Type | Primary Category | Est. Volume | Gross (kg) | Tare (kg) | Net (kg) | Actions
- "Confirm Weighing Event" button — disabled until at least 1 skip is registered

Add Skip Flow:

Clicking "+ Add Skip" opens an inline panel on the right side:

1. Asset Identification
   - Radio: "New Skip" / "Existing Skip (scan/enter ID)"
   - If New: system generates the asset_label automatically
   - If Existing: text input for scanning or typing the asset label

2. Skip Details Form
   - Skip Type — dropdown
   - Primary Material Category — searchable dropdown
   - Estimated Volume (m3) — number input, optional
   - Notes — textarea, optional

3. Weight Assignment
   - If Pfister gross weight is available: display weight and a button "Assign this gross weight to skip"
   - If multiple skips: operator manually distributes total gross weight across skips
   - Gross Weight (kg) — number input (pre-filled if Pfister data available)
   - Note: Tare weight is assigned after the vehicle's second weighing pass

4. Save — skip added to the list; panel remains open to add the next skip

Validation:
- Skip Type is required.
- Primary Material Category is required.
- Gross weight must be a positive number if provided.
- A weighing event cannot be confirmed without at least one skip (SKP-06).

Edit / Remove Skip:
- Operator can edit or remove any skip before weighing event is confirmed.
- After confirmation, skips are locked; only ADMIN can unlock with a reason code (creates audit log entry).

### 5.4 Asset Label Printing

After a new skip is saved, a "Print Label" button appears. Clicking it opens a browser print dialog with a formatted label containing:
- Asset Label (large, human-readable)
- QR code encoding the asset_label string
- Order number
- Date
- Primary material category

Label dimensions are formatted for 100mm x 50mm label stock.

---

## 6. Module 3 — Pfister Weighing Integration (Simulated)

### 6.1 Overview

The Pfister Cloudweigh system is the physical weighbridge at the Statice facility. In production, the Dashboard will communicate with it via TCP/IP to receive real-time weight readings. In this release, the integration is fully simulated using a dummy service that generates realistic weight data on operator demand.

Critical design requirement: The simulation must be implemented so that replacing the dummy service with the real Pfister TCP/IP service requires NO changes to any controller, route, or frontend component. Only the pfisterSimulator.js service file is replaced.

### 6.2 Pfister Service Interface Contract

The pfisterService (whether simulated or real) must expose the following interface:

```javascript
// pfisterService interface — both simulator and real implementation must conform

// Request a new weighing. Returns a ticket object when the weighbridge finalises.
pfisterService.requestWeighing(weighingType)
// weighingType: 'GROSS' | 'TARE'
// Returns: Promise<PfisterTicket>

// PfisterTicket shape:
{
  ticket_number: String,       // e.g. "PF-2026-003847"
  weighing_type: 'GROSS' or 'TARE',
  weight_kg: Number,
  unit: 'kg',
  timestamp: ISO8601 String,
  raw_payload: String          // full raw data string from Pfister
}
```

### 6.3 Simulator Implementation (pfisterSimulator.js)

The simulator generates a PfisterTicket with the following behaviour:

- ticket_number: PF- + current year + - + 6-digit zero-padded incrementing counter (persisted in DB, resets yearly)
- weight_kg:
  - GROSS weighing: random value between 8,000 and 24,000 kg
  - TARE weighing: random value between 6,000 and 10,000 kg (always less than the gross value of the same event)
- timestamp: current server time
- raw_payload: JSON string of the generated ticket object
- Response delay: 1,500ms simulated delay to mimic real weighbridge processing time

### 6.4 Weighing Event Data Model

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| event_id | UUID | Auto | |
| order_id | FK -> InboundOrder | Yes | |
| vehicle_id | FK -> Vehicle | Yes | |
| arrived_at | Timestamp | Auto | |
| gross_ticket_id | FK -> PfisterTicket | No | Set after gross weighing |
| tare_ticket_id | FK -> PfisterTicket | No | Set after tare weighing |
| gross_weight_kg | Decimal | No | Total vehicle gross |
| tare_weight_kg | Decimal | No | Total vehicle tare |
| net_weight_kg | Decimal | Computed | |
| status | Enum | Auto | See state machine |
| confirmed_by | FK -> User | No | Set on confirmation |
| confirmed_at | Timestamp | No | |
| notes | Text | No | |

### 6.5 Weighing Event Status Machine

States: PENDING_GROSS -> GROSS_COMPLETE -> PENDING_TARE -> TARE_COMPLETE -> CONFIRMED

- PENDING_GROSS: Weighing event created; waiting for vehicle to drive onto scale.
- GROSS_COMPLETE: Gross weight received; skips can now be registered.
- PENDING_TARE: Vehicle unloaded; waiting for tare weighing pass.
- TARE_COMPLETE: Tare weight received; net weight calculated automatically.
- CONFIRMED: Operator confirmed; record is immutable. Order advances accordingly.

### 6.6 Weighing Event Screen

Route: /weighing-events/:eventId  
Access: GATE_OPERATOR, ADMIN

Layout — Three-column panel:

Left column (25%) — Order & Vehicle Summary:
- Order number, carrier, supplier, vehicle plate
- Arrived at timestamp
- Order notes

Centre column (50%) — Weighing Controls:

Step 1 — Gross Weighing:
- Status indicator: "Awaiting Gross Weighing"
- Large button: "Trigger Gross Weighing (Simulated)"
  - Styled as primary, large, prominent
  - On click: button shows loading spinner + text "Contacting Pfister weighbridge..." for 1,500ms
  - After delay: displays result card with Ticket #, Gross Weight, Timestamp
  - Status advances to GROSS_COMPLETE
  - Green success banner: "Gross weight recorded successfully"

Between steps:
- Prompt appears: "Register skips on this vehicle before tare weighing. [Go to Skip Registration]"

Step 2 — Tare Weighing:
- Available only after at least 1 skip is registered
- Status indicator: "Vehicle unloaded — Ready for Tare Weighing"
- Large button: "Trigger Tare Weighing (Simulated)"
  - Same loading behaviour as gross
  - After delay: displays tare ticket + calculated net weight prominently

Step 3 — Confirmation:
- Summary card: Gross | Tare | Net | Number of skips | All skip IDs
- Large green button: "Confirm & Complete Weighing Event"
- Confirmation dialog: "Are you sure? This action cannot be undone."
- On confirm: status -> CONFIRMED; order status advances
- Digital weight ticket auto-generated

Right column (25%) — Skips Panel:
- Compact skip list (asset label, category, gross, net)
- "+ Add Skip" shortcut button

Manual Weight Override (ADMIN only):
- Small de-emphasised link: "Override Weight"
- Opens form: Weight Value | Reason Code (dropdown: SCALE_MALFUNCTION / DATA_ENTRY_ERROR / SUPERVISOR_CORRECTION / OTHER) | Notes
- On save: original value preserved in audit log; is_manual_override = true flag set on PfisterTicket

### 6.7 Digital Weight Ticket

Generated after weighing event confirmation. Available as on-screen view (/weighing-events/:eventId/ticket) and PDF download.

Ticket content:
- Statice facility name and logo
- Ticket number (from Pfister ticket)
- Order number
- Date and time of weighing
- Vehicle registration plate
- Carrier name
- Supplier name
- List of skips: Asset Label | Category | Gross (kg) | Tare (kg) | Net (kg)
- Total gross, tare, net weights
- Confirming operator name
- "SIMULATED WEIGHING DATA" watermark (removed when real Pfister integration is live)

---

## 7. Module 4 — Sorting & Material Recording

### 7.1 Overview

After a vehicle is unloaded and weighed, the contents of each skip are physically sorted by Statice staff into product sub-categories. The sorting record captures the weight of each sub-category within a skip. This data feeds directly into regulatory reports and circularity statements.

A single skip may contain materials from more than 50 distinct sub-categories. The system imposes no upper limit on the number of material lines per skip.

### 7.2 Product Category Master List

The product category list is a two-level hierarchy:

Level 1 — Waste Stream (Afvalstroom): e.g. WEEE, Plastics, Metals
Level 2 — Product Category: e.g. Monitor, Circuit Board, Modem, Cable, Printer

Each product category has: category_id, code_cbs, description_en, description_nl, waste_stream_id, is_active, and default recovery rate percentages.

Pre-seeded WEEE categories (Admin can add more):

| CBS Code | English | Dutch |
|----------|---------|-------|
| WEEE-01 | Large household appliances | Grote huishoudelijke apparaten |
| WEEE-02 | Small household appliances | Kleine huishoudelijke apparaten |
| WEEE-03 | IT and telecoms equipment | IT- en telecomapparatuur |
| WEEE-04 | Consumer electronics | Consumentenelektronica |
| WEEE-05 | Lighting equipment | Verlichtingsapparatuur |
| WEEE-06 | Electrical and electronic tools | Elektrisch gereedschap |
| WEEE-07 | Toys and leisure equipment | Speelgoed en vrijetijdsapparatuur |
| WEEE-08 | Medical devices | Medische apparatuur |
| WEEE-09 | Monitoring instruments | Meetinstrumenten |
| WEEE-10 | Automatic dispensers | Automaten |
| WEEE-11 | Monitors and screens | Beeldschermen |
| WEEE-12 | Modems and routers | Modems en routers |
| WEEE-13 | Circuit boards / PCBs | Printplaten |
| WEEE-14 | Cables and wiring | Kabels en bedrading |
| WEEE-15 | Batteries | Batterijen |
| WEEE-16 | Printers | Printers |
| WEEE-17 | Mobile phones | Mobiele telefoons |
| WEEE-18 | Laptops | Laptops |
| WEEE-19 | Keyboards and peripherals | Toetsenborden en randapparatuur |
| WEEE-20 | Other WEEE | Overige WEEE |

### 7.3 Material Recovery Rates

Each product category has associated default recovery rates:

| Field | Notes |
|-------|-------|
| recycled_pct | % of weight recycled |
| reused_pct | % of weight reused/refurbished |
| disposed_pct | % incinerated or other disposal |
| landfill_pct | % landfilled |

Constraint: recycled_pct + reused_pct + disposed_pct + landfill_pct = 100 (validated server-side and client-side).

Default values are applied automatically when a sorting line is created but can be overridden per line.

### 7.4 Sorting Record Data Model

SortingSession (one per weighing event):
- session_id (UUID), weighing_event_id (FK, unique), order_id (FK), recorded_by (FK -> User), recorded_at (Timestamp), status (DRAFT / SUBMITTED), notes

SortingLine (one per product category per skip):
- line_id (UUID), session_id (FK), asset_id (FK -> Asset), category_id (FK -> ProductCategory), net_weight_kg (Decimal), recycled_pct, reused_pct, disposed_pct, landfill_pct, downstream_processor (String), notes

### 7.5 Sorting Entry Screen

Route: /sorting/:sessionId  
Access: GATE_OPERATOR, ADMIN

Layout:
- Page header: "Sorting Record — Order [ORD-YYYY-NNNN]"
- Tabs: one tab per skip (e.g. "Skip SKP-20260301-001", "Skip SKP-20260301-002")

Per-Skip Tab Content:
- Skip summary bar: Asset Label | Skip Type | Total Net Weight from weighing (kg) | Unallocated Weight (kg) (total net minus sum of sorting lines)
- Table of sorting lines: Product Category | Weight (kg) | Recycled % | Reused % | Disposed % | Landfill % | Downstream Processor | Notes | Delete
- Last row: "+ Add Material Line" button

Add Material Line:
- Product Category — searchable dropdown
- Weight (kg) — number input
- Recovery rates — four number inputs with live sum validation; pre-filled with category defaults
- Downstream Processor — text input
- Notes — text input
- On Save: line added; unallocated weight recalculates

Validation:
- Recovery rates must sum to exactly 100%.
- Weight must be positive.
- No duplicate product categories per skip (show warning, do not block).
- Total allocated weight should not exceed skip net weight (warning only, not blocking — allows for measurement variance).

Submit Sorting Record:
- Button: "Submit Sorting Record" — transitions status to SUBMITTED
- On submit: order status transitions to COMPLETED
- Submitted records are read-only. Admin can reopen with reason code.

---

## 8. Module 5 — Reporting

### 8.1 Overview

The reporting module generates all structured outputs required for regulatory compliance, supplier accountability, and internal management. Reports are generated server-side and available as PDF or XLSX downloads.

### 8.2 Report Types

| Report ID | Name | Audience | Typical Frequency |
|-----------|------|----------|-------------------|
| RPT-01 | Supplier / Client Circularity Statement | Supplier | Per order or on demand |
| RPT-02 | Material Recovery Summary | CBS, Province, Management | Monthly / Quarterly |
| RPT-03 | Chain-of-Custody Report | Compliance, Audit | Per consignment / on demand |
| RPT-04 | Inbound Weight Register | Management, Weighbridge | Daily / Weekly |
| RPT-05 | Waste Stream Analysis | Management, Regulatory | Monthly |
| RPT-06 | Skip Asset Utilisation | Logistics | Weekly / On demand |

### 8.3 Reporting Module Screen

Route: /reports  
Access: REPORTING_MANAGER, ADMIN

Layout:
- Left sidebar: list of report types (RPT-01 through RPT-06), each with icon and name
- Main area: report configuration form for selected report
- "Generate Report" button and "Schedule Report" button
- Bottom section: "Recent Reports" table — last 20 generated reports with download links

### 8.4 RPT-01 — Supplier / Client Circularity Statement

Purpose: Formal traceability document sent to supplier/client confirming what was received, processed, and what recovery rates were achieved.

Format: EU WEEE Directive-aligned circularity statement. Conforms to the standard structure used by NVMP/Stichting Open processing statements.

Configuration Parameters:
- Supplier — required, dropdown
- Date Range — from/to date picker
- Include Order References — checkbox list (auto-populated based on supplier + date range)
- Material Categories — multi-select (include/exclude specific categories)

Output Content:

Header Section:
- Statice B.V. — facility name, address, permit number, KvK number
- Report generation date and time
- Generating user name
- Supplier/Client name and registration details
- Reporting period (from – to)

Summary Table:
- Order Ref | Delivery Date | Vehicle | Total Net Weight (kg)

Per Product Category Detail Table:
- CBS Code | Product Category | Total Net Weight (kg) | Recycled % | Reused % | Disposed % | Landfill % | Downstream Processor

Chain of Custody Section:
- For each material stream: downstream processor name, address, permit number, transfer method

Footer:
- Authorising signatory block (name, title, date — static placeholder for manual signing)
- "SIMULATED WEIGHING DATA" notice (removed when real Pfister is live)
- Statice logo

### 8.5 RPT-02 — Material Recovery Summary

Purpose: Periodic report for CBS, Province, and internal management showing total material flows and recovery rates by product category.

Configuration Parameters:
- Reporting Period — month/quarter/year selector or custom date range
- Waste Stream filter — optional

Output Content:

Header: Facility name, permit number, reporting period, generated by, generated at

Main Data Table:
- CBS Code | Product Category | Total Inbound (kg) | Recycled (kg) | Recycled % | Reused (kg) | Reused % | Disposed (kg) | Disposed % | Landfill (kg) | Landfill %

Summary Row: Grand totals for all columns

Comparison Section (if prior period data exists):
- Current vs prior period totals and % change per category

### 8.6 RPT-03 — Chain-of-Custody Report

Purpose: Per-consignment traceability document for compliance and audit.

Configuration Parameters:
- Order number — dropdown/search (single order) OR date range (batch, one report per order)

Output Content per consignment:
- Unique consignment identifier (order number)
- Delivery details: carrier, vehicle registration, arrived_at, order reference
- Skip-level detail: Asset Label | Category | Gross (kg) | Tare (kg) | Net (kg) | Pfister Ticket #
- Sorting breakdown per skip: Product Category | Weight (kg) | Recycled % | Reused % | Disposed % | Landfill % | Downstream Processor
- Downstream processor details: name, address, permit number, transfer date

### 8.7 RPT-04 — Inbound Weight Register

Purpose: Operational daily/weekly register of all weighing events.

Configuration Parameters:
- Date range — from/to
- Carrier filter — optional
- Waste stream filter — optional

Output Content (one row per weighing event):
- Date/Time | Order # | Supplier | Carrier | Vehicle Plate | # Skips | Gross (kg) | Tare (kg) | Net (kg) | Pfister Ticket # | Afvalstroomnummer

Subtotals by carrier and waste stream. Grand totals for period.

### 8.8 RPT-05 — Waste Stream Analysis

Purpose: Monthly analysis of material flows by waste stream.

Configuration: Month/year or date range; waste stream multi-select

Output:
- Bar chart (rendered server-side as static image in PDF): inbound volume by product category
- Tabular form of same data
- Recovery rate comparison across categories

### 8.9 RPT-06 — Skip Asset Utilisation

Purpose: Logistics management report showing skip usage and turnaround.

Configuration: Date range; skip type filter

Output:
- Total skips received in period
- Average skips per vehicle
- Breakdown by skip type
- List of most-used asset labels

### 8.10 Report Functional Requirements

| Req ID | Requirement |
|--------|-------------|
| RPT-F01 | All reports exportable in PDF and XLSX formats |
| RPT-F02 | Report generation must complete within 10 seconds for 12-month datasets |
| RPT-F03 | All reports include: Statice logo, generation date/time, generating user name |
| RPT-F04 | RPT-01 configurable per supplier to include/exclude specific material categories |
| RPT-F05 | Scheduled recurring reports: daily/weekly/monthly — auto-emailed to configured address |
| RPT-F07 | Active and inactive Afvalstroomnummer values visible in dedicated admin screen |

### 8.11 Scheduled Reports

Route: /reports/schedules  
Access: REPORTING_MANAGER, ADMIN

Create recurring report schedules:
- Report type — dropdown
- Frequency — Daily / Weekly (day of week) / Monthly (day of month)
- Recipient email(s) — comma-separated
- Format — PDF / XLSX / Both
- Report parameters (same as manual generation)

Schedules stored in DB. A cron job runs every hour and checks for due schedules.

---

## 9. Data Model

### 9.1 Complete Entity List

User, Role, Carrier, Supplier, Vehicle, WasteStream, ProductCategory, InboundOrder, ArrivalRecord, WeighingEvent, PfisterTicket, Asset (Skip), SortingSession, SortingLine, Report, ReportSchedule, AuditLog

### 9.2 Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  GATE_OPERATOR
  LOGISTICS_PLANNER
  REPORTING_MANAGER
  ADMIN
}

enum OrderStatus {
  PLANNED
  ARRIVED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum WeighingEventStatus {
  PENDING_GROSS
  GROSS_COMPLETE
  PENDING_TARE
  TARE_COMPLETE
  CONFIRMED
}

enum SortingStatus {
  DRAFT
  SUBMITTED
}

enum SupplierType {
  PRIVATE_INDIVIDUAL
  PRO
  THIRD_PARTY
}

enum SkipType {
  OPEN_TOP
  CLOSED_TOP
  GITTERBOX
  PALLET
  OTHER
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  password_hash String
  full_name     String
  role          Role
  is_active     Boolean   @default(true)
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt

  orders_created     InboundOrder[]
  events_confirmed   WeighingEvent[]
  sessions_recorded  SortingSession[]
  reports_generated  Report[]
  audit_logs         AuditLog[]
}

model Carrier {
  id              String   @id @default(uuid())
  name            String
  kvk_number      String?
  contact_name    String?
  contact_email   String?
  contact_phone   String?
  licence_number  String?
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now())

  orders   InboundOrder[]
  vehicles Vehicle[]
}

model Supplier {
  id             String       @id @default(uuid())
  name           String
  supplier_type  SupplierType
  kvk_number     String?
  contact_name   String?
  contact_email  String?
  is_active      Boolean      @default(true)
  created_at     DateTime     @default(now())

  orders InboundOrder[]
}

model Vehicle {
  id                 String   @id @default(uuid())
  registration_plate String   @unique
  carrier_id         String
  type               String?
  created_at         DateTime @default(now())

  carrier         Carrier         @relation(fields: [carrier_id], references: [id])
  weighing_events WeighingEvent[]
}

model WasteStream {
  id         String   @id @default(uuid())
  name_en    String
  name_nl    String
  code       String   @unique
  is_active  Boolean  @default(true)
  created_at DateTime @default(now())

  orders     InboundOrder[]
  categories ProductCategory[]
}

model ProductCategory {
  id                    String   @id @default(uuid())
  code_cbs              String   @unique
  description_en        String
  description_nl        String
  waste_stream_id       String
  recycled_pct_default  Decimal  @default(0)
  reused_pct_default    Decimal  @default(0)
  disposed_pct_default  Decimal  @default(0)
  landfill_pct_default  Decimal  @default(0)
  is_active             Boolean  @default(true)
  created_at            DateTime @default(now())

  waste_stream  WasteStream    @relation(fields: [waste_stream_id], references: [id])
  assets        Asset[]
  sorting_lines SortingLine[]
}

model InboundOrder {
  id                        String      @id @default(uuid())
  order_number              String      @unique
  carrier_id                String
  supplier_id               String
  planned_date              DateTime
  planned_time_window_start DateTime?
  planned_time_window_end   DateTime?
  expected_skip_count       Int         @default(1)
  waste_stream_id           String
  afvalstroomnummer         String?
  notes                     String?
  status                    OrderStatus @default(PLANNED)
  is_adhoc                  Boolean     @default(false)
  created_by                String
  created_at                DateTime    @default(now())
  updated_at                DateTime    @updatedAt

  carrier           Carrier         @relation(fields: [carrier_id], references: [id])
  supplier          Supplier        @relation(fields: [supplier_id], references: [id])
  waste_stream      WasteStream     @relation(fields: [waste_stream_id], references: [id])
  created_by_user   User            @relation(fields: [created_by], references: [id])
  weighing_events   WeighingEvent[]
}

model WeighingEvent {
  id              String              @id @default(uuid())
  order_id        String
  vehicle_id      String
  arrived_at      DateTime            @default(now())
  gross_ticket_id String?             @unique
  tare_ticket_id  String?             @unique
  gross_weight_kg Decimal?
  tare_weight_kg  Decimal?
  net_weight_kg   Decimal?
  status          WeighingEventStatus @default(PENDING_GROSS)
  confirmed_by    String?
  confirmed_at    DateTime?
  notes           String?

  order             InboundOrder    @relation(fields: [order_id], references: [id])
  vehicle           Vehicle         @relation(fields: [vehicle_id], references: [id])
  gross_ticket      PfisterTicket?  @relation("GrossTicket", fields: [gross_ticket_id], references: [id])
  tare_ticket       PfisterTicket?  @relation("TareTicket", fields: [tare_ticket_id], references: [id])
  confirmed_by_user User?           @relation(fields: [confirmed_by], references: [id])
  assets            Asset[]
  sorting_session   SortingSession?
}

model PfisterTicket {
  id                 String   @id @default(uuid())
  ticket_number      String   @unique
  weighing_type      String
  weight_kg          Decimal
  unit               String   @default("kg")
  timestamp          DateTime
  raw_payload        String
  is_manual_override Boolean  @default(false)
  override_reason    String?
  override_by        String?
  created_at         DateTime @default(now())

  gross_event WeighingEvent? @relation("GrossTicket")
  tare_event  WeighingEvent? @relation("TareTicket")
}

model Asset {
  id                   String   @id @default(uuid())
  asset_label          String   @unique
  weighing_event_id    String
  skip_type            SkipType
  material_category_id String
  estimated_volume_m3  Decimal?
  gross_weight_kg      Decimal?
  tare_weight_kg       Decimal?
  net_weight_kg        Decimal?
  notes                String?
  created_at           DateTime @default(now())

  weighing_event    WeighingEvent   @relation(fields: [weighing_event_id], references: [id])
  material_category ProductCategory @relation(fields: [material_category_id], references: [id])
  sorting_lines     SortingLine[]
}

model SortingSession {
  id                String        @id @default(uuid())
  weighing_event_id String        @unique
  order_id          String
  recorded_by       String
  recorded_at       DateTime      @default(now())
  status            SortingStatus @default(DRAFT)
  notes             String?

  weighing_event   WeighingEvent @relation(fields: [weighing_event_id], references: [id])
  recorded_by_user User          @relation(fields: [recorded_by], references: [id])
  sorting_lines    SortingLine[]
}

model SortingLine {
  id                   String  @id @default(uuid())
  session_id           String
  asset_id             String
  category_id          String
  net_weight_kg        Decimal
  recycled_pct         Decimal
  reused_pct           Decimal
  disposed_pct         Decimal
  landfill_pct         Decimal
  downstream_processor String?
  notes                String?

  session  SortingSession  @relation(fields: [session_id], references: [id])
  asset    Asset           @relation(fields: [asset_id], references: [id])
  category ProductCategory @relation(fields: [category_id], references: [id])
}

model Report {
  id                String   @id @default(uuid())
  type              String
  generated_by      String
  generated_at      DateTime @default(now())
  parameters_json   Json
  file_path_pdf     String?
  file_path_xlsx    String?

  generated_by_user User @relation(fields: [generated_by], references: [id])
}

model ReportSchedule {
  id               String    @id @default(uuid())
  report_type      String
  frequency        String
  day_of_week      Int?
  day_of_month     Int?
  recipient_emails String[]
  format           String
  parameters_json  Json
  is_active        Boolean   @default(true)
  last_run_at      DateTime?
  next_run_at      DateTime
  created_at       DateTime  @default(now())
}

model AuditLog {
  id          String   @id @default(uuid())
  user_id     String
  action      String
  entity_type String
  entity_id   String
  diff_json   Json
  timestamp   DateTime @default(now())
  ip_address  String?

  user User @relation(fields: [user_id], references: [id])
}
```

---

## 10. UI/UX Requirements

### 10.1 General Principles

- Minimum click rule: The gate operator must complete a full weighing event (arrival through confirmation) in no more than 4 primary action clicks, not counting data entry.
- Large touch targets: All primary action buttons must be at least 48px tall.
- Status is always visible: Every screen dealing with an order or weighing event must show the current status badge in a fixed location.
- No data loss on navigation: All forms auto-save as draft to sessionStorage on every change. On return, draft is restored with a banner: "You have unsaved changes."
- Confirmation for destructive actions: Any irreversible action requires a confirmation dialog.

### 10.2 Navigation Structure

Top navigation bar (always visible):
- Left: Statice logo + "MRF Dashboard" text
- Centre: main nav links (visible based on role):
  - Dashboard (all roles)
  - Orders (LOGISTICS_PLANNER, ADMIN)
  - Arrivals (GATE_OPERATOR, ADMIN)
  - Reports (REPORTING_MANAGER, ADMIN)
  - Admin (ADMIN only)
- Right: user name + role badge + logout button

Dashboard Page (/dashboard — visible to all roles):
- Widget 1: Today's inbound orders count (planned vs arrived vs completed)
- Widget 2: Today's arrivals list (live, auto-refreshes every 30 seconds)
- Widget 3: Pending weighing events (orders in ARRIVED or IN_PROGRESS)
- Widget 4: Recent reports (last 5 generated)

### 10.3 Colour Coding

Status badges use consistent colours throughout the application:

| Status | Colour | Hex |
|--------|--------|-----|
| PLANNED | Grey | #9CA3AF |
| ARRIVED | Blue | #3B82F6 |
| IN_PROGRESS | Amber | #F59E0B |
| COMPLETED | Green | #10B981 |
| CANCELLED | Red | #EF4444 |
| PENDING_GROSS | Grey | #9CA3AF |
| GROSS_COMPLETE | Blue | #3B82F6 |
| PENDING_TARE | Amber | #F59E0B |
| TARE_COMPLETE | Teal | #14B8A6 |
| CONFIRMED | Green | #10B981 |

### 10.4 Key Screen Wireframe Descriptions

Weighing Event Screen (most critical for gate operator):
- Three-column layout on desktop (min 1280px wide)
- Left column (25%): order summary, vehicle info, notes
- Centre column (50%): weighing controls — dominant, large buttons, clear status progression indicators
- Right column (25%): skip list, add skip button
- On screens below 1280px: single-column stacked layout

Sorting Entry Screen:
- Tab-based layout (one tab per skip)
- Within each tab: summary bar at top showing unallocated weight (turns red if over 100% allocated)
- Line-item table with inline editing

### 10.5 Error Handling

- All API errors: toast notification (top-right, 5-second auto-dismiss) with error message.
- Network errors: persistent banner "Connection lost — changes may not be saved" until connectivity is restored.
- Form validation errors: appear inline below the relevant field in red, immediately on blur.
- 404 pages: friendly message with "Back to Dashboard" button.

---

## 11. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Availability | 99% uptime during operational hours: 06:00–18:00 Monday–Saturday |
| Performance | API responses under 500ms for standard operations; report generation under 10 seconds for 12-month datasets |
| Scalability | Support up to 250 inbound weighing events per day without performance degradation |
| Data Retention | All records retained for a minimum of 10 years (Dutch statutory requirement) |
| Auditability | Every create/update/delete action recorded in AuditLog with timestamp, user ID, entity type, entity ID, and before/after diff |
| Security | JWT auth with HttpOnly refresh token cookie; all endpoints require valid JWT; role checks on every protected endpoint; HTTPS enforced in production |
| Localisation | UI language: English. Dutch date/number formatting in regulatory reports. |
| Browser Support | Latest Chrome, Firefox, Edge (current and previous major version) |
| Database | All queries via Prisma parameterised queries. No raw SQL with user input. |

---

## 12. Out of Scope

The following are explicitly NOT included in this implementation. Do not build, stub, or reference these features.

| Feature | Notes |
|---------|-------|
| Outbound logistics planning | Not in scope |
| Vehicle scheduling for outbound | Not in scope |
| Mobile application | Separate PRD; do not build |
| Client / supplier portal | Not in scope |
| Invoicing and invoice sharing | Not in scope |
| DIWASS API integration | Not in scope. Do not build any DIWASS submission logic. |
| Cross-border shipment processes | Not in scope |
| Asset management for Statice-owned equipment | Not in scope |
| SMS notifications | Not in scope |
| Multi-facility / multi-tenant support | Single facility only |
| Real Pfister TCP/IP integration | Simulated only. Implement the pfisterService interface contract in Section 6.2. The real integration replaces only pfisterSimulator.js — no other code should need to change. |

---

## 13. Glossary

| Term | Definition |
|------|------------|
| Afvalstroom | Waste stream — a categorised flow of waste material (e.g. WEEE, plastic, metal) |
| Afvalstroomnummer | Dutch waste stream registration number assigned by authorities |
| Asset / Bak / Skip | A container unit transported on a vehicle chassis; multiple skips may be on a single vehicle |
| Asset Label | Human-readable unique identifier for a skip, format: SKP-YYYYMMDD-NNN |
| CBS | Centraal Bureau voor de Statistiek — Statistics Netherlands |
| Circularity Statement | Report showing recovery percentages per material stream (RPT-01) |
| Dashboard | The application described in this PRD |
| DIWASS | Digitaal InzamelWerk Afval Statistieken Systeem — mandatory Dutch digital waste reporting system (out of scope) |
| Gross Weight | Total weight of vehicle plus cargo |
| KvK | Kamer van Koophandel — Dutch Chamber of Commerce |
| LMA | Landelijk Meldpunt Afvalstoffen — National Waste Reporting Centre |
| Net Weight | Gross weight minus tare weight; actual weight of cargo payload |
| Pfister | Brand name of the weighbridge system at the Statice facility |
| PRO | Producer Responsibility Organisation — e.g. Stichting Open |
| Stichting Open | Dutch foundation operating e-waste collection containers; primary PRO supplier |
| Tare Weight | Weight of the empty vehicle or container |
| WEEE | Waste Electrical and Electronic Equipment — EU regulatory category covering e-waste |
| Weighing Event | A single vehicle visit: gross weighing + skip registration + tare weighing + confirmation |

---

*This document is the implementation source of truth for Claude Code.*  
*All scope changes require explicit update to this document before implementation begins.*  
*Document Version: 2.0 | Last Updated: 03 March 2026 | Status: Implementation Ready*
