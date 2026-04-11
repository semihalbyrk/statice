-- CreateEnum
CREATE TYPE "WeighingMode" AS ENUM ('SWAP', 'DIRECT', 'BULK');

-- AlterTable
ALTER TABLE "WeighingEvent" ADD COLUMN "weighing_mode" "WeighingMode";

-- CreateTable
CREATE TABLE "ContainerRegistry" (
    "id" TEXT NOT NULL,
    "container_label" TEXT NOT NULL,
    "container_type" "SkipType" NOT NULL,
    "tare_weight_kg" DECIMAL(65,30) NOT NULL,
    "volume_m3" DECIMAL(65,30),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContainerRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContainerRegistry_container_label_key" ON "ContainerRegistry"("container_label");
