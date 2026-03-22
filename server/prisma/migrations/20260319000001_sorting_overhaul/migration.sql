-- Add weight_kg column with default, then remove default
ALTER TABLE "AssetCatalogueEntry" ADD COLUMN "weight_kg" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "AssetCatalogueEntry" ALTER COLUMN "weight_kg" DROP DEFAULT;

-- Drop estimated_quantity
ALTER TABLE "AssetCatalogueEntry" DROP COLUMN "estimated_quantity";

-- CreateTable
CREATE TABLE "ReusableItem" (
    "id" TEXT NOT NULL,
    "catalogue_entry_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "brand" TEXT,
    "model_name" TEXT,
    "type" TEXT,
    "serial_number" TEXT,
    "condition" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReusableItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReusableItem_catalogue_entry_id_idx" ON "ReusableItem"("catalogue_entry_id");

-- AddForeignKey
ALTER TABLE "ReusableItem" ADD CONSTRAINT "ReusableItem_catalogue_entry_id_fkey" FOREIGN KEY ("catalogue_entry_id") REFERENCES "AssetCatalogueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReusableItem" ADD CONSTRAINT "ReusableItem_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "ProductTypeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
