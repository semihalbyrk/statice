-- Remove approved_by and requires_finance_review from SupplierContract
ALTER TABLE "SupplierContract" DROP COLUMN IF EXISTS "approved_by";
ALTER TABLE "SupplierContract" DROP COLUMN IF EXISTS "requires_finance_review";
