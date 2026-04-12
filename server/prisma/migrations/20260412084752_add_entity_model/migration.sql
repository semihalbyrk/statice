-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SupplierRole" AS ENUM ('ONTDOENER', 'ONTVANGER', 'HANDELAAR', 'BEMIDDELAAR');

-- CreateEnum
CREATE TYPE "EntitySupplierType" AS ENUM ('PRO', 'COMMERCIAL', 'AD_HOC');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "OrderDocumentType" AS ENUM ('BEGELEIDINGSBRIEF', 'WEIGHT_TICKET', 'OTHER');

-- AlterTable
ALTER TABLE "Carrier" ADD COLUMN     "migrated_to_entity_id" TEXT;

-- AlterTable
ALTER TABLE "InboundOrder" ADD COLUMN     "entity_supplier_id" TEXT,
ADD COLUMN     "transporter_id" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "migrated_to_entity_id" TEXT;

-- AlterTable
ALTER TABLE "SupplierContract" ADD COLUMN     "agreement_transporter_id" TEXT,
ADD COLUMN     "contract_type" "ContractType" NOT NULL DEFAULT 'INCOMING',
ADD COLUMN     "entity_supplier_id" TEXT,
ADD COLUMN     "invoice_entity_id" TEXT;

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "street_and_number" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'NL',
    "kvk_number" TEXT,
    "btw_number" TEXT,
    "iban" TEXT,
    "vihb_number" TEXT,
    "environmental_permit_number" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_supplier" BOOLEAN NOT NULL DEFAULT false,
    "is_transporter" BOOLEAN NOT NULL DEFAULT false,
    "is_disposer" BOOLEAN NOT NULL DEFAULT false,
    "is_receiver" BOOLEAN NOT NULL DEFAULT false,
    "supplier_type" "EntitySupplierType",
    "supplier_roles" "SupplierRole"[],
    "pro_registration_number" TEXT,
    "is_also_site" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisposerSite" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "site_name" TEXT NOT NULL,
    "street_and_number" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'NL',
    "environmental_permit_number" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisposerSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDocument" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "document_type" "OrderDocumentType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierContract_entity_supplier_id_idx" ON "SupplierContract"("entity_supplier_id");

-- CreateIndex
CREATE INDEX "SupplierContract_agreement_transporter_id_idx" ON "SupplierContract"("agreement_transporter_id");

-- AddForeignKey
ALTER TABLE "DisposerSite" ADD CONSTRAINT "DisposerSite_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundOrder" ADD CONSTRAINT "InboundOrder_entity_supplier_id_fkey" FOREIGN KEY ("entity_supplier_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundOrder" ADD CONSTRAINT "InboundOrder_transporter_id_fkey" FOREIGN KEY ("transporter_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDocument" ADD CONSTRAINT "OrderDocument_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "InboundOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierContract" ADD CONSTRAINT "SupplierContract_entity_supplier_id_fkey" FOREIGN KEY ("entity_supplier_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierContract" ADD CONSTRAINT "SupplierContract_agreement_transporter_id_fkey" FOREIGN KEY ("agreement_transporter_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierContract" ADD CONSTRAINT "SupplierContract_invoice_entity_id_fkey" FOREIGN KEY ("invoice_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

