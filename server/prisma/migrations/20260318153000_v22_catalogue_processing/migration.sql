-- v2.2 Catalogue & Processing Expansion

-- ============================================================
-- 1. New enums
-- ============================================================
CREATE TYPE "MatchStrategy" AS ENUM ('EXACT_SAME_DAY', 'EXACT_WINDOW', 'MANUAL', 'AD_HOC');
CREATE TYPE "WorkflowStageStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "ProcessingRecordStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CONFIRMED', 'SUPERSEDED');
CREATE TYPE "TreatmentRoute" AS ENUM ('RECYCLED', 'REUSED', 'DISPOSED', 'LANDFILL');

-- ============================================================
-- 2. Order / inbound / asset / session extensions
-- ============================================================
ALTER TABLE "InboundOrder" ADD COLUMN "received_asset_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WeighingEvent" ADD COLUMN "match_strategy" "MatchStrategy";
ALTER TABLE "WeighingEvent" ADD COLUMN "matched_by" TEXT;
ALTER TABLE "WeighingEvent" ADD COLUMN "matched_at" TIMESTAMP(3);
ALTER TABLE "WeighingEvent" ADD COLUMN "is_manual_match" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Asset" ADD COLUMN "gross_weighing_id" TEXT;
ALTER TABLE "Asset" ADD COLUMN "tare_weighing_id" TEXT;
ALTER TABLE "Asset" ADD COLUMN "gross_weight_kg" DECIMAL(65,30);
ALTER TABLE "Asset" ADD COLUMN "tare_weight_kg" DECIMAL(65,30);

ALTER TABLE "SortingSession" ADD COLUMN "catalogue_status" "WorkflowStageStatus" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "SortingSession" ADD COLUMN "processing_status" "WorkflowStageStatus" NOT NULL DEFAULT 'NOT_STARTED';

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_gross_weighing_id_fkey"
  FOREIGN KEY ("gross_weighing_id") REFERENCES "InboundWeighing"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_tare_weighing_id_fkey"
  FOREIGN KEY ("tare_weighing_id") REFERENCES "InboundWeighing"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 3. Pfister ingress log
-- ============================================================
CREATE TABLE "PfisterIngressLog" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "protocol" TEXT,
  "payload" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "error_message" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),

  CONSTRAINT "PfisterIngressLog_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 4. Product type master
-- ============================================================
CREATE TABLE "ProductTypeMaster" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label_en" TEXT NOT NULL,
  "label_nl" TEXT NOT NULL,
  "waste_stream_id" TEXT NOT NULL,
  "cbs_code" TEXT NOT NULL,
  "weeelabex_group" TEXT NOT NULL,
  "eural_code" TEXT NOT NULL,
  "default_afvalstroomnummer" TEXT,
  "annex_iii_category" TEXT NOT NULL,
  "legacy_category_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductTypeMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductTypeMaster_code_key" ON "ProductTypeMaster"("code");

ALTER TABLE "ProductTypeMaster"
  ADD CONSTRAINT "ProductTypeMaster_waste_stream_id_fkey"
  FOREIGN KEY ("waste_stream_id") REFERENCES "WasteStream"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductTypeMaster"
  ADD CONSTRAINT "ProductTypeMaster_legacy_category_id_fkey"
  FOREIGN KEY ("legacy_category_id") REFERENCES "ProductCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 5. Asset catalogue entries
-- ============================================================
CREATE TABLE "AssetCatalogueEntry" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "product_type_id" TEXT NOT NULL,
  "estimated_quantity" INTEGER NOT NULL,
  "reuse_eligible_quantity" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "entry_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AssetCatalogueEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssetCatalogueEntry_session_id_asset_id_idx" ON "AssetCatalogueEntry"("session_id", "asset_id");

ALTER TABLE "AssetCatalogueEntry"
  ADD CONSTRAINT "AssetCatalogueEntry_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "SortingSession"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssetCatalogueEntry"
  ADD CONSTRAINT "AssetCatalogueEntry_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "Asset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssetCatalogueEntry"
  ADD CONSTRAINT "AssetCatalogueEntry_product_type_id_fkey"
  FOREIGN KEY ("product_type_id") REFERENCES "ProductTypeMaster"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 6. Processing records and outcomes
