-- AlterTable: Add carrier_id and receiver_name to SupplierContract
ALTER TABLE "SupplierContract" ADD COLUMN "carrier_id" TEXT;
ALTER TABLE "SupplierContract" ADD COLUMN "receiver_name" TEXT NOT NULL DEFAULT 'Statice B.V.';

-- CreateIndex
CREATE INDEX "SupplierContract_carrier_id_idx" ON "SupplierContract"("carrier_id");

-- AddForeignKey
ALTER TABLE "SupplierContract" ADD CONSTRAINT "SupplierContract_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: ContractWasteStream
CREATE TABLE "ContractWasteStream" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "waste_stream_id" TEXT NOT NULL,
    "afvalstroomnummer" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractWasteStream_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractWasteStream_contract_id_idx" ON "ContractWasteStream"("contract_id");
CREATE UNIQUE INDEX "ContractWasteStream_contract_id_waste_stream_id_key" ON "ContractWasteStream"("contract_id", "waste_stream_id");

-- AddForeignKey
ALTER TABLE "ContractWasteStream" ADD CONSTRAINT "ContractWasteStream_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "SupplierContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractWasteStream" ADD CONSTRAINT "ContractWasteStream_waste_stream_id_fkey" FOREIGN KEY ("waste_stream_id") REFERENCES "WasteStream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Add contract_waste_stream_id to ContractRateLine
ALTER TABLE "ContractRateLine" ADD COLUMN "contract_waste_stream_id" TEXT;

-- CreateIndex
CREATE INDEX "ContractRateLine_contract_waste_stream_id_idx" ON "ContractRateLine"("contract_waste_stream_id");

-- AddForeignKey
ALTER TABLE "ContractRateLine" ADD CONSTRAINT "ContractRateLine_contract_waste_stream_id_fkey" FOREIGN KEY ("contract_waste_stream_id") REFERENCES "ContractWasteStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Add afvalstroomnummer to OrderWasteStream
ALTER TABLE "OrderWasteStream" ADD COLUMN "afvalstroomnummer" TEXT;
