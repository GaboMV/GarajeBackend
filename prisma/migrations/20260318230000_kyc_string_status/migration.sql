-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "esta_verificado" DROP DEFAULT,
ALTER COLUMN "esta_verificado" SET DATA TYPE TEXT,
ALTER COLUMN "esta_verificado" SET DEFAULT 'NO_VERIFICADO';

-- AddColumn
ALTER TABLE "Usuario" ADD COLUMN     "motivo_rechazo_kyc" TEXT;
