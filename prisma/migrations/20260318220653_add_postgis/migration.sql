-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- AlterTable
ALTER TABLE "Garaje" ADD COLUMN     "ubicacion_geo" geography(Point, 4326);
