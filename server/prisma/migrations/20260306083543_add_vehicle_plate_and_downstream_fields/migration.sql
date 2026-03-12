-- AlterTable
ALTER TABLE "InboundOrder" ADD COLUMN     "vehicle_plate" TEXT;

-- AlterTable
ALTER TABLE "SortingLine" ADD COLUMN     "certificate_reference" TEXT,
ADD COLUMN     "downstream_permit_number" TEXT,
ADD COLUMN     "downstream_processor_address" TEXT,
ADD COLUMN     "transfer_date" TIMESTAMP(3),
ADD COLUMN     "transfer_method" TEXT;
