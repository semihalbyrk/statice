-- Note: carrier_id and receiver_name were already added to SupplierContract 
-- in migration 20260322000000_create_contract_tables
-- ContractWasteStream table and ContractRateLine.contract_waste_stream_id were also
-- already created/added in that migration
-- This migration now only handles OrderWasteStream changes

-- AlterTable: Add afvalstroomnummer to OrderWasteStream
ALTER TABLE "OrderWasteStream" ADD COLUMN "afvalstroomnummer" TEXT;
