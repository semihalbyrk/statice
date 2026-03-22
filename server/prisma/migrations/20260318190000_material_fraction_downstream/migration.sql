DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AcceptantStage') THEN
    CREATE TYPE "AcceptantStage" AS ENUM ('FIRST_ACCEPTANT', 'FOLLOWING');
  END IF;
END $$;

ALTER TABLE "ProductTypeMaster"
  ADD COLUMN IF NOT EXISTS "default_process_description" TEXT;

CREATE TABLE IF NOT EXISTS "FractionMaster" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "name_nl" TEXT NOT NULL,
  "eural_code" TEXT NOT NULL,
  "default_acceptant_stage" "AcceptantStage" NOT NULL DEFAULT 'FIRST_ACCEPTANT',
  "default_process_description" TEXT,
  "prepared_for_reuse_pct_default" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "recycling_pct_default" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "other_material_recovery_pct_default" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "energy_recovery_pct_default" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "thermal_disposal_pct_default" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "landfill_disposal_pct_default" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FractionMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FractionMaster_code_key" ON "FractionMaster"("code");

CREATE TABLE IF NOT EXISTS "MaterialFraction" (
  "id" TEXT NOT NULL,
  "material_id" TEXT NOT NULL,
  "fraction_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialFraction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MaterialFraction_material_id_fraction_id_key"
  ON "MaterialFraction"("material_id", "fraction_id");

ALTER TABLE "MaterialFraction"
  ADD CONSTRAINT "MaterialFraction_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "ProductTypeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialFraction"
  ADD CONSTRAINT "MaterialFraction_fraction_id_fkey"
  FOREIGN KEY ("fraction_id") REFERENCES "FractionMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProcessingOutcomeLine"
  ADD COLUMN IF NOT EXISTS "fraction_id" TEXT,
  ADD COLUMN IF NOT EXISTS "acceptant_stage" "AcceptantStage" NOT NULL DEFAULT 'FIRST_ACCEPTANT',
  ADD COLUMN IF NOT EXISTS "process_description" TEXT,
  ADD COLUMN IF NOT EXISTS "share_pct" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "prepared_for_reuse_pct" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "recycling_pct" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "other_material_recovery_pct" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "energy_recovery_pct" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "thermal_disposal_pct" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "landfill_disposal_pct" DECIMAL(65,30) NOT NULL DEFAULT 0;

ALTER TABLE "ProcessingOutcomeLine"
  ADD CONSTRAINT "ProcessingOutcomeLine_fraction_id_fkey"
  FOREIGN KEY ("fraction_id") REFERENCES "FractionMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
