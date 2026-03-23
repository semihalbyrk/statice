-- AlterTable
ALTER TABLE "SupplierContract" ALTER COLUMN "expiry_date" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ContractRateLine" ALTER COLUMN "valid_to" DROP NOT NULL;
