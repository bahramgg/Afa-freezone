-- AlterTable
ALTER TABLE "DepositAddress" ADD COLUMN     "bankAmount" DECIMAL(38,18),
ADD COLUMN     "freezoneAmount" DECIMAL(38,18),
ADD COLUMN     "gatewayAmount" DECIMAL(38,18),
ADD COLUMN     "terms" JSONB;
