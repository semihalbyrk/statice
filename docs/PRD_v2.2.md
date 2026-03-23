

ℹ  Note: This document supersedes PRD v2.1. Key changes in v2.2: seven new functional modules added (Transport & Logistics MOD-02, Inventory & Bay Management MOD-04, Outbound Sales & WSR MOD-06, QC & Reject Handling MOD-07, Dashboard MOD-08, Customer Portal MOD-09, Hardware Reuse MOD-10); four new cross-cutting requirements (Document Store, Mobile/Tablet, QR Codes, EWC Permit Management); Pricing Engine formalised; Roles table extended; Data Model updated throughout; Roadmap revised to absorb new modules; Glossary and Open Items updated from Engineering Specification v1.0.

# 1.  Executive Summary
Statice B.V. operates a certified e-waste recycling and re-use facility (Material Recovery Facility, MRF) at De Oude Kooien 15, Beringe. The facility receives inbound cargo from Stichting Open — the Producer Responsibility Organisation (PRO) for WEEE in the Netherlands — and from third-party transporters. Material flows must be fully traceable for regulatory reporting to the LMA, CBS, Provincie, and ILT, as well as for WEEELABEX certification, Stichting Open traceability statements, and internal audit purposes. From 21 May 2026, all cross-border waste shipments must be registered digitally in the EU DIWASS system under EU Regulation 2024/1157.
This PRD v2.2 defines the complete functional and non-functional requirements for the Statice MRF platform (ICMS) to be developed by Evreka Sales. It supersedes PRD v2.1 and incorporates seven new functional modules derived from the Engineering Specification v1.0 (March 2026): Transport & Logistics, Inventory & Bay Management, Outbound Sales & WSR Compliance, Quality Control & Reject Handling, Dashboard, Customer Portal, and Hardware Reuse & Webshop Handover. Cross-cutting requirements for Document Store, Mobile/Tablet interface, QR Code generation, and EWC Permit Management have been formalised. The Pricing Engine requirement has been added. The Release Roadmap, Roles, Data Model, Glossary, and Open Items have all been updated accordingly.

Eight capability areas are addressed:
- Inbound cargo handling — registration of inbound deliveries from all supplier types (PRO, Commercial, Ad-hoc/Private Individual); Supplier Master and Supplier Contract management; asset tracking; order management.
- Pfister weighbridge integration — bidirectional, real-time, tamper-evident weight capture.
- Processing and cataloguing — e-waste categorisation, WEEELABEX-compliant material recording, recycling outcome tracking.
- Financial module — invoice preparation (outbound and pro-forma), inbound invoice validation, payment status monitoring, and Exact Online API integration. Full in-house accounting capabilities are out of scope.
- Regulatory reporting — LMA (AMICE), WEEELABEX (EN 50625), CBS, Stichting Open traceability statements.
- Outbound logistics — transport document generation, processor certificate management, EVOA/DIWASS integration.
- Platform services — role-based access, audit trail, document vault, notification engine, subcontractor portal.
- BI Dashboard — interactive waste flow visualisation, filterable by date range, supplier, and material fraction, with Sankey flow diagram and recovery breakdown views.

# 2.  Background and Context
## 2.1  Business Context
Statice B.V. processes WEEE and other recyclable materials at its MRF (permit PL 04/73113, Provincie Limburg). The facility receives inbound material from three supplier categories: (1) Stichting Open, acting as the national Producer Responsibility Organisation (PRO) for WEEE, which organises and finances collection and transport from its container network across the Netherlands and has the most structured contractual and regulatory obligations; (2) commercial businesses and corporates — businesses, retailers, IT departments, and institutions — each with individually negotiated contracts, pricing models, and material categories; and (3) private individuals delivering material on an ad-hoc basis without a pre-existing contract.
Each inbound delivery may contain more than fifty distinct material categories — from circuit boards to monitors, modems, and cables. The facility must report per product category to statutory bodies (CBS, LMA, Provincie) while providing suppliers with traceability statements covering material recovery volumes, recycled/reused/disposed/landfill percentages, and chain-of-custody to downstream processors.


## 2.2  Current State (As-Is)
The existing process is entirely manual and paper-based. The Pfister weighbridge issues carbon-copy tickets. Up to two assets (three for LZV vehicles) may arrive on a single chassis and must be registered separately yet linked to one order. Incoming container contents are assessed, weighed, recorded, and documented by hand. Reporting is produced manually and split by supplier and waste stream. Invoicing to Stichting Open is produced manually; reconciliation between Pfister weight data and contract rates requires manual cross-referencing.

## 2.3  Drivers for Change
- Elimination of manual data-entry errors and associated compliance risk.
- DIWASS API integration, mandatory from 21 May 2026 (EU Regulation 2024/1157).
- Scalability as delivery volumes and supplier diversity increase.
- Structured invoice workflow linked to Exact Online accounting platform via API, replacing manual invoice preparation.
- BI Dashboard providing real-time visibility of waste flows to management.

# 3.  Goals and Objectives

# 4.  Scope
## 4.1  In Scope
- Supplier Master — registration and management of all supplier types (PRO, Commercial, Ad-hoc); Supplier Contracts with per-supplier pricing models, material scope, payment terms, contamination rules, and regulatory obligations.
- Inbound cargo registration module (arrivals, linked to Supplier Master, carriers, vehicles, waste streams).
- Pfister weighbridge integration (gross, tare, net weight; ticket number; timestamp).
- Multi-asset registration (1–3 per event) with LZV enforcement and order matching.
- Order management for planned and unplanned inbound deliveries, including Transport Mode and Workorder linkage.
- Transport & Logistics (MOD-02) — inbound collection workorders, own fleet and outsourced transporter management, driver/vehicle assignment, outsourced transporter notification.
- Inventory & Bay Management (MOD-04) — location tracking (bay, shelf, slot) for received materials; EoW status flag; storage suggestion logic; inventory status lifecycle.
- E-waste cataloguing and device processing / material outcome recording with WEEE Directive Annex III category auto-assignment.
- Contract rate management and contamination fee calculation.
- Quality Control & Reject Handling (MOD-07) — inbound QC inspection against permitted EWC codes, reject procedure, Claim Report generation, photo capture, EWC permit management.
- Outbound Sales & WSR Compliance (MOD-06) — Sales Order management, material classification (EoW vs Waste), transport document generation (CMR, Annex VII, Begeleidingsbrief, Weighbill, FAK freight note), PIC pre-notification tracking, pre-DIWASS and post-DIWASS workflows, WSR compliance checklist gate.
- Document Store — centralised, version-controlled document vault with polymorphic entity linkage and sharing tracking.
- Pricing Engine — per-material pricing, per-counterparty overrides, date-range validity, auto-population on Order / SO creation.
- QR Code generation for output parcels and outbound pallets (ISO 18004), label printer support.
- Invoice workflow: outbound invoice preparation, pro-forma invoices, inbound invoice validation, payment status monitoring.
- Financial Integration API: Exact Online adapter (pushSalesEntry, pushPurchaseEntry, getPaymentStatus, syncRelation).
- Reporting module (RPT-01 to RPT-13), LMA/AMICE, WEEELABEX, CBS reporting.
- DIWASS API integration (Bijlage VII and transport notifications, mandatory by 21 May 2026).
- Role-based access control (10 roles including Sales, QC Inspector, Logistics Coordinator, Customer portal).
- BI Dashboard — waste flow visualisation with Sankey diagram, date/supplier/material filters, breakdown views.
- Mobile/Tablet interface (PWA or responsive web) for Weighbridge registration, WEEE sorting, QC inspection, and Reuse assessment.
- Hardware Reuse & Webshop Handover (MOD-10) — device repair logging, QC gate (PASS/FAIL), inventory booking and webshop entity transfer record.
- Customer Portal (MOD-09, Phase 2) — supplier self-service: invoices, Processor Attestations, quality claims, Purchase Orders.

## 4.2  Out of Scope (This PRD)
- Full in-house accounting: invoice numbering, PDF generation with VAT-compliant letterhead, and email dispatch from ICMS (Paths A & B from PRD v2.0). These capabilities are removed from scope.
- Multiple accounting platform connectors at go-live — only Exact Online at initial launch; Twinfield/AFAS Profit deferred to Phase 6A.
- Invoicing and invoice-sharing workflows beyond the scope defined in Section 6.8.
- Webshop platform itself — only the handover record and transfer API/export from ICMS to the webshop entity is in scope.
- Native mobile app (iOS/Android) — PWA / responsive web is the target; a native app is a separate PRD if required.
- Asset management for Statice-owned containers and equipment.
- Multi-currency support — EUR only at initial launch; deferred pending confirmation of international buyer requirements.

# 5.  Stakeholders


# 6.  Functional Requirements
## 6.1  Inbound Cargo Registration
### 6.1.1  Arrival Registration

### 6.1.2  Asset / Asset Registration

### 6.1.3  Order Management

## 6.2  Pfister Weighing System Integration
### 6.2.1  Integration Architecture

## 6.3  E-waste Cataloguing

## 6.4  Device Processing and Material Outcome Recording

## 6.5  Supplier Master and Multi-Supplier Management
New in v2.1  Stichting Open is one supplier acting in a PRO capacity. Statice receives material from multiple other supplier types, each with their own contracts, price agreements, and conditions. All suppliers must be registered and all deliveries recorded against a supplier record.

### 6.5.1  Supplier Types
The ICMS shall support the following supplier classifications. Each inbound order shall be linked to exactly one registered supplier record carrying one of these types:


### 6.5.2  Supplier Record Requirements

### 6.5.3  Supplier Contract Requirements
Each supplier shall have at least one Supplier Contract before deliveries can be invoiced. A contract encapsulates all commercial and operational conditions governing deliveries from that supplier. Contract content differs significantly between supplier types.


### 6.5.4  Delivery Recording per Supplier

## 6.6  Contract Rate Management

## 6.7  Contamination Penalties and Sorting Fees


## 6.8  Invoice Workflow
Revised in v2.1 — full in-house invoicing (Paths A & B) removed from scope; Exact Online API integration retained as the primary financial data channel.

### 6.8.1  Overview
The ICMS shall provide a structured invoice workflow covering four document types: outbound invoices to suppliers/clients, pro-forma invoices for advance payment, inbound invoice receipt and validation, and payment status monitoring. All financial document data shall be persisted in the ICMS and synchronised with Exact Online via the Financial Integration API (Section 6.9).

### 6.8.2  Invoice Statuses

### 6.8.3  Outbound Invoice Preparation

