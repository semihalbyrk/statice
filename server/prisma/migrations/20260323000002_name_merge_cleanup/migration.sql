-- WasteStream: merge name_en → name, drop name_nl
ALTER TABLE "WasteStream" RENAME COLUMN "name_en" TO "name";
ALTER TABLE "WasteStream" DROP COLUMN "name_nl";

-- MaterialMaster (ProductTypeMaster): merge label_en → name, drop label_nl, drop default_afvalstroomnummer
ALTER TABLE "ProductTypeMaster" RENAME COLUMN "label_en" TO "name";
ALTER TABLE "ProductTypeMaster" DROP COLUMN "label_nl";
ALTER TABLE "ProductTypeMaster" DROP COLUMN "default_afvalstroomnummer";

-- FractionMaster: merge name_en → name, drop name_nl
ALTER TABLE "FractionMaster" RENAME COLUMN "name_en" TO "name";
ALTER TABLE "FractionMaster" DROP COLUMN "name_nl";

-- Contract: set all DRAFT contracts to ACTIVE, change default
UPDATE "SupplierContract" SET "status" = 'ACTIVE' WHERE "status" = 'DRAFT';
ALTER TABLE "SupplierContract" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
