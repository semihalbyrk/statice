-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "container_label" TEXT,
ADD COLUMN "estimated_tare_weight_kg" DECIMAL(65,30);

-- CreateIndex
CREATE INDEX "Asset_container_label_idx" ON "Asset"("container_label");