### 6.8.4  Pro-Forma Invoice
A pro-forma invoice is a preliminary billing document issued before delivery or processing is complete, enabling advance payment. Pro-forma invoices are not posted to the accounting ledger.


### 6.8.5  Inbound Invoice Receipt and Validation
Statice receives invoices from carriers, processors, and other service suppliers. These must be checked against ICMS data (weights, order references) before approval for payment.


### 6.8.6  Payment Status Monitoring
Payment status for both outbound and inbound invoices shall be synchronised from Exact Online. The ICMS shall not process payments; it shall display and react to payment data received via the Financial Integration API.


### 6.8.7  Invoice Document Formatting


## 6.9  Financial Integration API
Revised in v2.1 — simplified to four adapter operations; full ledger sync, multi-connector at launch, and GL/BTW bulk sync de-scoped.

### 6.10.1  Architecture
The Financial Integration API connects the ICMS to an external accounting platform using an adapter pattern. The adapter abstracts platform-specific endpoints so that the ICMS application layer calls a uniform internal interface regardless of which accounting platform is connected. Exact Online is the reference implementation. The design shall accommodate future addition of alternative connectors (Twinfield, AFAS Profit) without changes to the ICMS application layer.

### 6.10.2  Adapter Operations
The adapter shall implement exactly the following four operations:


### 6.9.3  General Integration Requirements

### 6.9.4  Exact Online Reference Connector
Exact Online (Exact Software B.V.) is the reference accounting platform. The Exact Online connector shall be the first connector delivered.


ℹ  Note: Known Exact Online API constraints: (1) No $expand support — header and lines fetched in separate calls; (2) No REST endpoint for payment reconciliation — getPaymentStatus uses ReceivablesList polling; (3) App instance restriction until App Center approval — registered per Statice BV instance; (4) 60 requests/minute rate limit — token bucket implemented with exponential back-off queue.


## 6.10  Reporting Module
### 6.10.1  Report Types

### 6.10.3  RPT-07 — Processor Attestation
The Processor Attestation is a per-consignment, per-product-category material traceability document issued by Statice to suppliers. It corresponds to the Statice concept document (Statice_ProcessorAttest.pdf) and demonstrates the fate of each material fraction derived from the supplier's delivered equipment.

Each attestation shall contain:
- Header: Statice logo, period (date of processing), product (equipment type), product category, total amount (kg).
- Supplier block (highlighted): supplier name, address, postcode/city, company registration number (KvK).
- Summary row: Recycled %, Recovered %, Reuse %, Disposal % of total inbound weight.
- Materials table: one row per recovered material fraction. Columns: Material | Recycled (Kg) | Recovered (Kg) | Reused (Kg) | Residue (Kg) | Processor Name | Processor Country.
- Total row: column sums for all kg columns.
- Footer: Statice facility details, permit reference, applicable standards (WEEELABEX EN 50625, WEEE Directive 2012/19/EU).


### 6.10.4  Reporting Functional Requirements

## 6.11  LMA Reporting
Statice BV is verplicht maandelijkse ontvangstmeldingen te doen aan het LMA via AMICE (Rijkswaterstaat) conform het Besluit melden bedrijfsafvalstoffen en gevaarlijke afvalstoffen.


## 6.12  WEEELABEX Reporting (EN 50625)
WEEELABEX compliance (CENELEC EN 50625 series) is mandatory in the Netherlands since 2015. Statice MRF shall generate all WEEELABEX audit evidence from operational data.


## 6.13  Processor Certificate Management

## 6.14  Outbound Delivery Management

## 6.15  DIWASS Integration (EU Regulation 2024/1157 — Mandatory from 21 May 2026)
From 21 May 2026, all cross-border waste shipments involving at least one EU Member State must be registered digitally in DIWASS. This replaces MijnILT and the DNA-tool. Statice BV must register in DIWASS as receiver (inbound) and as kennisgever/sender (outbound cross-border).



## 6.16  BI Dashboard — Waste Flow Visualisation
New in v2.1 — interactive waste flow intelligence dashboard for management and reporting users.

### 6.16.1  Overview
The ICMS shall include an interactive BI Dashboard (Waste Flow Overview) providing real-time visualisation of all waste flows handled at the Statice facility. The dashboard shall be filterable by date range, supplier, and material fraction, and shall update within two seconds of filter changes.

### 6.16.2  Dashboard Requirements


## 6.17  Transport & Logistics (MOD-02)
[NEW v2.1] — Transport workorder management for inbound collection and outbound delivery operations.

### 6.17.1  Transport Workorder Requirements

## 6.18  Inventory & Bay Management (MOD-04)
[NEW v2.1] — Location tracking of received materials within the Statice facility.

### 6.18.1  Inventory Requirements

## 6.19  Outbound Sales, Transport & WSR Compliance (MOD-06)
[NEW v2.1] — Sales Order management, material classification, transport document generation, and WSR compliance gate.

### 6.19.1  Material Classification
ℹ  Note: The system must determine material type at Sales Order line level. This is the central branching decision for all outbound transport and document requirements.

### 6.19.2  Sales Order Requirements

### 6.19.3  Document Generation
ℹ  Note: The following matrix defines required documents per shipment type. All documents shall be generatable as PDF and stored in the Document Store.

### 6.19.4  WSR Compliance & DIWASS Workflow

## 6.20  Quality Control & Reject Handling (MOD-07)
[NEW v2.1] — Inbound QC inspection against permitted EWC codes, reject procedure, and Claim Report generation.


## 6.21  Dashboard / Operator Screen (MOD-08)
[NEW v2.1] — Live KPI display screen for the warehouse. Phase 2. Backend API endpoints shall be built from MVP onwards.


## 6.22  Customer Portal (MOD-09)
[NEW v2.1] — Supplier self-service portal. Phase 2. Multi-tenant data access control shall be designed from MVP.


## 6.23  Hardware Reuse & Webshop Handover (MOD-10)
[NEW v2.1] — Device repair tracking, QC gate, and handover to webshop entity. Phase 2.


## 6.24  Cross-Cutting Requirements
[NEW v2.1] — System-wide requirements applicable across all modules.

### 6.24.1  Document Store

### 6.24.2  Mobile / Tablet Interface

### 6.24.3  QR Code Generation

### 6.24.4  EWC Permit & Pricing Engine


# 7.  Non-Functional Requirements


# 14.  Proposed Release Roadmap
[REVISED v2.1] — Phases 1, 2, 3, 7 and 8 updated to absorb new modules (MOD-02, MOD-04, MOD-06, MOD-07, MOD-08, MOD-09, MOD-10).
Revised in v2.1 — Phase 5 simplified (financial core without in-house invoicing add-on); Phase 7 (In-house Invoicing Add-on) removed; BI Dashboard added to Phase 7 (renumbered); Phase 8 renumbered.


# 15.  Glossary

# 17.  Open Items and Decisions Required
[REVISED v2.1] — Twenty open items (OI-01–OI-08 carried from v2.1; OI-09–OI-20 new from Engineering Specification v1.0).



# 18.  Document Approvals


ℹ  Note: This document supersedes PRD v2.1 (March 2026), PRD v2.0 (March 2026), and PRD v1.0 (27 February 2026). It is subject to version control. Any changes after initial sign-off shall be recorded in the document revision history and require re-approval by all named signatories.

| STATICE B.V.  ·  EVREKA ENGINEERING
Statice MRF — Inbound Cargo Management System
Product Requirements Document
Version 2.1  ·  Final Draft  ·  12 March 2026 |
| --- |


| Document | Product Requirements Document — ICMS |
| --- | --- |
| Client | Statice B.V. |
| E-waste PRO (Supplier) | Stichting Open |
| Prepared by | Evreka Sales |
| Document version | 2.2 — Draft for Review |
| Supersedes | PRD v2.1 (March 2026) · PRD v2.0 (March 2026) · PRD v1.0 (27 February 2026) |
| Date | 12 March 2026 |
| Classification | Confidential |
| Status | For Review & Approval |


| ID | Objective | Success Metric |
| --- | --- | --- |
| G-01 | Eliminate paper weight tickets for inbound weighing. | 100% of inbound weighings captured digitally within 60 days of go-live. |
| G-02 | Support registration of 1–3 assets per weighing, matched to a single order. | System correctly links all assets per truck to one order in all test cases. |
| G-03 | Integrate with Pfister weighing system for automated weight capture. | Zero manual weight transcription errors post-integration. |
| G-04 | Produce compliant regulatory and supplier reports. | Reports accepted by CBS, LMA, and Provincie without manual rework. |
| G-05 | Provide complete chain-of-custody traceability per material stream. | Full audit trail available for any inbound consignment within 10 seconds. |
| G-06 | Structured invoice workflow with Exact Online API integration. | Invoices prepared in ICMS, pushed to Exact Online within 5 minutes of approval; payment status visible in ICMS within 30 minutes of receipt. |
| G-07 | Interactive BI Dashboard for waste flow visualisation. | Dashboard responsive to filter changes within 2 seconds for 12-month datasets. |


