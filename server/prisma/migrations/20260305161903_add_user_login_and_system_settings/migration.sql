-- AlterTable
ALTER TABLE "User" ADD COLUMN     "last_login_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "facility_name" TEXT NOT NULL DEFAULT 'Statice B.V.',
    "facility_address" TEXT NOT NULL DEFAULT 'Recyclingweg 1, 1234 AB Amsterdam',
    "facility_permit_number" TEXT NOT NULL DEFAULT 'ST-2026-001',
    "facility_kvk" TEXT NOT NULL DEFAULT '12345678',
    "report_footer_text" TEXT NOT NULL DEFAULT 'Statice B.V. — Confidential',
    "max_skips_per_event" INTEGER NOT NULL DEFAULT 10,
    "require_downstream_processor" BOOLEAN NOT NULL DEFAULT false,
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);
