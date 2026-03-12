-- Step 1: Migrate OrderStatus data (remove ARRIVED)
UPDATE "InboundOrder" SET status = 'IN_PROGRESS' WHERE status = 'ARRIVED';

-- Step 2: Remove ARRIVED from OrderStatus enum
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
CREATE TYPE "OrderStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
ALTER TABLE "InboundOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "InboundOrder" ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::text::"OrderStatus";
ALTER TABLE "InboundOrder" ALTER COLUMN "status" SET DEFAULT 'PLANNED';
DROP TYPE "OrderStatus_old";

-- Step 3: Create new InboundStatus enum
CREATE TYPE "InboundStatus" AS ENUM ('WEIGHED_IN', 'WEIGHED_OUT', 'COMPLETED');

-- Step 4: Convert WeighingEvent status via text intermediary
ALTER TABLE "WeighingEvent" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WeighingEvent" ALTER COLUMN "status" TYPE text USING "status"::text;

UPDATE "WeighingEvent" SET status = 'WEIGHED_IN' WHERE status IN ('PENDING_GROSS', 'GROSS_COMPLETE', 'PENDING_TARE');
UPDATE "WeighingEvent" SET status = 'WEIGHED_OUT' WHERE status = 'TARE_COMPLETE';
UPDATE "WeighingEvent" SET status = 'COMPLETED' WHERE status = 'CONFIRMED';

ALTER TABLE "WeighingEvent" ALTER COLUMN "status" TYPE "InboundStatus" USING "status"::"InboundStatus";
ALTER TABLE "WeighingEvent" ALTER COLUMN "status" SET DEFAULT 'WEIGHED_IN';

-- Step 5: Drop old enum
DROP TYPE "WeighingEventStatus";

-- Step 6: Add waste_stream_id to WeighingEvent (Inbound)
ALTER TABLE "WeighingEvent" ADD COLUMN "waste_stream_id" TEXT;
ALTER TABLE "WeighingEvent" ADD CONSTRAINT "WeighingEvent_waste_stream_id_fkey" FOREIGN KEY ("waste_stream_id") REFERENCES "WasteStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;