| Role | Organisation | Interest / Use |
| --- | --- | --- |
| Sales / Back-office | Statice BV | Create Orders and Sales Orders, manage pricing, generate sales offers, send documents to buyers and sellers. |
| Gate / Weighbridge Operator | Statice BV | Fast, accurate recording of arriving vehicles and asset weights; weighbill printing. |
| Floor Operator / QC Inspector | Statice BV | E-waste cataloguing, device processing records, contamination incident logging, inbound QC, reject procedure, photo capture. |
| Logistics Coordinator | Statice BV | Transport workorder creation, driver and transporter assignment, outsourced transporter notification. |
| Logistics Planner | Statice BV | Planned and unplanned delivery visibility, order management, outbound delivery planning. |
| Finance User | Statice BV | Invoice preparation, inbound invoice validation, Exact Online sync. |
| Finance Manager | Statice BV | Invoice approval, payment status oversight, payment dashboard. |
| Reporting Manager | Statice BV | Automated compliant regulatory and supplier reports, LMA/AMICE submissions. |
| Compliance Officer | Statice BV | WSR/PIC pre-notification management, WEEELABEX and DIWASS certification documentation, EWC permit maintenance. |
| System Administrator | Statice BV / Evreka | RBAC management, GL/BTW code configuration, EWC/EoW settings, master data maintenance. |
| Carrier / Supplier (Portal) | External | Receipt confirmation, weight tickets, portal access: invoices, Processor Attestations, claims. |
| Stichting Open (PRO) | External | Traceability statements, recovery certificates, afvalstroomnummer data. |
| CBS / Provincie / LMA / ILT | Statutory bodies | Accurate material-flow statistics, regulatory submissions. |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| ICR-01 | The system shall allow an operator to create an inbound delivery record by entering the supplier and vehicle license plate. | Must |
| ICR-02 | The system shall associate each delivery with a carrier, a supplier (selected from the Supplier Master, Section 6.5), and an order reference. The supplier type shall be displayed alongside the supplier name at all stages of the delivery workflow. | Must |
| ICR-03 | The system shall support unplanned arrivals where no pre-existing order exists, allowing ad-hoc order creation and automatic logistics planner notification. | Must |
| ICR-04 | The system shall record date and time of arrival automatically from the server clock. | Must |
| ICR-05 | The system shall allow selection of the waste stream category (afvalstroom) from a configurable master list including WEEE, plastic, metals, and mapped CBS/WEEELABEX codes. | Must |
| ICR-06 | The system shall display a daily planning board showing all planned and arrived deliveries, filterable by carrier, supplier, supplier type (PRO / Commercial / Ad-hoc), waste stream, and status. | Must |
| ICR-07 | The system shall allow operators to record a free-text note per delivery with an incident category (Damage, Dispute, Special Handling, Driver Instruction). Dispute or Damage notes shall trigger automatic notifications to the logistics planner and finance manager. | Must |
| ICR-08 | The system shall provide a subcontractor notification portal allowing transporters to self-select a delivery time slot. The logistics planner shall be able to confirm or reschedule the slot. | Should |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| SKP-01 | The system shall support registration of 1, 2, or 3 assets per inbound weighing event. Maximum enforced per vehicle type: standard = 2, LZV = 3. The operator shall set the LZV flag at arrival; the system shall block registration of >2 assets without the flag. | Must |
| SKP-02 | Each asset shall be assigned a unique system-generated asset-ID printed on a label and affixed to the asset at the weighbridge. | Should |
| SKP-03 | The system shall allow operators to scan or manually enter an existing asset-ID to re-use a previously registered asset. | Should |
| SKP-04 | All assets registered within a single inbound weighing event shall be automatically linked to the same parent order. | Must |
| SKP-05 | Each asset record shall capture: asset-ID, asset type, material category, estimated volume, gross weight, tare weight, and net weight from Pfister integration. | Must |
| SKP-06 | The system shall prevent closing an inbound weighing event unless at least one asset is registered and all registered assets have confirmed weights. | Must |
| SKP-07 | A single container may carry materials from more than fifty distinct material sub-categories. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| ORD-01 | The system shall maintain a list of planned inbound orders comprising: order number, carrier, supplier, expected waste stream, expected date/time window, LZV flag, and expected number of assets. | Must |
| ORD-02 | On vehicle arrival, the system shall attempt automatic order matching using vehicle registration plate and expected date. Where a match is found, the operator shall confirm or override. | Must |
| ORD-03 | The system shall support partial deliveries whereby only a subset of planned assets arrive in a single vehicle visit. | Must |
| ORD-04 | An order shall progress through: Planned → Arrived → In Progress → Dispute → Completed → Invoiced. | Must |
| ORD-05 | The system shall send an automated notification to the logistics planner when a delivery arrives without a matching order. | Should |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| PFI-01 | The ICMS shall integrate with the Pfister weighing system using the documented Pfister communication protocol (serial RS-232 / TCP/IP data interface, as configured at site). | Must |
| PFI-02 | The integration shall operate in real time; weight data shall appear in the ICMS within three seconds of the Pfister system finalising a weighing. | Must |
| PFI-03 | The system shall capture from Pfister: ticket number, gross weight, tare weight, net weight, unit of measure (kg), date, and time. | Must |
| PFI-04 | The system shall support both first-weighing (gross) and second-weighing (tare) events, calculating net weight automatically. | Must |
| PFI-05 | Where a vehicle carries multiple assets, the system shall allow the operator to associate gross and tare readings with each individual asset rather than the combined vehicle weight. | Must |
| PFI-06 | The system shall store the raw Pfister data packet alongside the parsed record to facilitate dispute resolution. | Must |
| PFI-07 | In the event of integration failure, the system shall present a clearly marked manual-entry fallback form and alert the system administrator. | Must |
| PFI-08 | All weight records shall be immutable after supervisor confirmation; any amendment shall create a new version with a reason code and the supervisor's identity. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| CAT-01 | The system shall provide a catalogue entry screen allowing floor operators to record, per asset, the device types present (from a CBS/WEEELABEX-aligned product category master) and estimated quantities. | Must |
| CAT-02 | Product categories shall be mapped to CBS product codes, WEEELABEX groups (EN 50625-1 §6), EURAL codes, and afvalstroomnummers. This mapping shall be configurable by an administrator. | Must |
| CAT-03 | The system shall allow floor operators to flag individual devices as Reuse-Eligible. Reuse-eligible devices shall be separated in processing records. | Must |
| CAT-04 | The system shall enforce that landfill destination (D1) is only assignable by a supervisor with a mandatory reason code. Any landfill assignment shall trigger an alert to the Compliance Officer. | Must |
| CAT-05 | The catalogue entry screen shall support rapid keyboard-driven material line entry for operator efficiency. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| PRO-01 | The system shall allow floor operators to create a processing record. The operator shall select the product type from a dropdown list. The system shall automatically assign the correct WEEE Directive 2012/19/EU Annex III category based on the selected product (e.g. Desktop PC → Cat. 6 Small IT & Telecommunication Equipment). The product list and its category mappings shall be configurable by an administrator. | Must |
| PRO-02 | The sum of outcome weights per material line shall equal the net weight from the Pfister weighbridge (tolerance: ±1 kg). The system shall display a real-time balance indicator and block confirmation until the material lines balance to the total net weight. | Must |
| PRO-03 | When a processing record is finalised, the system shall update the order status to Completed and trigger invoice basis assembly. | Must |
| PRO-04 | The system shall validate that the selected downstream processor holds a valid certificate for the material category on the transfer date (see Section 6.14). | Must |
| PRO-05 | Processing records shall be immutable after Compliance Officer confirmation. Amendments shall create a versioned record with reason code and approver identity. | Must |


