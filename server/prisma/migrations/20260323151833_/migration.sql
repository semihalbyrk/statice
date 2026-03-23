/*
  Warnings:

  - The values [VOLUME,UNIT,FLAT_RATE] on the enum `PricingModel` will be removed. If these variants are still used in the database, this will fail.
  - The values [AD_HOC,COMMERCIAL] on the enum `SupplierType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FeeRateType" ADD VALUE 'PER_KG';
ALTER TYPE "FeeRateType" ADD VALUE 'PER_HOUR';

-- AlterEnum
BEGIN;
CREATE TYPE "PricingModel_new" AS ENUM ('WEIGHT', 'QUANTITY');
ALTER TABLE "ContractRateLine" ALTER COLUMN "pricing_model" TYPE "PricingModel_new" USING ("pricing_model"::text::"PricingModel_new");
ALTER TYPE "PricingModel" RENAME TO "PricingModel_old";
ALTER TYPE "PricingModel_new" RENAME TO "PricingModel";
DROP TYPE "PricingModel_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SupplierType_new" AS ENUM ('PRIVATE_INDIVIDUAL', 'PRO', 'THIRD_PARTY');
ALTER TABLE "Supplier" ALTER COLUMN "supplier_type" TYPE "SupplierType_new" USING ("supplier_type"::text::"SupplierType_new");
ALTER TYPE "SupplierType" RENAME TO "SupplierType_old";
ALTER TYPE "SupplierType_new" RENAME TO "SupplierType";
DROP TYPE "SupplierType_old";
COMMIT;

-- AlterTable
ALTER TABLE "FractionMaster" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "ContractRateLine" ADD CONSTRAINT "ContractRateLine_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "ProductTypeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ProcessorCertificateProductType_certificate_id_product_type_id_" RENAME TO "ProcessorCertificateProductType_certificate_id_product_type_key";
