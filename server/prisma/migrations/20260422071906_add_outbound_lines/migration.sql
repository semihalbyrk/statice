-- CreateEnum
CREATE TYPE "VolumeUom" AS ENUM ('M3', 'L');

-- CreateTable
CREATE TABLE "outbound_lines" (
    "id" TEXT NOT NULL,
    "outbound_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "container_type" "SkipType" NOT NULL,
    "volume" DECIMAL(10,2) NOT NULL,
    "volume_uom" "VolumeUom" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbound_lines_outbound_id_idx" ON "outbound_lines"("outbound_id");

-- CreateIndex
CREATE INDEX "outbound_lines_material_id_idx" ON "outbound_lines"("material_id");

-- AddForeignKey
ALTER TABLE "outbound_lines" ADD CONSTRAINT "outbound_lines_outbound_id_fkey"
  FOREIGN KEY ("outbound_id") REFERENCES "outbounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_lines" ADD CONSTRAINT "outbound_lines_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "ProductTypeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
