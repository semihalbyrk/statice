-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContaminationType" AS ENUM ('NON_WEEE', 'HAZARDOUS', 'EXCESSIVE_MOISTURE', 'SORTING_REQUIRED');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "supplier_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "btw_total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "recipient_name" TEXT NOT NULL,
    "recipient_address" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "order_id" TEXT,
    "material_id" TEXT,
    "description" TEXT NOT NULL,
    "line_type" TEXT NOT NULL DEFAULT 'material',
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "unit_rate" DECIMAL(65,30) NOT NULL,
    "btw_rate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "line_subtotal" DECIMAL(65,30) NOT NULL,
    "btw_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(65,30) NOT NULL,
    "contamination_incident_id" TEXT,
    "rate_line_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaminationIncident" (
    "id" TEXT NOT NULL,
    "incident_number" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "sorting_session_id" TEXT,
    "contamination_type" "ContaminationType" NOT NULL,
    "description" TEXT NOT NULL,
    "contamination_weight_kg" DECIMAL(65,30),
    "contamination_pct" DECIMAL(65,30),
    "estimated_hours" DECIMAL(65,30),
    "fee_amount" DECIMAL(65,30),
    "fee_master_id" TEXT,
    "is_invoiced" BOOLEAN NOT NULL DEFAULT false,
    "recorded_by" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "ContaminationIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoice_number_key" ON "Invoice"("invoice_number");

-- CreateIndex
CREATE INDEX "Invoice_supplier_id_idx" ON "Invoice"("supplier_id");

-- CreateIndex
CREATE INDEX "Invoice_contract_id_idx" ON "Invoice"("contract_id");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_invoice_date_idx" ON "Invoice"("invoice_date");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoice_id_idx" ON "InvoiceLine"("invoice_id");

-- CreateIndex
CREATE INDEX "InvoiceLine_order_id_idx" ON "InvoiceLine"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "ContaminationIncident_incident_number_key" ON "ContaminationIncident"("incident_number");

-- CreateIndex
CREATE INDEX "ContaminationIncident_order_id_idx" ON "ContaminationIncident"("order_id");

-- CreateIndex
CREATE INDEX "ContaminationIncident_sorting_session_id_idx" ON "ContaminationIncident"("sorting_session_id");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "SupplierContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "InboundOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "ProductTypeMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_contamination_incident_id_fkey" FOREIGN KEY ("contamination_incident_id") REFERENCES "ContaminationIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaminationIncident" ADD CONSTRAINT "ContaminationIncident_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "InboundOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaminationIncident" ADD CONSTRAINT "ContaminationIncident_sorting_session_id_fkey" FOREIGN KEY ("sorting_session_id") REFERENCES "SortingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaminationIncident" ADD CONSTRAINT "ContaminationIncident_fee_master_id_fkey" FOREIGN KEY ("fee_master_id") REFERENCES "FeeMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaminationIncident" ADD CONSTRAINT "ContaminationIncident_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
