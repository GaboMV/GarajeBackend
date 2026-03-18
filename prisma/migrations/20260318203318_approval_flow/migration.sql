-- AlterTable
ALTER TABLE "Garaje" ADD COLUMN     "documento_propiedad_url" TEXT,
ADD COLUMN     "esta_aprobado" BOOLEAN NOT NULL DEFAULT false;