-- ============================================================
CREATE TABLE "ProcessingRecord" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "catalogue_entry_id" TEXT,
  "product_type_id" TEXT NOT NULL,
  "product_code_snapshot" TEXT NOT NULL,
  "product_label_snapshot" TEXT NOT NULL,
  "annex_iii_category_snapshot" TEXT NOT NULL,
  "status" "ProcessingRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "version_no" INTEGER NOT NULL DEFAULT 1,
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "supersedes_id" TEXT,
  "finalized_by" TEXT,
  "finalized_at" TIMESTAMP(3),
  "confirmed_by" TEXT,
  "confirmed_at" TIMESTAMP(3),
  "reason_code" TEXT,
  "reason_notes" TEXT,
  "balance_delta_kg" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProcessingRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcessingRecord_session_id_asset_id_idx" ON "ProcessingRecord"("session_id", "asset_id");

ALTER TABLE "ProcessingRecord"
  ADD CONSTRAINT "ProcessingRecord_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "SortingSession"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProcessingRecord"
  ADD CONSTRAINT "ProcessingRecord_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "Asset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProcessingRecord"
  ADD CONSTRAINT "ProcessingRecord_catalogue_entry_id_fkey"
  FOREIGN KEY ("catalogue_entry_id") REFERENCES "AssetCatalogueEntry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProcessingRecord"
  ADD CONSTRAINT "ProcessingRecord_product_type_id_fkey"
  FOREIGN KEY ("product_type_id") REFERENCES "ProductTypeMaster"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProcessingOutcomeLine" (
  "id" TEXT NOT NULL,
  "processing_record_id" TEXT NOT NULL,
  "material_fraction" TEXT NOT NULL,
  "weight_kg" DECIMAL(65,30) NOT NULL,
  "treatment_route" "TreatmentRoute" NOT NULL,
  "downstream_processor_id" TEXT,
  "transfer_date" TIMESTAMP(3),
  "notes" TEXT,
  "landfill_reason_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProcessingOutcomeLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProcessingOutcomeLine"
  ADD CONSTRAINT "ProcessingOutcomeLine_processing_record_id_fkey"
  FOREIGN KEY ("processing_record_id") REFERENCES "ProcessingRecord"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 7. Processor master and certificates
-- ============================================================
CREATE TABLE "Processor" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "environmental_permit_number" TEXT NOT NULL,
  "is_weeelabex_listed" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Processor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessorCertificate" (
  "id" TEXT NOT NULL,
  "processor_id" TEXT NOT NULL,
  "certificate_number" TEXT NOT NULL,
  "certification_body" TEXT NOT NULL,
  "valid_from" TIMESTAMP(3) NOT NULL,
  "valid_to" TIMESTAMP(3) NOT NULL,
  "document_url" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProcessorCertificate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProcessorCertificate"
  ADD CONSTRAINT "ProcessorCertificate_processor_id_fkey"
  FOREIGN KEY ("processor_id") REFERENCES "Processor"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProcessorCertificateProductType" (
  "id" TEXT NOT NULL,
  "certificate_id" TEXT NOT NULL,
  "product_type_id" TEXT NOT NULL,

  CONSTRAINT "ProcessorCertificateProductType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessorCertificateProductType_certificate_id_product_type_id_key"
  ON "ProcessorCertificateProductType"("certificate_id", "product_type_id");

ALTER TABLE "ProcessorCertificateProductType"
  ADD CONSTRAINT "ProcessorCertificateProductType_certificate_id_fkey"
  FOREIGN KEY ("certificate_id") REFERENCES "ProcessorCertificate"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProcessorCertificateProductType"
  ADD CONSTRAINT "ProcessorCertificateProductType_product_type_id_fkey"
  FOREIGN KEY ("product_type_id") REFERENCES "ProductTypeMaster"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProcessingOutcomeLine"
  ADD CONSTRAINT "ProcessingOutcomeLine_downstream_processor_id_fkey"
  FOREIGN KEY ("downstream_processor_id") REFERENCES "Processor"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
