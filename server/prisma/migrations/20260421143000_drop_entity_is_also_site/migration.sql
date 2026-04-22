-- Drop is_also_site column from Entity.
-- Disposer entities now manage physical sites exclusively via DisposerSite records.
ALTER TABLE "Entity" DROP COLUMN IF EXISTS "is_also_site";