| Supplier Type | Examples | Key Characteristics |
| --- | --- | --- |
| PRO (Producer Responsibility Organisation) | Stichting Open | Organises and finances WEEE collection on behalf of producers under Dutch WEEE Directive implementation. Has its own afvalstroomnummers. Requires WEEELABEX traceability statements and Stichting Open-format supplier certificates. Contract includes per-category processing fee, recovery rate obligations, and regulatory reporting requirements. This is the primary and most contractually structured supplier type. |
| Commercial / Corporate | Businesses, retailers, IT departments, institutions | Delivers e-waste and recyclable materials for processing. Contract negotiated per client. Pricing model may be weight-based, quantity-based, or hybrid depending on material type and volume. Material categories covered, contamination tolerance, payment terms, and invoicing frequency vary per contract. No afvalstroomnummer obligation; no WEEELABEX statement required unless contractually agreed. |
| Ad-hoc / Private Individual | Private individuals, unregistered walk-in parties | No pre-existing contract. Delivery registered against a system-managed ad-hoc supplier record. A flat rate or no-charge arrangement applies per administrator configuration. Finance Manager may convert an ad-hoc supplier to a standing Commercial contract at any time. |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| SUP-01 | The system shall maintain a Supplier Master containing a record for each registered supplier. Each record shall carry: supplier name, supplier type (from Section 6.5.1), KvK-nummer, BTW-nummer, IBAN, contact name, contact email, contact phone, address, VIHB-number (where applicable), and PRO registration number (where applicable). | Must |
| SUP-02 | Each supplier record shall carry Active / Inactive status. Inactive suppliers shall not be selectable for new inbound orders but shall remain linked to all historical records and reports. | Must |
| SUP-03 | A supplier of type PRO shall be linkable to one or more afvalstroomnummers in the Afvalstroomnummer Master (Section 6.11). Non-PRO suppliers may optionally reference an afvalstroomnummer where one has been assigned. | Must |
| SUP-04 | Each supplier record shall reference one or more Supplier Contracts (Section 6.5.3). A supplier may hold more than one active contract where different contracts govern different material categories or delivery types. | Must |
| SUP-05 | A Finance Manager or Administrator shall be able to create, edit, and deactivate supplier records. All changes shall be audit-logged with timestamp and user identity. | Must |
| SUP-06 | When a supplier record is created or updated, the system shall synchronise it to the connected accounting platform as a debtor or creditor via syncRelation (Section 6.9). | Must |
| SUP-07 | The system shall display a Supplier Overview listing all active suppliers with: name, type, deliveries year-to-date, total inbound weight year-to-date, active contract count, and contract expiry RAG status. | Should |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| SUP-C01 | The system shall maintain a Supplier Contract Master. Each contract record shall carry: contract number, supplier reference, contract name, effective date, expiry date (null = open-ended), status (Draft / Active / Expired / Terminated), and approving Finance Manager identity. | Must |
| SUP-C02 | A contract shall include one or more Material Rate Lines, each specifying: material category, pricing model (weight-based / quantity-based / hybrid), unit rate(s) in EUR, and BTW rate. A single contract may cover multiple material categories at different rates. | Must |
| SUP-C03 | A contract shall include Payment Conditions: payment term (days), invoicing frequency (per order / weekly / monthly / quarterly), currency (default EUR), and preferred invoice delivery method (email / portal). | Must |
| SUP-C04 | A contract shall include Contamination Conditions specific to that supplier: applicable contamination penalty rules (by reference to Fee Master entries in Section 6.7), contamination tolerance threshold (%), responsible party for charges, and whether contamination incidents require Finance Manager review before invoicing. PRO contracts (e.g. Stichting Open) may carry stricter tolerance thresholds and mandatory compliance alerts than Commercial contracts. Ad-hoc supplier records carry zero contamination fee liability by default. | Must |
| SUP-C05 | A contract shall include Regulatory Conditions specifying which reporting obligations apply: (a) WEEELABEX traceability statement required (mandatory for PRO; optional for Commercial; not applicable for Ad-hoc); (b) Stichting Open-format supplier statement (RPT-01) required (mandatory for PRO type only); (c) afvalstroomnummer validation required on each delivery (mandatory for PRO; not applicable for Commercial or Ad-hoc); (d) any additional statutory or contractual reporting requirements. The system shall use these flags to determine which reports are generated and which validations are enforced per delivery. | Must |
| SUP-C06 | A contract shall define the Material Scope: the set of material categories that may be delivered under this contract. Deliveries containing material categories outside the contract scope shall generate a Finance Manager alert. This allows PRO contracts to be restricted to WEEE categories while Commercial contracts may cover a broader or different set of material fractions. | Must |
| SUP-C08 | A contract may include Special Conditions: a free-text field for bespoke clauses such as minimum delivery volumes, collection service inclusions, revenue share arrangements, or material quality guarantees. Special Conditions are visible to Finance Users during invoice preparation. | Should |
| SUP-C08 | When an inbound order is completed, the system shall automatically identify the applicable contract for that supplier and material category. Where no active contract covers the delivered material, the system shall alert the Finance Manager and block invoice basis assembly until a contract is assigned. | Must |
| SUP-C09 | Contract history shall be fully preserved. A superseded contract shall become read-only and remain linked to all orders processed under it, so that historical rate lookups remain accurate indefinitely. | Must |
| SUP-C10 | New contracts and contract amendments shall require Finance Manager approval before activation. Approval shall be logged with timestamp and approver identity. | Must |
| SUP-C11 | The system shall display a Contract Status Dashboard showing per supplier: contract name, effective date, expiry date, days until expiry, and RAG status (Green >= 90 days; Amber 30-89 days; Red < 30 days or expired). | Should |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| SUP-D01 | Every inbound delivery shall be linked to exactly one supplier record. The supplier selected at order creation shall drive the applicable contract, rate lookup, contamination rules, and reporting obligations for that delivery. | Must |
| SUP-D02 | For PRO-type suppliers, the system shall additionally record the afvalstroomnummer applicable to each delivery and validate it against the supplier's registered afvalstroomnummers. | Must |
| SUP-D03 | For Commercial-type suppliers, the system shall allow the operator to record the client's own purchase order or reference number alongside the delivery, enabling client-specific reporting extracts and invoice line matching. | Should |
| SUP-D04 | For Ad-hoc / Private Individual deliveries, the system shall allow the operator to record the individual's name and an optional ID reference. No contract lookup or invoice basis assembly shall be triggered for ad-hoc deliveries unless the Finance Manager explicitly flags the delivery for invoicing. | Must |
| SUP-D05 | The system shall provide a per-supplier inbound history view showing all deliveries, weights by material category, and invoice status for any selectable date range. | Must |
| SUP-D06 | Supplier statements (RPT-01) shall be generatable for any registered supplier, not only for Stichting Open. Statement content, format, and regulatory detail shall be governed by the Regulatory Conditions of the supplier's active contract. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| CRM-01 | The system shall maintain a Contract Rate Master per supplier/PRO and per material category. Each rate record shall specify: supplier, material category, pricing model (weight-based / quantity-based / hybrid), unit rate(s) in EUR, valid-from date, valid-to date (null for open-ended), and approving finance manager identity. | Must |
| CRM-02 | Three pricing models shall be supported: (a) weight-based: unit rate × Pfister net weight (kg); (b) quantity-based: unit rate × number of assets; (c) hybrid: base fee per asset plus variable rate per kg net weight. | Must |
| CRM-03 | Historical contract rates shall be read-only after activation. New rates must have a valid-from date ≥ today. When a new rate is activated, the system shall automatically set the valid-to of the preceding rate to (new valid-from − 1 day). Overlapping rate periods shall be blocked. | Must |
| CRM-04 | New and updated contract rates shall require Finance Manager approval before activation. Approval shall be logged with timestamp and approver identity. | Must |
| CRM-05 | The system shall retrieve the applicable contract rate for the relevant supplier, contract, material category, and delivery date when assembling an invoice from a completed order. | Must |
| CRM-06 | A Finance Manager shall be able to apply a one-off discount override. The override shall capture: discount type, discount value, reason code, free-text explanation, manager identity, and timestamp. All overrides shall be audit-logged; a 'Manually Adjusted' flag shall be set on the affected invoice line. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| CON-01 | The system shall provide a Fee Master for contamination penalty and sorting fee rates, specifiable as: fixed fee per incident, percentage of order value, per-kg rate, or per-hour rate. Minimum and maximum fee caps shall be configurable per fee type. | Must |
| CON-02 | Floor operators shall be able to record a contamination incident against an order or asset, selecting a contamination type (Non-WEEE material, Hazardous material, Excessive moisture, Sorting required), estimating contamination volume or percentage, and optionally adding a photo reference. | Must |
| CON-03 | The system shall automatically calculate the applicable fee from the Fee Master and add it as a separate invoice line item, charged to the configurable responsible party (default: transport organiser). | Must |
| CON-04 | Contamination incidents shall be subject to Finance Manager review before inclusion in a released invoice. Incidents shall be independently auditable. | Must |
| CON-05 | A Hazardous Material detection shall trigger a mandatory compliance alert to the Compliance Officer in addition to the fee calculation. | Must |


| Status | Description | Trigger / Source |
| --- | --- | --- |
| Draft | Invoice prepared but not yet approved or sent. | Finance User |
| Pending Approval | Submitted for internal Finance Manager review. | Finance User → Finance Manager |
| Sent | Dispatched to recipient (outbound) or received (inbound). | System on dispatch / on receipt |
| Awaiting Payment | Invoice sent; payment not yet confirmed. | System on dispatch |
| Partially Paid | Partial payment recorded in Exact Online. | API sync — getPaymentStatus |
| Paid | Full payment confirmed. | API sync — getPaymentStatus |
| Overdue | Payment due date passed without full payment. | System scheduler |
| Disputed | Discrepancy flagged; under review. | Finance User |
| Cancelled | Invoice voided. Reason code required. | Finance Manager |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| INV-01 | The system shall allow a Finance User to create a new outbound invoice by selecting one or more completed inbound orders. The system shall pre-populate invoice lines from order data: order reference, material category, net weight (kg), applicable contract rate, and BTW rate. | Must |
| INV-02 | Each invoice line shall reference: order number, date, material category, net weight (kg), unit rate, line total, and applicable BTW/VAT rate. | Must |
| INV-03 | The system shall support manual addition, editing, and deletion of invoice lines prior to approval. | Must |
| INV-04 | An invoice shall include: sequential invoice number (auto-assigned on approval), invoice date, due date, Statice BV details, recipient details, line items, subtotal, BTW breakdown, and total amount payable. | Must |
| INV-05 | Invoicing frequency shall be configurable per supplier: per order, weekly aggregated, or monthly aggregated. | Should |
| INV-06 | The system shall generate a PDF preview of the invoice before approval. The PDF shall include the Statice BV logo, KvK-nummer, BTW-nummer, IBAN, and SAFE number. | Must |
| INV-07 | An approved outbound invoice shall be pushed to Exact Online via pushSalesEntry within five minutes of approval. The returned SalesInvoiceID shall be stored in the ICMS invoice record. | Must |
| INV-08 | The system shall display a list of all outbound invoices with columns: invoice number, recipient, date, due date, total amount, status, and last sync timestamp. | Must |
| INV-09 | Finance Users shall be able to filter and sort the invoice list by status, recipient, date range, and amount. | Should |
| INV-10 | Overdue invoices shall be highlighted in the invoice list and shall trigger an automated notification to the Finance Manager. | Should |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| PRF-01 | The system shall allow a Finance User to create a pro-forma invoice independent of a completed order, specifying recipient, description, estimated quantities/weights, rates, and expected delivery date. | Must |
| PRF-02 | A pro-forma invoice shall be clearly marked 'PRO-FORMA INVOICE — NOT A TAX DOCUMENT' on the face of the document and in the PDF. | Must |
| PRF-03 | Pro-forma invoices shall be assigned a separate reference series (e.g. PF-2026-001) and shall never receive a VAT invoice number. | Must |
| PRF-04 | When the related order is completed and an outbound invoice is raised, the system shall allow the Finance User to link the pro-forma to the final invoice for reconciliation. | Should |
| PRF-05 | Pro-forma invoices shall be exportable as PDF and transmittable by email directly from the system. | Must |
| PRF-06 | Pro-forma invoices shall carry status: Draft, Sent, Converted to Invoice, or Cancelled. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| RCV-01 | The system shall allow a Finance User to register a received inbound invoice by entering: supplier name, their invoice number, invoice date, due date, line items, and total amount. | Must |
| RCV-02 | The system shall support upload of the supplier's invoice PDF as an attachment. | Must |
| RCV-03 | For each inbound invoice line referencing a delivery or order, the system shall allow the Finance User to link the line to the corresponding ICMS order or weighing event. | Must |
| RCV-04 | The system shall compare linked inbound invoice lines against ICMS weight and order data and flag any discrepancy exceeding a configurable tolerance (default: 2% or 50 kg, whichever is greater). | Must |
| RCV-05 | The Finance User shall be able to approve or dispute individual invoice lines. Disputed lines shall carry a reason code and free-text note. | Must |
| RCV-06 | When an inbound invoice is fully approved, the system shall push a purchase entry to Exact Online via pushPurchaseEntry. | Must |
| RCV-07 | The system shall display a list of all inbound invoices with columns: supplier, their invoice number, date, due date, total amount, matched status, payment status, and last sync timestamp. | Must |
| RCV-08 | The Finance Manager shall receive an automated notification when an inbound invoice is registered and awaiting review. | Should |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| PAY-01 | The system shall poll Exact Online at a configurable interval (default: every 30 minutes during operational hours) for payment status updates on all open invoices. | Must |
| PAY-02 | Payment status updates received from Exact Online shall update the corresponding ICMS invoice record within two minutes of receipt. | Must |
| PAY-03 | The system shall display per invoice: amount invoiced, amount paid to date, outstanding balance, payment date(s), and Exact Online transaction reference. | Must |
| PAY-04 | The payment status dashboard shall provide a summary of: total outstanding (outbound), total overdue (outbound), total awaiting approval (inbound), and total overdue (inbound). | Must |
| PAY-05 | Finance Users shall be able to manually trigger a payment status refresh for a specific invoice. | Should |
| PAY-06 | When an invoice transitions to Overdue, the system shall create an alert on the Finance Manager's dashboard. | Must |
| PAY-07 | All payment status transitions shall be recorded in the audit log with timestamp, previous status, new status, and source (system poll or manual). | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| FMT-01 | Invoice PDFs shall display the Statice B.V. logo retrieved from the company asset library. | Must |
| FMT-02 | Invoice PDFs shall include: Statice BV name, address (De Oude Kooien 15, 5986 PJ Beringe), KvK-nummer (12040125), BTW-nummer (NL808276426B01), IBAN, and SAFE-nummer (NL00614708). | Must |
| FMT-03 | The due date and payment reference shall be prominent on the first page. | Must |
| FMT-04 | Invoice templates shall be configurable by an administrator (logo, colours, footer text, payment terms) without developer intervention. | Could |


