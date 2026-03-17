-- CreateEnum ParcelType
CREATE TYPE "ParcelType" AS ENUM ('CONTAINER', 'MATERIAL');

-- CreateTable InboundWeighing
CREATE TABLE "InboundWeighing" (
    "id" TEXT NOT NULL,
    "inbound_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "pfister_ticket_id" TEXT NOT NULL,
    "weight_kg" DECIMAL(65,30) NOT NULL,
    "is_tare" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboundWeighing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboundWeighing_pfister_ticket_id_key" ON "InboundWeighing"("pfister_ticket_id");
CREATE UNIQUE INDEX "InboundWeighing_inbound_id_sequence_key" ON "InboundWeighing"("inbound_id", "sequence");

ALTER TABLE "InboundWeighing" ADD CONSTRAINT "InboundWeighing_inbound_id_fkey" FOREIGN KEY ("inbound_id") REFERENCES "WeighingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InboundWeighing" ADD CONSTRAINT "InboundWeighing_pfister_ticket_id_fkey" FOREIGN KEY ("pfister_ticket_id") REFERENCES "PfisterTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable OrderWasteStream
CREATE TABLE "OrderWasteStream" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "waste_stream_id" TEXT NOT NULL,
    CONSTRAINT "OrderWasteStream_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderWasteStream_order_id_waste_stream_id_key" ON "OrderWasteStream"("order_id", "waste_stream_id");

ALTER TABLE "OrderWasteStream" ADD CONSTRAINT "OrderWasteStream_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "InboundOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderWasteStream" ADD CONSTRAINT "OrderWasteStream_waste_stream_id_fkey" FOREIGN KEY ("waste_stream_id") REFERENCES "WasteStream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable Asset: add parcel_type, material_category_id, sequence; make skip_type nullable; drop gross/tare
ALTER TABLE "Asset" ADD COLUMN "parcel_type" "ParcelType" NOT NULL DEFAULT 'CONTAINER';
ALTER TABLE "Asset" ADD COLUMN "material_category_id" TEXT;
ALTER TABLE "Asset" ADD COLUMN "sequence" INTEGER;
ALTER TABLE "Asset" ALTER COLUMN "skip_type" DROP NOT NULL;
ALTER TABLE "Asset" DROP COLUMN "gross_weight_kg";
ALTER TABLE "Asset" DROP COLUMN "tare_weight_kg";

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_material_category_id_fkey" FOREIGN KEY ("material_category_id") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
