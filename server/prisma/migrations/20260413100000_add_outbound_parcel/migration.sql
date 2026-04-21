-- CreateEnum
CREATE TYPE "OutboundParcelStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'SHIPPED');

-- CreateTable
CREATE TABLE "outbound_parcels" (
    "id" TEXT NOT NULL,
    "parcel_label" TEXT NOT NULL,
    "outbound_id" TEXT,
    "material_id" TEXT NOT NULL,
    "container_type" "SkipType" NOT NULL,
    "volume_m3" DECIMAL(8,2),
    "estimated_weight_kg" DECIMAL(12,2),
    "description" TEXT,
    "notes" TEXT,
    "status" "OutboundParcelStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_parcels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbound_parcels_parcel_label_key" ON "outbound_parcels"("parcel_label");

-- CreateIndex
CREATE INDEX "outbound_parcels_outbound_id_idx" ON "outbound_parcels"("outbound_id");

-- CreateIndex
CREATE INDEX "outbound_parcels_material_id_idx" ON "outbound_parcels"("material_id");

-- CreateIndex
CREATE INDEX "outbound_parcels_status_idx" ON "outbound_parcels"("status");

-- AddForeignKey
ALTER TABLE "outbound_parcels" ADD CONSTRAINT "outbound_parcels_outbound_id_fkey" FOREIGN KEY ("outbound_id") REFERENCES "outbounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_parcels" ADD CONSTRAINT "outbound_parcels_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "ProductTypeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
