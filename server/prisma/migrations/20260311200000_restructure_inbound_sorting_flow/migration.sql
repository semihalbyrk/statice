-- Add SORTING_EMPLOYEE to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SORTING_EMPLOYEE';

-- InboundStatus: transform WEIGHED_IN/WEIGHED_OUT/COMPLETED → ARRIVED/WEIGHED_IN/WEIGHED_OUT/READY_FOR_SORTING/SORTED
-- Step 1: Rename current WEIGHED_IN to ARRIVED (existing data becomes ARRIVED)
ALTER TYPE "InboundStatus" RENAME VALUE 'WEIGHED_IN' TO 'ARRIVED';
-- Step 2: Add new WEIGHED_IN value after ARRIVED
ALTER TYPE "InboundStatus" ADD VALUE IF NOT EXISTS 'WEIGHED_IN' AFTER 'ARRIVED';
-- Step 3: Add READY_FOR_SORTING after WEIGHED_OUT
ALTER TYPE "InboundStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_SORTING' AFTER 'WEIGHED_OUT';
-- Step 4: Rename COMPLETED to SORTED
ALTER TYPE "InboundStatus" RENAME VALUE 'COMPLETED' TO 'SORTED';

-- SortingStatus: DRAFT → PLANNED, SUBMITTED → SORTED
ALTER TYPE "SortingStatus" RENAME VALUE 'DRAFT' TO 'PLANNED';
ALTER TYPE "SortingStatus" RENAME VALUE 'SUBMITTED' TO 'SORTED';

-- Add inbound_number to WeighingEvent table
ALTER TABLE "WeighingEvent" ADD COLUMN "inbound_number" TEXT;

-- Backfill existing rows with sequential numbers
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "arrived_at") AS rn
  FROM "WeighingEvent"
)
UPDATE "WeighingEvent" we
SET "inbound_number" = 'INB-' || LPAD(numbered.rn::TEXT, 5, '0')
FROM numbered
WHERE we.id = numbered.id;

-- Make inbound_number NOT NULL and UNIQUE
ALTER TABLE "WeighingEvent" ALTER COLUMN "inbound_number" SET NOT NULL;
ALTER TABLE "WeighingEvent" ADD CONSTRAINT "WeighingEvent_inbound_number_key" UNIQUE ("inbound_number");

-- Asset: replace material_category_id with waste_stream_id
ALTER TABLE "Asset" ADD COLUMN "waste_stream_id" TEXT;

-- Backfill waste_stream_id from material_category's waste_stream_id
UPDATE "Asset" a
SET "waste_stream_id" = pc."waste_stream_id"
FROM "ProductCategory" pc
WHERE pc."id" = a."material_category_id";

-- Add FK constraint
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_waste_stream_id_fkey"
  FOREIGN KEY ("waste_stream_id") REFERENCES "WasteStream"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old material_category FK and column
ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_material_category_id_fkey";
ALTER TABLE "Asset" DROP COLUMN IF EXISTS "material_category_id";
