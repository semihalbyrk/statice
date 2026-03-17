-- v2.2 Inbound & Weighing Expansion Migration
-- Handles enum renames (SupplierType), enum additions (OrderStatus, Role),
-- new enums (IncidentCategory, WeightAmendmentReason), new models
-- (SupplierAfvalstroomnummer, WeightAmendment), and column additions.

-- ============================================================
-- 1. SupplierType enum: rename values (preserves existing data)
-- ============================================================
ALTER TYPE "SupplierType" RENAME VALUE 'THIRD_PARTY' TO 'COMMERCIAL';
ALTER TYPE "SupplierType" RENAME VALUE 'PRIVATE_INDIVIDUAL' TO 'AD_HOC';

-- ============================================================
-- 2. OrderStatus enum: add new values
-- ============================================================
ALTER TYPE "OrderStatus" ADD VALUE 'DISPUTE';
ALTER TYPE "OrderStatus" ADD VALUE 'INVOICED';

-- ============================================================
-- 3. Role enum: add new values
-- ============================================================
ALTER TYPE "Role" ADD VALUE 'SALES';
ALTER TYPE "Role" ADD VALUE 'QC_INSPECTOR';
ALTER TYPE "Role" ADD VALUE 'LOGISTICS_COORDINATOR';
ALTER TYPE "Role" ADD VALUE 'FINANCE_USER';
ALTER TYPE "Role" ADD VALUE 'FINANCE_MANAGER';
ALTER TYPE "Role" ADD VALUE 'COMPLIANCE_OFFICER';

-- ============================================================
-- 4. New enums
-- ============================================================
CREATE TYPE "IncidentCategory" AS ENUM ('DAMAGE', 'DISPUTE', 'SPECIAL_HANDLING', 'DRIVER_INSTRUCTION');
CREATE TYPE "WeightAmendmentReason" AS ENUM ('CALIBRATION_ERROR', 'EQUIPMENT_MALFUNCTION', 'INCORRECT_READING', 'SUPERVISOR_CORRECTION', 'OTHER');

-- ============================================================
-- 5. Supplier table: add new columns
-- ============================================================
ALTER TABLE "Supplier" ADD COLUMN "btw_number" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "iban" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "contact_phone" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "address" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "vihb_number" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "pro_registration_number" TEXT;

-- ============================================================
-- 6. WasteStream table: add code mapping columns
-- ============================================================
ALTER TABLE "WasteStream" ADD COLUMN "cbs_code" TEXT;
ALTER TABLE "WasteStream" ADD COLUMN "weeelabex_code" TEXT;
ALTER TABLE "WasteStream" ADD COLUMN "ewc_code" TEXT;

-- ============================================================
-- 7. InboundOrder table: add new columns
-- ============================================================
ALTER TABLE "InboundOrder" ADD COLUMN "is_lzv" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InboundOrder" ADD COLUMN "client_reference" TEXT;
ALTER TABLE "InboundOrder" ADD COLUMN "adhoc_person_name" TEXT;
ALTER TABLE "InboundOrder" ADD COLUMN "adhoc_id_reference" TEXT;
ALTER TABLE "InboundOrder" ADD COLUMN "incident_category" "IncidentCategory";
ALTER TABLE "InboundOrder" ADD COLUMN "incident_notes" TEXT;

-- ============================================================
-- 8. WeighingEvent (Inbound) table: add incident_category
-- ============================================================
ALTER TABLE "WeighingEvent" ADD COLUMN "incident_category" "IncidentCategory";

-- ============================================================
-- 9. PfisterTicket table: add confirmation/immutability fields
-- ============================================================
ALTER TABLE "PfisterTicket" ADD COLUMN "is_confirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PfisterTicket" ADD COLUMN "confirmed_by" TEXT;
ALTER TABLE "PfisterTicket" ADD COLUMN "confirmed_at" TIMESTAMP(3);

-- ============================================================
-- 10. New table: SupplierAfvalstroomnummer
-- ============================================================
CREATE TABLE "SupplierAfvalstroomnummer" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "afvalstroomnummer" TEXT NOT NULL,
    "waste_stream_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierAfvalstroomnummer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierAfvalstroomnummer_supplier_id_afvalstroomnummer_key"
    ON "SupplierAfvalstroomnummer"("supplier_id", "afvalstroomnummer");

ALTER TABLE "SupplierAfvalstroomnummer"
    ADD CONSTRAINT "SupplierAfvalstroomnummer_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierAfvalstroomnummer"
    ADD CONSTRAINT "SupplierAfvalstroomnummer_waste_stream_id_fkey"
    FOREIGN KEY ("waste_stream_id") REFERENCES "WasteStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 11. New table: WeightAmendment
-- ============================================================
CREATE TABLE "WeightAmendment" (
    "id" TEXT NOT NULL,
    "pfister_ticket_id" TEXT NOT NULL,
    "original_weight_kg" DECIMAL(65,30) NOT NULL,
    "amended_weight_kg" DECIMAL(65,30) NOT NULL,
    "reason" "WeightAmendmentReason" NOT NULL,
    "reason_notes" TEXT,
    "amended_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightAmendment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WeightAmendment"
    ADD CONSTRAINT "WeightAmendment_pfister_ticket_id_fkey"
    FOREIGN KEY ("pfister_ticket_id") REFERENCES "PfisterTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WeightAmendment"
    ADD CONSTRAINT "WeightAmendment_amended_by_fkey"
    FOREIGN KEY ("amended_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
