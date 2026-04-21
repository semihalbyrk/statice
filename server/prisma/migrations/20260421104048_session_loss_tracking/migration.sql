-- CreateEnum
CREATE TYPE "LossReason" AS ENUM ('MOISTURE', 'DUST', 'MEASUREMENT_VARIANCE', 'SPILLAGE', 'CONTAMINATION_REMOVED', 'OTHER');

-- AlterTable
ALTER TABLE "SortingSession"
  ADD COLUMN "fase1_loss_kg" DECIMAL(12,3),
  ADD COLUMN "fase1_loss_reason" "LossReason",
  ADD COLUMN "fase1_loss_notes" TEXT,
  ADD COLUMN "fase2_loss_kg" DECIMAL(12,3),
  ADD COLUMN "fase2_loss_reason" "LossReason",
  ADD COLUMN "fase2_loss_notes" TEXT;