| Adapter Operation | Direction | Trigger | Description |
| --- | --- | --- | --- |
| pushSalesEntry(invoice) | Outbound | On invoice approval | Creates a sales entry (debteur factuur) in the accounting platform from an approved outbound invoice. Returns the platform transaction reference, stored against the ICMS invoice record. |
| pushPurchaseEntry(invoice) | Outbound | On inbound invoice approval | Creates a purchase entry (crediteur factuur) from an approved inbound invoice. Returns the platform transaction reference. |
| getPaymentStatus(refs[]) | Inbound | Scheduled poll + manual | Queries the platform for payment status of open invoice references. Returns: amount paid, payment date(s), outstanding balance, transaction reference. Used to update ICMS invoice statuses. |
| syncRelation(party) | Outbound | On supplier/carrier create or update | Creates or updates a debtor/creditor relation in the accounting platform. Ensures recipients are registered before an invoice push. |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| FIN-01 | The Financial Integration API shall implement an adapter pattern. The ICMS application layer shall call the four adapter operations through a platform-agnostic interface. Platform-specific logic shall reside entirely within the connector. | Must |
| FIN-02 | Each connector shall support OAuth 2.0 authorisation (as required by Exact Online) or API-key authentication as appropriate. Credentials shall be stored encrypted and shall never be logged. | Must |
| FIN-03 | The adapter shall retry failed API calls with exponential back-off (3 attempts, max 5 minutes between retries). After exhausting retries, the operation shall be queued and the Finance Manager alerted. | Must |
| FIN-04 | All API payloads (requests and responses) shall be stored in an immutable Financial Integration Log with: timestamp, operation name, HTTP status, and sanitised payload. Retained for 10 years. | Must |
| FIN-05 | GL account codes, BTW/VAT codes, and cost centre codes shall be configurable in the ICMS per material category and transaction type without developer intervention. | Must |
| FIN-06 | The system shall display, per invoice, the Exact Online transaction reference, last sync timestamp, and a manual 'Sync now' trigger. | Must |
| FIN-07 | Payment status polling interval (default 30 min), operating hours window, and maximum batch size shall be configurable. | Should |


| Exact Online Endpoint | Method | Adapter Op. | Notes |
| --- | --- | --- | --- |
| /api/v1/{div}/salesinvoices | POST | pushSalesEntry | Creates outbound (sales) invoice. Returns SalesInvoiceID stored as Exact Online reference in ICMS. |
| /api/v1/{div}/purchaseentries | POST | pushPurchaseEntry | Creates inbound (purchase) invoice entry. Returns EntryID. |
| /api/v1/{div}/salesinvoices?filter=... | GET | getPaymentStatus | Filters by InvoiceNumber; returns AmountDC, AmountPaidDC, Status, PaymentCondition. Polled every 30 min (configurable). |
| /api/v1/{div}/accounts | POST/PUT | syncRelation | Creates or updates debtor/creditor account. Exact account code stored in ICMS relation record. |
| /api/oauth2/token | POST | Auth | OAuth 2.0 token refresh (expires 600s). Refresh token stored encrypted. Division code required per Statice BV environment. |


