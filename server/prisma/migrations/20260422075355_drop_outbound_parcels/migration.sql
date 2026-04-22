-- DropForeignKey
ALTER TABLE "outbound_parcels" DROP CONSTRAINT IF EXISTS "outbound_parcels_outbound_id_fkey";
ALTER TABLE "outbound_parcels" DROP CONSTRAINT IF EXISTS "outbound_parcels_material_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "outbound_parcels";

-- DropEnum
DROP TYPE IF EXISTS "OutboundParcelStatus";
