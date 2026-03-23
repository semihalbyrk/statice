-- Create missing contract-related enums and tables

-- ============================================================
-- 1. Create enums (if not exist in earlier migrations)
-- ============================================================
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'INACTIVE');
CREATE TYPE "InvoicingFrequency" AS ENUM ('PER_ORDER', 'WEEKLY', 'MONTHLY', 'QUARTERLY');
CREATE TYPE "PricingModel" AS ENUM ('WEIGHT', 'VOLUME', 'UNIT', 'FLAT_RATE');

-- ============================================================
-- 2. Create SupplierContract table
-- ============================================================
CREATE TABLE "SupplierContract" (
    "id" TEXT NOT NULL,
    "contract_number" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "carrier_id" TEXT,
    "name" TEXT NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "approved_by" TEXT,
    "receiver_name" TEXT NOT NULL DEFAULT 'Statice B.V.',
    "payment_term_days" INTEGER NOT NULL DEFAULT 30,
    "invoicing_frequency" "InvoicingFrequency" NOT NULL DEFAULT 'MONTHLY',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "invoice_delivery_method" TEXT,
    "contamination_tolerance_pct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "requires_finance_review" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierContract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierContract_contract_number_key" ON "SupplierContract"("contract_number");
CREATE INDEX "SupplierContract_supplier_id_idx" ON "SupplierContract"("supplier_id");
CREATE INDEX "SupplierContract_carrier_id_idx" ON "SupplierContract"("carrier_id");
CREATE INDEX "SupplierContract_status_idx" ON "SupplierContract"("status");
CREATE INDEX "SupplierContract_expiry_date_idx" ON "SupplierContract"("expiry_date");

ALTER TABLE "SupplierContract"
    ADD CONSTRAINT "SupplierContract_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierContract"
    ADD CONSTRAINT "SupplierContract_carrier_id_fkey"
    FOREIGN KEY ("carrier_id") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierContract"
    ADD CONSTRAINT "SupplierContract_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 3. Create ContractWasteStream table
-- ============================================================
CREATE TABLE "ContractWasteStream" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "waste_stream_id" TEXT NOT NULL,
    "afvalstroomnummer" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractWasteStream_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractWasteStream_contract_id_waste_stream_id_key" ON "ContractWasteStream"("contract_id", "waste_stream_id");
CREATE INDEX "ContractWasteStream_contract_id_idx" ON "ContractWasteStream"("contract_id");

ALTER TABLE "ContractWasteStream"
    ADD CONSTRAINT "ContractWasteStream_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "SupplierContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContractWasteStream"
    ADD CONSTRAINT "ContractWasteStream_waste_stream_id_fkey"
    FOREIGN KEY ("waste_stream_id") REFERENCES "WasteStream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 4. Create ContractRateLine table
-- ============================================================
CREATE TABLE "ContractRateLine" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "contract_waste_stream_id" TEXT,
    "material_id" TEXT NOT NULL,
    "pricing_model" "PricingModel" NOT NULL,
    "unit_rate" DECIMAL(65,30) NOT NULL,
    "btw_rate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "superseded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractRateLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractRateLine_contract_id_material_id_idx" ON "ContractRateLine"("contract_id", "material_id");
CREATE INDEX "ContractRateLine_contract_waste_stream_id_idx" ON "ContractRateLine"("contract_waste_stream_id");
CREATE INDEX "ContractRateLine_valid_from_valid_to_idx" ON "ContractRateLine"("valid_from", "valid_to");

ALTER TABLE "ContractRateLine"
    ADD CONSTRAINT "ContractRateLine_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "SupplierContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContractRateLine"
    ADD CONSTRAINT "ContractRateLine_contract_waste_stream_id_fkey"
    FOREIGN KEY ("contract_waste_stream_id") REFERENCES "ContractWasteStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Note: MaterialMaster foreign key will be added in a later migration if it doesn't exist yet
-- For now, we skip it or assume it exists

-- ============================================================
-- 5. Create FeeMaster and ContractContaminationPenalty tables
-- ============================================================
CREATE TYPE "FeeRateType" AS ENUM ('FIXED', 'PERCENTAGE');

CREATE TABLE "FeeMaster" (
    "id" TEXT NOT NULL,
    "fee_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rate_type" "FeeRateType" NOT NULL,
    "rate_value" DECIMAL(65,30) NOT NULL,
    "min_cap" DECIMAL(65,30),
    "max_cap" DECIMAL(65,30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeMaster_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeeMaster_fee_type_idx" ON "FeeMaster"("fee_type");

CREATE TABLE "ContractContaminationPenalty" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "fee_id" TEXT NOT NULL,

    CONSTRAINT "ContractContaminationPenalty_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractContaminationPenalty_contract_id_fee_id_key" ON "ContractContaminationPenalty"("contract_id", "fee_id");

ALTER TABLE "ContractContaminationPenalty"
    ADD CONSTRAINT "ContractContaminationPenalty_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "SupplierContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContractContaminationPenalty"
    ADD CONSTRAINT "ContractContaminationPenalty_fee_id_fkey"
    FOREIGN KEY ("fee_id") REFERENCES "FeeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