| Report ID | Report Name | Audience | Frequency | Regulatory Basis |
| --- | --- | --- | --- | --- |
| RPT-01 | Supplier / Client Statement (all supplier types) | All registered suppliers, Clients | Per order / on demand | WEEELABEX, WEEE Directive Art. 12 |
| RPT-02 | Material Recovery Summary | CBS, Provincie, Management | Monthly / Quarterly | CBS reporting obligation |
| RPT-03 | Chain-of-Custody Report | Compliance, Audit, WEEELABEX | Per consignment / on demand | EN 50625-1 §7.4 |
| RPT-04 | Inbound Weight Register | Weighbridge, Management | Daily / Weekly | Internal |
| RPT-05 | Waste Stream Analysis | Management, Regulatory | Monthly | CBS, LMA |
| RPT-06 | Asset Asset Utilisation | Logistics, Management | Weekly / On demand | Internal |
| RPT-07 | Processor Attestation | Supplier (all types) | Per order / on demand | WEEELABEX, Supplier contract |
| RPT-08 | Carrier Invoice Reconciliation | Finance, Management | Monthly / On demand | Internal |
| RPT-09 | Outbound Invoice Register | Finance, Management | Monthly / On demand | BTW-wetgeving |
| RPT-10 | Cash Flow Summary | Management, Stichting Open | Monthly / Quarterly | Internal |
| RPT-11 | BTW / VAT Declaration Summary | Finance, Belastingdienst | Quarterly | Wet OB 1968 |
| RPT-12 | Debtor Ageing Analysis | Finance | Weekly / On demand | Internal |
| RPT-13 | Revenue per Waste Stream | Management, Reporting Manager | Monthly | Internal |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| RPT-07-01 | The system shall generate a Processor Attestation for any supplier, product category, and date range, derived from completed processing records for that supplier. | Must |
| RPT-07-02 | The material rows shall be populated from actual processing outcome records (PRO-01). Where processing outcomes are not yet recorded, the system shall indicate the row as pending. | Must |
| RPT-07-03 | The Processor Name and Processor Country columns shall be populated from the Processor Master (Section 6.13) linked to the relevant material transfer record. | Must |
| RPT-07-04 | The Recycled / Recovered / Reused / Residue column mapping shall align with the EU WEEE Directive and WEEELABEX EN 50625 outcome categories: Recycled = material recycling; Recovered = other recovery (e.g. energy); Reused = preparing for reuse; Residue = disposal and landfill combined. | Must |
| RPT-07-05 | The attestation shall be exportable as PDF (A4 landscape) matching the Statice concept layout. The Statice logo, supplier block with green highlight, and column structure shall be preserved in the PDF output. | Must |
| RPT-07-06 | One attestation covers one product category per period. A reporting manager shall be able to generate attestations for all product categories delivered by a supplier in a single batch operation. | Should |
| RPT-07-07 | The attestation shall carry a unique document reference number traceable to the originating inbound order(s) and processing records. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| RPT-F01 | All reports shall be exportable in PDF and XLSX formats. | Must |
| RPT-F02 | Report generation shall not exceed ten seconds for data sets covering up to twelve months. | Must |
| RPT-F03 | Reports shall include the Statice BV facility logo, KvK-nummer, BTW-nummer, report generation date/time, and generating user name. | Must |
| RPT-F04 | Financial figures shall use Dutch number formatting (period as thousands separator, comma as decimal) and the euro (€) symbol. | Must |
| RPT-F05 | The system shall support scheduling of recurring reports with automatic delivery to configured email addresses. | Should |
| RPT-F06 | Report templates shall be configurable by an administrator without developer intervention. | Could |
| RPT-F07 | Supplier statements (RPT-01) shall be configurable per supplier to include or exclude specific material categories. | Should |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| LMA-01 | The system shall maintain an Afvalstroomnummer Master recording: afvalstroomnummer, ontdoener (Stichting Open — KvK, address), EURAL code, waste description (NL), receiver (Statice BV — permit, address), processing method (R/D code), VIHB-numbers of carriers, date of first use, status, and linked CBS product categories. | Must |
| LMA-02 | The system shall automatically detect first use of a new afvalstroomnummer and generate an alert: 'Eerste Ontvangstmelding required for [afvalstroomnummer] — deadline [date]'. | Must |
| LMA-03 | The system shall generate an Eerste Ontvangstmelding form pre-filled from the Afvalstroomnummer Master, ready for AMICE export. Deadline: within 2 weeks after end of month of first use. | Must |
| LMA-04 | The system shall monthly aggregate all completed orders per afvalstroomnummer: total weight (kg, integer), number of vrachten (integer), VIHB numbers, and reporting period (MMYYYY). | Must |
| LMA-05 | The system shall generate a Maandelijkse Ontvangstmelding export file in AMICE-compatible format (CSV/XML). Deadline: within 4 weeks after end of calendar month. | Must |
| LMA-06 | The system shall generate a Laatste Ontvangstmelding when an afvalstroomnummer is set to Inactive. Deadline: within 2 weeks after end of last month of use. | Must |
| LMA-07 | The system shall send automatic reminder alerts to the Reporting Manager 7 days before each LMA submission deadline. | Must |
| LMA-08 | AMICE submission confirmation responses (approval/rejection) shall be storable in the ICMS against the relevant reporting period. Rejected submissions shall trigger an alert. | Should |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| WEE-01 | The system shall generate a WEEELABEX Annual Input Report: total WEEE received (kg) per WEEELABEX product group (per EN 50625-1 §6) per calendar year. | Must |
| WEE-02 | The system shall generate a WEEELABEX Recovery Rate Report: per product group, total received (kg), recycled (kg/%), reused (kg/%), other recovery (kg/%), disposal (kg/%), compared against WEEE Directive minimum recovery targets. RAG status displayed per product group. | Must |
| WEE-03 | The system shall generate a De-pollution Evidence Register: per device type and processing record, de-pollution activities performed, hazardous components removed (CFC, mercury, batteries, PCBs), operator identity, and date. | Must |
| WEE-04 | The system shall generate a Downstream Monitoring Report: list of downstream processors per material fraction, WEEELABEX-listed status at time of transfer, transfer dates, and transferred weights. | Must |
| WEE-05 | The system shall maintain a WEEE Directive Recovery Target Table (configurable by administrator) containing minimum recovery and recycling rates per product group. | Must |
| WEE-06 | All WEEELABEX reports shall be exportable as PDF (formatted for auditor submission) and XLSX. Reports shall include generation timestamp, generating user, and Statice BV facility permit number. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| CRT-01 | The system shall maintain a Processor Master recording: processor name, address, country, environmental permit number, WEEELABEX-listed status, certificate number, certification body, certificate valid-from and valid-to dates, material categories certified, and certificate PDF in the document vault. | Must |
| CRT-02 | The system shall send automatic certificate expiry alerts to the Compliance Officer and Reporting Manager 60 days before a processor certificate expires. | Must |
| CRT-03 | When a downstream processor is selected in a processing transfer record, the system shall validate that the processor holds a valid certificate for the material category on the transfer date. Uncertified processors shall be blocked with an explanatory error. | Must |
| CRT-04 | The Downstream Monitoring Report (WEE-04) shall include the certificate status of each processor at the time of each transfer. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| OUT-01 | The system shall allow logistics planners to create Outbound Delivery records linking: material fraction (from processing records), downstream processor, planned shipment date, transport mode, carrier, and vehicle details. | Must |
| OUT-02 | The system shall automatically determine the required document set based on shipment type: domestic (begeleidingsbrief), EU cross-border non-notifiable (Bijlage VII + DIWASS), EU cross-border notifiable (EVOA Kennisgeving + DIWASS), non-EU export (CMR + pro forma invoice + export declaration). | Must |
| OUT-03 | The system shall auto-generate required transport documents pre-filled from the Outbound Delivery record and Statice MRF master data: begeleidingsbrief, Bijlage VII draft, CMR vrachtbrief, pro forma invoice, waste processing contract reference. | Must |
| OUT-04 | Generated documents shall be stored in the outbound shipment dossier in the document vault. Documents shall progress through: Draft → Approved → Issued. | Must |
| OUT-05 | On shipment departure confirmation, outbound transfer records shall be linked to the originating processing records, completing the chain of custody: inbound asset-ID → processing record → outbound shipment → processor certificate → destination. | Must |
| OUT-06 | All document templates shall be configurable by an administrator using variable substitution. Templates shall be version-controlled. | Should |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| DIW-01 | All data fields required by DIWASS shall be captured as first-class fields in Statice MRF during normal operational flows (Sections 6.1–6.14). No additional data entry shall be required at the point of DIWASS submission. | Must |
| DIW-02 | The system shall implement a DIWASS API connector using OAuth 2.0 authentication per the EC's published technical specifications. The connector shall be live and tested before 21 May 2026. | Must |
| DIW-03 | For outbound cross-border shipments, the system shall submit a Bijlage VII notification to DIWASS upon outbound delivery confirmation. | Must |
| DIW-04 | On actual shipment departure, the system shall submit a DIWASS transport notification with vehicle details, actual departure date, and actual weight. | Must |
| DIW-05 | On receipt confirmation from the downstream processor, the system shall submit a DIWASS receipt confirmation, completing the digital chain. | Must |
| DIW-06 | The DIWASS notification reference number returned by DIWASS shall be stored in the outbound shipment dossier in Statice MRF. | Must |
| DIW-07 | In the event of DIWASS API unavailability, the system shall queue the payload with exponential back-off retry and generate an offline Bijlage VII PDF for manual upload. The system administrator shall be alerted after one hour of failure. | Must |
| DIW-08 | For inbound shipments received under an EVOA procedure, the system shall record the DIWASS notification reference number and receipt confirmation details. | Should |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| BI-01 | The BI Dashboard shall be accessible to users with roles: Reporting Manager, Finance Manager, Logistics Planner, Compliance Officer, and System Administrator. | Must |
| BI-02 | The dashboard shall provide a date range filter covering any period within the available data range. The filter shall support month-level granularity with visual selection. | Must |
| BI-03 | The dashboard shall provide supplier filters allowing selection of one or more suppliers. Active filter state shall be reflected in all dashboard panels simultaneously. | Must |
| BI-04 | The dashboard shall provide material fraction filters allowing selection of one or more material categories. Active filter state shall be reflected in all dashboard panels simultaneously. | Must |
| BI-05 | The dashboard shall display a KPI summary row showing: total inbound weight (t/kg), number of consignments, recycled %, reused %, disposal %, and landfill %. All KPIs shall respond to active filters. | Must |
| BI-06 | The dashboard shall display an overall Recovery Profile bar (stacked proportional bar: recycled / reused / disposal / landfill) with percentage and absolute weight labels for each segment. | Must |
| BI-07 | The dashboard shall display a monthly inbound volume trend chart for the selected period, with per-month weights and clickable bars to narrow the date filter. | Must |
| BI-08 | The Flow Diagram view shall render a Sankey-style flow diagram showing waste flows from Supplier → Material Fraction → Downstream Processor. Bar widths shall be proportional to weight. Hovering a flow link shall display the weight in kg. | Must |
| BI-09 | The By Material view shall display ranked cards per material fraction showing: total weight, percentage of total, recovery fate bar, downstream processor, waste stream classification, and a supplier breakdown. | Must |
| BI-10 | The By Supplier view shall display ranked cards per supplier showing: total inbound weight, delivery count, recovery fate bar, and material mix breakdown. | Must |
| BI-11 | The By Processor view shall display downstream processor cards showing: total weight received, number of material types, operation code (R/D), and a horizontal bar chart of material types per processor. | Must |
| BI-12 | All dashboard views shall update within two seconds for datasets covering up to 12 months. | Must |
| BI-13 | The dashboard shall support export of the currently visible data as XLSX and the currently visible chart view as PDF. | Should |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| TRN-01 | The system shall allow a Logistics Coordinator to create a Transport Workorder linked to an inbound or outbound Order. | Must |
| TRN-02 | Each workorder shall capture: Workorder ID, Linked Order ID, Task Type (COLLECT | DELIVER), Assigned To (OWN_FLEET | OUTSOURCED), Driver or External Transporter FK, Vehicle / License Plate, Pickup or Delivery Address, Planned Date/Time, Status (ASSIGNED | EN_ROUTE | COMPLETED | CANCELLED), and Notes. | Must |
| TRN-03 | The system shall support own-fleet scheduling: driver and vehicle are selected from internal records. | Must |
| TRN-04 | The system shall support outsourced transporter assignment: the system shall generate and send a transport brief (PDF) to the external logistics partner via email. | Must |
| TRN-05 | Workorder status shall update automatically when the linked Order transitions (e.g. Order ARRIVED sets workorder EN_ROUTE). | Should |
| TRN-06 | All workorder state changes shall be logged in the audit trail with timestamp and user identity. | Must |
| TRN-07 | The outsourced transporter notification method (email / API / portal) shall be configurable by Admin. Default: email with PDF brief. | Could |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| INV-01 | The system shall create an Inventory record for each material line received after inbound weighing confirmation. Each record shall carry: Inventory ID, Order ID / Inbound ID, Material / Product FK, Quantity (kg or pieces), Storage Location FK (nullable), Status (IN_STOCK | RESERVED | PROCESSING | SHIPPED | DISPOSED), Date Received, Last Updated, and EoW status flag. | Must |
| INV-02 | The system shall support a Location hierarchy: BAY (open area), SHELF (indoor racking), and SLOT (specific position). Each Location shall carry: Location Code (e.g. A-03-S2), Type, Description, Capacity (kg, soft limit, optional). | Must |
| INV-03 | For specific product types (e.g. devices stored on indoor shelving), the system shall suggest a storage location based on availability and product type. The operator may accept or override the suggestion. | Should |
| INV-04 | For bulk / generic materials, bay assignment shall be optional. The operator may asset location assignment and assign it later. | Must |
| INV-05 | The system shall display current inventory levels (total kg by material and by location) on the Inventory overview screen. | Must |
| INV-06 | Inventory status shall update automatically on material movement events: PROCESSING on processing session start, SHIPPED on outbound dispatch, DISPOSED on QC reject confirmation. | Must |
| INV-07 | End-of-Waste (EoW) status shall be settable per inventory line by the Compliance Officer. Manual overrides shall be audit-logged. EoW status drives the Outbound transport classification (Section 6.19). | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| OBD-01 | The system shall classify each Sales Order line into one of four Material Type Categories: PRODUCT_EOW (End-of-Waste), PRODUCT_WEBSHOP (refurbished device from MOD-10), WASTE_NATIONAL (waste shipped within NL), WASTE_CROSS_BORDER (waste crossing an EU or international border). | Must |
| OBD-02 | The Material Type Category shall be auto-determined from the EoW flag on the inventory line and the origin (webshop reuse vs warehouse). Manual override by Compliance Officer shall be logged in the audit trail. | Must |
| OBD-03 | PRODUCT_EOW and PRODUCT_WEBSHOP shipments shall be treated as FAK (Freight All Kind) freight. No waste transport documents shall be required. | Must |
| OBD-04 | WASTE_NATIONAL shipments shall require CMR and Begeleidingsbrief. No PIC procedure. | Must |
| OBD-05 | WASTE_CROSS_BORDER shipments shall require CMR and Annex VII. PIC pre-notification procedure shall be mandatory if amber-list material. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| SO-01 | The system shall allow Sales to create a Sales Order specifying: Buyer, Material Lines (quantity, price, unit, material_type_category), INCO Terms, Payment Terms, Validity Duration, Transport Mode (BUYER_ARRANGES | STATICE_ARRANGES). | Must |
| SO-02 | The system shall generate a branded Sales Order PDF and send it to the buyer via email. | Must |
| SO-03 | On SO approval, the system shall automatically create an Outbound record. If Transport Mode is STATICE_ARRANGES, a Transport Workorder shall be created (MOD-02). | Must |
| SO-04 | The SO status lifecycle shall be: DRAFT → SENT → APPROVED → WSR_PENDING → READY_TO_SHIP → SHIPPED → COMPLETED | CANCELLED. | Must |
| SO-05 | The system shall set a WSR flag automatically on the SO if any material line contains waste material. WSR-flagged shipments shall not advance to READY_TO_SHIP until the WSR compliance checklist is complete. | Must |


