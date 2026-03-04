-- CreateEnum
CREATE TYPE "Role" AS ENUM ('GATE_OPERATOR', 'LOGISTICS_PLANNER', 'REPORTING_MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PLANNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WeighingEventStatus" AS ENUM ('PENDING_GROSS', 'GROSS_COMPLETE', 'PENDING_TARE', 'TARE_COMPLETE', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "SortingStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('PRIVATE_INDIVIDUAL', 'PRO', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "SkipType" AS ENUM ('OPEN_TOP', 'CLOSED_TOP', 'GITTERBOX', 'PALLET', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carrier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kvk_number" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "licence_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplier_type" "SupplierType" NOT NULL,
    "kvk_number" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "registration_plate" TEXT NOT NULL,
    "carrier_id" TEXT NOT NULL,
    "type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteStream" (
    "id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_nl" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WasteStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "code_cbs" TEXT NOT NULL,
    "description_en" TEXT NOT NULL,
    "description_nl" TEXT NOT NULL,
    "waste_stream_id" TEXT NOT NULL,
    "recycled_pct_default" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reused_pct_default" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "disposed_pct_default" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "landfill_pct_default" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundOrder" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "carrier_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "planned_date" TIMESTAMP(3) NOT NULL,
    "planned_time_window_start" TIMESTAMP(3),
    "planned_time_window_end" TIMESTAMP(3),
    "expected_skip_count" INTEGER NOT NULL DEFAULT 1,
    "waste_stream_id" TEXT NOT NULL,
    "afvalstroomnummer" TEXT,
    "notes" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PLANNED',
    "is_adhoc" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeighingEvent" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "arrived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gross_ticket_id" TEXT,
    "tare_ticket_id" TEXT,
    "gross_weight_kg" DECIMAL(65,30),
    "tare_weight_kg" DECIMAL(65,30),
    "net_weight_kg" DECIMAL(65,30),
    "status" "WeighingEventStatus" NOT NULL DEFAULT 'PENDING_GROSS',
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "WeighingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PfisterTicket" (
    "id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "weighing_type" TEXT NOT NULL,
    "weight_kg" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "raw_payload" TEXT NOT NULL,
    "is_manual_override" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "override_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PfisterTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "asset_label" TEXT NOT NULL,
    "weighing_event_id" TEXT NOT NULL,
    "skip_type" "SkipType" NOT NULL,
    "material_category_id" TEXT NOT NULL,
    "estimated_volume_m3" DECIMAL(65,30),
    "gross_weight_kg" DECIMAL(65,30),
    "tare_weight_kg" DECIMAL(65,30),
    "net_weight_kg" DECIMAL(65,30),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SortingSession" (
    "id" TEXT NOT NULL,
    "weighing_event_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SortingStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,

    CONSTRAINT "SortingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SortingLine" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "net_weight_kg" DECIMAL(65,30) NOT NULL,
    "recycled_pct" DECIMAL(65,30) NOT NULL,
    "reused_pct" DECIMAL(65,30) NOT NULL,
    "disposed_pct" DECIMAL(65,30) NOT NULL,
    "landfill_pct" DECIMAL(65,30) NOT NULL,
    "downstream_processor" TEXT,
    "notes" TEXT,

    CONSTRAINT "SortingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "generated_by" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parameters_json" JSONB NOT NULL,
    "file_path_pdf" TEXT,
    "file_path_xlsx" TEXT,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "day_of_week" INTEGER,
    "day_of_month" INTEGER,
    "recipient_emails" TEXT[],
    "format" TEXT NOT NULL,
    "parameters_json" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "diff_json" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registration_plate_key" ON "Vehicle"("registration_plate");

-- CreateIndex
CREATE UNIQUE INDEX "WasteStream_code_key" ON "WasteStream"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_code_cbs_key" ON "ProductCategory"("code_cbs");

-- CreateIndex
CREATE UNIQUE INDEX "InboundOrder_order_number_key" ON "InboundOrder"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "WeighingEvent_gross_ticket_id_key" ON "WeighingEvent"("gross_ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "WeighingEvent_tare_ticket_id_key" ON "WeighingEvent"("tare_ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "PfisterTicket_ticket_number_key" ON "PfisterTicket"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_asset_label_key" ON "Asset"("asset_label");

-- CreateIndex
CREATE UNIQUE INDEX "SortingSession_weighing_event_id_key" ON "SortingSession"("weighing_event_id");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_waste_stream_id_fkey" FOREIGN KEY ("waste_stream_id") REFERENCES "WasteStream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundOrder" ADD CONSTRAINT "InboundOrder_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundOrder" ADD CONSTRAINT "InboundOrder_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundOrder" ADD CONSTRAINT "InboundOrder_waste_stream_id_fkey" FOREIGN KEY ("waste_stream_id") REFERENCES "WasteStream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundOrder" ADD CONSTRAINT "InboundOrder_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighingEvent" ADD CONSTRAINT "WeighingEvent_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "InboundOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighingEvent" ADD CONSTRAINT "WeighingEvent_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighingEvent" ADD CONSTRAINT "WeighingEvent_gross_ticket_id_fkey" FOREIGN KEY ("gross_ticket_id") REFERENCES "PfisterTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighingEvent" ADD CONSTRAINT "WeighingEvent_tare_ticket_id_fkey" FOREIGN KEY ("tare_ticket_id") REFERENCES "PfisterTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighingEvent" ADD CONSTRAINT "WeighingEvent_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_weighing_event_id_fkey" FOREIGN KEY ("weighing_event_id") REFERENCES "WeighingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_material_category_id_fkey" FOREIGN KEY ("material_category_id") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortingSession" ADD CONSTRAINT "SortingSession_weighing_event_id_fkey" FOREIGN KEY ("weighing_event_id") REFERENCES "WeighingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortingSession" ADD CONSTRAINT "SortingSession_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortingLine" ADD CONSTRAINT "SortingLine_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "SortingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortingLine" ADD CONSTRAINT "SortingLine_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortingLine" ADD CONSTRAINT "SortingLine_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
