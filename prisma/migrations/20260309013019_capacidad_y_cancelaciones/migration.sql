-- AlterTable
ALTER TABLE "Garaje" ADD COLUMN     "capacidad_puestos" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "PoliticaCancelacion" (
    "id" TEXT NOT NULL,
    "id_garaje" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "reembolso_24h" DECIMAL(5,2) NOT NULL,
    "reembolso_mismo_dia" DECIMAL(5,2) NOT NULL,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoliticaCancelacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PoliticaCancelacion_id_garaje_key" ON "PoliticaCancelacion"("id_garaje");

-- AddForeignKey
ALTER TABLE "PoliticaCancelacion" ADD CONSTRAINT "PoliticaCancelacion_id_garaje_fkey" FOREIGN KEY ("id_garaje") REFERENCES "Garaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