| Shipment Type | CMR | Annex VII | Begeleidingsbrief | PIC Docs | FAK Freight |
| --- | --- | --- | --- | --- | --- |
| Product — EoW | – Optional | ✕ | ✕ | ✕ | ✓ |
| Product — Webshop | – Optional | ✕ | ✕ | ✕ | ✓ |
| Waste — National (NL) | ✓ | ✕ | ✓ | ✕ | ✕ |
| Waste — Cross-Border (amber) | ✓ | ✓ | ✕ | ✓ | ✕ |
| Waste — Cross-Border (non-amber) | ✓ | ✓ | ✕ | ✕ | ✕ |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| WSR-01 | The system shall maintain a WSR compliance checklist per WSR-flagged shipment covering: PIC pre-notification status, financial guarantee document, EDI/DIWASS submission reference, scope check (amber list), and documentation completeness gate. | Must |
| WSR-02 | The system shall block SO status advancement to READY_TO_SHIP until all applicable checklist items are marked complete by the Compliance Officer. | Must |
| WSR-03 | Pre-DIWASS workflow (before 21 May 2026): the Compliance Officer manually drafts and sends pre-notifications. The system shall provide status tracking fields for consent received / pending / submitted. | Must |
| WSR-04 | Post-DIWASS workflow (from 21 May 2026): the system shall submit pre-notifications electronically via the DIWASS API. Consent status shall be polled via API and synced back to the SO record. A valid DIWASS submission reference shall be required before READY_TO_SHIP status. | Must |
| WSR-05 | The DIWASS integration shall be built as a pluggable layer over the shared WSR workflow engine so the Pre- and Post-DIWASS workflows share identical process logic and only differ in submission channel. | Must |
| WSR-06 | All WSR document versions, sharing timestamps, and stakeholder receipt confirmations shall be stored in the Document Store. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| QC-01 | The system shall maintain a configurable list of EWC codes that Statice is permitted to process under their environmental permit. The Admin role shall be able to add, edit, and deactivate EWC codes. All changes shall be version-controlled with effective date. | Must |
| QC-02 | A QC Inspector shall be able to open an inbound QC inspection against an active Order from a tablet or desktop interface. | Must |
| QC-03 | The system shall check material descriptions in the Order against the permitted EWC code list. Non-permitted materials shall be automatically flagged. | Must |
| QC-04 | When an inconsistency or non-permitted material is found, the system shall initiate a Reject Procedure. The inspector shall record: supplier, license plate, material description, reason for rejection (NON_PERMITTED_EWC | CONTAMINATED | DAMAGED | OTHER), rejected quantity (kg), and whether the load is a full rejection. | Must |
| QC-05 | The inspector shall be able to attach photos taken on the tablet camera to the Reject Record. Photos shall be stored in the Document Store linked to the Reject Record and the Order. | Must |
| QC-06 | The system shall automatically generate a Claim Report PDF and send it to the supplier email address registered in the Supplier Master on reject confirmation. | Must |
| QC-07 | For full load rejections, the back-office (Sales role) shall be notified and shall update the Order status to REJECTED. | Must |
| QC-08 | The rejected quantity shall update the Order's actual quantity and inventory records accordingly. | Must |
| QC-09 | All Reject Records, Claim Reports, and QC actions shall be retained in the audit trail for a minimum of 10 years. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| DSH-01 | The system shall expose API endpoints supporting a live operational KPI display (TV monitor) in the warehouse. These endpoints shall be available from Phase 1 even if the display UI is not built until Phase 2. | Must |
| DSH-02 | Initial KPI candidates: number of outstanding inbound and outbound orders; total kg processed today / this week / this month; current inventory levels (total kg in stock); CO2 saved (kg equivalent, calculation method to be confirmed with Statice Operations). | Should |
| DSH-03 | The dashboard display shall refresh automatically without manual page reload (websocket or polling interval ≤30 seconds). | Should |
| DSH-04 | Dashboard content and layout shall be configurable by Admin without developer intervention. | Could |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| PRT-01 | The system shall be designed from Phase 1 with multi-tenant supplier data access control so that each registered supplier can only see their own data. | Must |
| PRT-02 | The Customer Portal (Phase 2) shall allow registered suppliers to view and download their invoices. | Should |
| PRT-03 | Suppliers shall be able to view and download Processor Attestation certificates for their delivered materials. | Should |
| PRT-04 | Suppliers shall be able to view Quality Claims submitted against their deliveries. | Should |
| PRT-05 | Suppliers shall be able to view Purchase Orders placed by Statice. | Should |
| PRT-06 | Portal authentication shall use SSO or email-based login. External supplier access shall be strictly read-only. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| REU-01 | An operator shall be able to create a Reuse Record for a device identified in inventory as a reuse candidate. The record shall link to the source Inventory entry. | Must |
| REU-02 | The Reuse Record shall capture: Device ID, Source Inventory ID, Manufacturer, Device Type, Model, Build Year, Serial Number / IMEI, Repair Log (array of repair activities: description, timestamp, operator), QC Status (PENDING | PASS | FAIL), QC Inspector ID, QC Timestamp, Handover Status (NOT_APPLICABLE | PENDING_TRANSFER | TRANSFERRED), Webshop Transfer Reference. | Must |
| REU-03 | The operator shall be able to log repair activities on the device. Each repair entry shall record description, timestamp, and operator identity. | Must |
| REU-04 | The QC Inspector shall conduct a pass/fail inspection on the repaired device. Result shall be recorded as PASS or FAIL. | Must |
| REU-05 | On PASS: the system shall book the device out of Statice inventory (status → SHIPPED) and create a Handover record for the webshop entity. | Must |
| REU-06 | On FAIL: the system shall return the device to the processing flow (MOD-05) for recycling or disposal. The Reuse Record status shall update accordingly. | Must |
| REU-07 | The webshop handover transfer mechanism (API, CSV export, shared database) shall be configurable. The transfer reference shall be stored against the Device record. | Should |
| REU-08 | All reuse assessments and QC outcomes shall be audit-logged and retained for 10 years. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| DOC-01 | The system shall maintain a centralised Document Store. Every document generated or received by any module shall be stored with: Document ID (UUID), Document Type (WEIGHBILL | CMR | AVC | ANNEX_VII | BEGELEIDINGSBRIEF | CLAIM_REPORT | SALES_ORDER | INVOICE | PROCESSOR_ATTEST | QR_LABEL | PHOTO | FAK_FREIGHT_NOTE | OTHER), Linked Entity (polymorphic FK), File Path / URL, Created At, Created By, Version, Shared With []. | Must |
| DOC-02 | All documents shall be printable as PDF and downloadable from the linked entity record. | Must |
| DOC-03 | Documents shall be version-controlled. Every replacement or amendment shall increment the version and preserve prior versions. | Must |
| DOC-04 | The Shared With [] field shall track which stakeholders have received each document (for WSR document distribution audit trail). | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| MOB-01 | The following modules shall be fully functional on a tablet (Android or iOS) via a PWA or browser-based responsive web application: MOD-03 Weighbridge registration (ad-hoc inbound), MOD-05 WEEE sorting workstation, MOD-07 QC inspection and photo capture, MOD-10 Reuse assessment. | Must |
| MOB-02 | The tablet interface shall support camera access for photo capture (MOD-07 reject photos, MOD-10 device condition photos). Browser camera API (getUserMedia) is acceptable; native app camera is not required unless PWA capability is insufficient. | Must |
| MOB-03 | Touch targets on the tablet interface shall be a minimum of 44px × 44px. Forms shall be optimised for on-screen keyboard entry. | Should |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| QR-01 | The system shall generate QR codes in the following contexts: (a) after WEEE sorting (MOD-05) to label output parcels/batches; (b) for outbound pallets and big bags (MOD-06) for logistics identification. | Must |
| QR-02 | QR codes shall encode at minimum: entity type, entity ID, and date. Format: ISO 18004 standard QR code. | Must |
| QR-03 | Generated QR code labels shall be printable to a connected label printer via ZPL or IPP. Label format shall be configurable by Admin. | Must |


| Req. ID | Requirement | Priority |
| --- | --- | --- |
| EWC-01 | The system shall store Statice’s environmental permit parameters, including the complete list of permitted EWC codes. The list shall be admin-configurable and version-controlled with effective dates. | Must |
| EWC-02 | Permitted EWC codes shall be referenced in MOD-07 (QC reject validation) and MOD-06 (outbound scope check). Non-permitted codes shall trigger automatic flagging. | Must |
| PRC-01 | The system shall maintain a Pricing Engine that auto-populates agreed price when a material/product is selected on an Order or Sales Order screen. | Must |
| PRC-02 | The Pricing Engine shall support: price per material/product, price overrides per counterparty (buyer/seller-specific pricing), and date-range validity (prices may change over time). | Must |
| PRC-03 | Price changes shall be version-controlled. Prior prices shall be preserved for audit and retrospective invoice verification. | Must |


| Category | Requirement |
| --- | --- |
| Availability | System shall achieve 99.5% uptime during operational hours (06:00–18:00, Monday–Saturday). Planned maintenance windows shall be scheduled outside these hours. |
| Performance | Page load times shall not exceed 2 seconds on a standard facility LAN. Pfister weight data shall be displayed within 3 seconds of receipt. Report generation shall not exceed 10 seconds for 12-month datasets. BI Dashboard shall update within 2 seconds of filter changes. |
| Scalability | System shall support up to 500 inbound weighing events per day without degradation. Financial Integration API shall handle up to 200 invoice operations per day. Document Store shall support concurrent access from up to 50 simultaneous users. |
| Mobile / Tablet | Modules MOD-03, MOD-05, MOD-07, MOD-10 shall be fully functional on Android and iOS tablets via PWA or responsive web. Page load times on tablet (4G / facility Wi-Fi) shall not exceed 3 seconds. Camera API integration for photo capture is required. |
| Security | All data shall be transmitted over HTTPS/TLS 1.2+. Role-based access control shall restrict functionality to authorised roles. Audit logs shall be tamper-evident. Document vault shall use encryption at rest. |
| Data Retention | All inbound cargo records, weight data, processing records, invoices, reports, and transport documents shall be retained for a minimum of 10 years per Dutch statutory requirements. |
| Auditability | Every create, update, and delete action shall be recorded in an immutable audit log with timestamp and user identity. Weight record amendments, financial overrides, and payment status changes shall additionally record original value, new value, and reason code. |
| Usability | Weighbridge operator interface shall be completable within 3 clicks from vehicle arrival to completed weighing confirmation. Catalogue entry screen shall support rapid keyboard-driven material line entry. |
| Localisation | UI shall support Dutch (primary for operational screens) and English. Regulatory reports (LMA, WEEELABEX, CBS) shall be produced in Dutch. Transport documents shall support Dutch and English. |
| Integration — Pfister | Implemented as a resilient message queue (e.g. RabbitMQ) to prevent data loss during transient connectivity interruptions. |
| Integration — Financial API | Adapter pattern per Section 6.9. Exact Online connector at initial launch. Exponential back-off, dead-letter queue, immutable integration log. |
| Integration — DIWASS | API connector per EC technical specifications (January 2026). Offline PDF fallback for DIWASS unavailability. Connector live before 21 May 2026. |
| Integration — LMA/AMICE | AMICE-compatible export file generation (CSV/XML per AMICE specification). Automated deadline tracking. |
| Offline Resilience | Weighbridge workstation shall support an offline-capable lightweight client with local queuing that synchronises when connectivity is restored. |


| Phase | Scope | Target | Dependency |
| --- | --- | --- | --- |
| Phase 1 — Core Inbound | Inbound cargo registration, asset registration (1–3, LZV enforcement), order management, manual weight fallback, role-based access (10 roles), subcontractor notification portal, delivery notes. QC & Reject Handling (MOD-07): EWC permit management, reject procedure, Claim Report. Basic Inventory & Bay Management (MOD-04): location tracking, status lifecycle. Pricing Engine. Document Store foundation. | Q2 2026 | Pfister interface docs received |
| Phase 2 — Pfister & Weight | Pfister weighing system integration, real-time weight capture, digital weight ticket, immutable audit trail, asset-ID label printing. Transport & Logistics (MOD-02): inbound collection workorders, own fleet and outsourced transporter management. Mobile/tablet interface for MOD-03 and MOD-07 (PWA). | Q2 2026 (pre-May) | Pfister docs + on-site test access |
| Phase 3 — Cataloguing & Processing | E-waste cataloguing (CBS/WEEELABEX categories), device processing records, outcome categories, landfill enforcement, recovery rate calculations, processor certificate management. Outbound Sales & WSR (MOD-06): Sales Orders, EoW classification, document matrix (CMR, Annex VII, Begeleidingsbrief), pre-DIWASS workflow, PIC pre-notification tracking. QR code generation. Mobile/tablet for MOD-05 sorting workstation. | Q2 2026 | Phase 1 live |
| Phase 4 — Reporting & DIWASS | RPT-01 to RPT-06, LMA/AMICE reporting (Eerste, Maandelijks, Laatste), WEEELABEX reports, DIWASS API connector (Bijlage VII + transport notification), afvalstroomnummer management. | Q3 2026 (before 21 May) | Phases 1–3 live; DIWASS API creds from EC |
| Phase 5 — Financial Core | Outbound invoice preparation (INV-01–10). Pro-forma invoices (PRF-01–06). Inbound invoice receipt and validation (RCV-01–08). Payment status monitoring (PAY-01–07). Exact Online connector: all four adapter operations. Invoice PDF with Statice branding (FMT-01–04). GL/BTW code configuration. RPT-07 to RPT-13. | Q3 2026 | Phase 3 live; Exact Online API creds |
| Phase 6A — Second Connector | Alternative accounting platform connector (Twinfield or AFAS Profit, subject to Statice confirmation). Automated payment reminder emails. | Q4 2026 | Phase 5 live |
| Phase 6B — Outbound Documents | Full outbound delivery management, begeleidingsbrief, CMR, pro forma invoice, waste contract auto-generation, DIWASS Annex VII linkage. | Q4 2026 | Phase 4 live |
| Phase 7 — BI Dashboard, Dashboard Screen & Portal | Waste Flow BI dashboard (Statice_WasteFlow_BI): date / supplier / material filters, Sankey flow diagram, material / supplier / processor breakdown views, monthly trend chart, recovery KPI cards. Operator Dashboard screen (MOD-08): live KPI display for warehouse TV monitor. Customer Portal (MOD-09): supplier self-service — invoice history, Processor Attestation download, quality claims, PO view. | Q1 2027 | Phase 5 live |
| Phase 8 — Expansion | Hardware Reuse & Webshop Handover (MOD-10): device repair logging, QC gate, webshop entity transfer (webshop integration mechanism to be confirmed). Full DIWASS notifiable (Annex I) submission. Additional accounting connectors. Native mobile app if PWA is insufficient (separate PRD). | Q2 2027 | Phase 6 live |


| Term | Definition |
| --- | --- |
| Afvalstroomnummer | Unique waste stream number issued by LMA for a specific combination of waste generator, waste type (EURAL code), and receiver. |
| AMICE | Automated registration and reporting system for waste reception notifications, operated by Rijkswaterstaat / LMA. |
| Asset-ID | Unique identifier assigned to a asset/container; printed on a physical label affixed to the asset at Statice BV. |
| BI Dashboard | Business Intelligence Dashboard — the interactive waste flow visualisation module described in Section 6.16. |
| Bak / Asset | A container unit transported on a vehicle chassis; multiple assets may be carried per vehicle (standard: max 2; LZV: max 3). |
| Begeleidingsbrief | Accompanying letter required for domestic waste transports in the Netherlands (Besluit melden bedrijfsafvalstoffen). |
| BTW | Belasting Toegevoegde Waarde — Dutch VAT. Governed by Wet OB 1968. |
| CBS | Centraal Bureau voor de Statistiek — Statistics Netherlands. Requires product category data for WEEE material flow reporting. |
| CMR | Convention on the Contract for the International Carriage of Goods by Road — governing international road freight transport documents. |
| DIWASS | Digital Waste Shipment System — mandatory EU platform for cross-border waste shipment notifications from 21 May 2026 (EU Regulation 2024/1157). |
| EURAL | Europese Afvalstoffenlijst — European Waste Catalogue codes. |
| EVOA | Europese Verordening Overbrenging Afvalstoffen — EU Waste Shipment Regulation. Revised version: EU Regulation 2024/1157. |
| ILT | Inspectie Leefomgeving en Transport — Dutch competent authority for EVOA/DIWASS. |
| LMA | Landelijk Meldpunt Afvalstoffen — national waste reporting authority. Receives monthly ontvangstmeldingen via AMICE. |
| LZV | Langere en Zwaardere Voertuigen — longer and heavier vehicles permitted to carry up to 3 asset containers. |
| Pro-Forma Invoice | Preliminary billing document issued before delivery or processing completion, enabling advance payment. Not a tax document. |
| PRO | Producer Responsibility Organisation. Stichting Open is the PRO for WEEE in the Netherlands. |
| RAG Status | Red / Amber / Green status indicator for WEEELABEX recovery rate reporting vs. WEEE Directive targets. |
| Sankey Diagram | Flow diagram where the width of the arrows / bands is proportional to the flow quantity; used in Section 6.16 to visualise waste flows. |
| Statice MRF | Statice Material Recovery Facility Platform — the ICMS application described in this PRD. |
| Stichting Open | Dutch foundation operating WEEE collection containers; primary supplier/commissioner of Statice BV processing services. |
| VIHB | Vergunning Inzamelen, Handel, Bemiddeling en Bewerking — Dutch registration number for waste collectors and transporters. |
| WEEE | Waste Electrical and Electronic Equipment — EU regulatory category for e-waste. Directive 2012/19/EU. |
| WEEELABEX | WEEE LABoratory of EXcellence — European accredited certification scheme for WEEE treatment facilities, based on CENELEC EN 50625 standards. |
| AVC | Algemene Vervoer Conditie — Dutch general transport conditions document applicable to domestic freight. |
| Begeleidingsbrief | Dutch regulatory transport accompaniment letter required for waste shipments within the Netherlands. |
| EoW | End-of-Waste — EU legal status indicating a material has ceased to be waste and can be treated as a product under EU directive criteria. EoW status is set per inventory line by the Compliance Officer. |
| EWC | European Waste Catalogue — standardised list of waste types identified by 6-digit codes. Statice’s environmental permit specifies which EWC codes are permitted at the facility. |
| FAK | Freight All Kind — standard commercial freight classification for products (EoW and webshop). No waste transport documents required. |
| INCO Terms | International Commercial Terms — standardised trade terms defining delivery obligations (e.g. EXW, FOB, DAP, DDP). |
| PIC | Prior Informed Consent — WSR procedure requiring written consent from competent authorities before cross-border amber-list waste shipment. |
| SO | Sales Order — a formal commitment to sell materials to a buyer. The SO drives outbound transport, document generation, and WSR compliance. |
| WSR | Waste Shipment Regulation — EU Regulation 2024/1157 governing cross-border waste transport. Mandates DIWASS electronic submissions from 21 May 2026. |


| # | Question / Decision | Owner | Priority |
| --- | --- | --- | --- |
| OI-01 | Statice to provide correct IBAN for invoicing module. | Statice Finance | HIGH — before Phase 5 |
| OI-02 | Confirm Phase 6A accounting connector: Twinfield or AFAS Profit. | Statice Finance | MEDIUM — before Phase 6A |
| OI-03 | Pfister weighbridge interface documentation (serial RS-232 or TCP/IP protocol specification). | Statice Operations | HIGH — before Phase 2 |
| OI-04 | DIWASS API registration and credentials from ILT. Required before 21 May 2026. | Compliance / Statice | HIGH — April 2026 |
| OI-05 | GL/BTW code mapping from Statice Finance for Exact Online integration. | Statice Finance | HIGH — before Phase 5 |
| OI-06 | Afvalstroomnummer data from Stichting Open for LMA/AMICE reporting. | Stichting Open | HIGH — before Phase 4 |
| OI-07 | PRD v2.2 sign-off from four signatories (Product Owner, Finance Manager, Compliance Officer, Engineering Lead). | All parties | HIGH — before dev start |
| OI-08 | BI Dashboard refresh model: scheduled (push) vs on-demand (pull)? | Product | MEDIUM — before Phase 7 |
| OI-09 | Weighbridge hardware brand/model and exact communication protocol at site. | Statice Operations | HIGH — before Phase 2 |
| OI-10 | DIWASS API technical specification: has Statice received the EC documentation? | Compliance / Statice | HIGH — urgent |
| OI-11 | Complete WEEE sub-material template list per product type (core reference data for MOD-05). | Statice Operations | HIGH — before Phase 3 |
| OI-12 | Complete permitted EWC code list under Statice environmental permit (for MOD-07 QC validation). | Compliance | HIGH — before Phase 1 |
| OI-13 | Mobile interface: PWA or native app? Camera access requirements for QC photo capture (MOD-07) and Reuse (MOD-10)? | Product | HIGH — before Phase 2 |
| OI-14 | CO2 calculation methodology for Dashboard KPI (MOD-08). | Operations / Sustainability | LOW — before Phase 7 |
| OI-15 | Outsourced transporter notification method: email, portal, or API (MOD-02)? | Logistics | MEDIUM — before Phase 2 |
| OI-16 | Hardware Reuse webshop integration: platform, data format, API or file export (MOD-10)? | Sales / IT | MEDIUM — before Phase 8 |
| OI-17 | Device reuse: required data fields beyond manufacturer, type, year, model (e.g. IMEI, cosmetic grade)? | Operations / Legal | MEDIUM — before Phase 8 |
| OI-18 | Multi-currency support: are international buyers (non-EUR) in scope for Phase 1 or deferred? | Sales / Finance | MEDIUM — before Phase 5 |
| OI-19 | End-of-Waste determination: manual flag by Compliance Officer or auto-derived from processing data? | Compliance / Operations | HIGH — before Phase 3 |
| OI-20 | FAK outbound shipments: standard freight note / packing list required in addition to CMR, or is CMR sufficient? | Logistics / Sales | MEDIUM — before Phase 3 |


| Name | Role | Date | Signature |
| --- | --- | --- | --- |
|  | Product Owner — Statice BV |  |  |
|  | Finance Manager — Statice BV |  |  |
|  | Compliance Officer — Statice BV |  |  |
|  | Engineering Lead — Evreka |  |  |
