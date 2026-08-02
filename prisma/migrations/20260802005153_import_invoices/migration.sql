-- CreateEnum
CREATE TYPE "TradeDirection" AS ENUM ('EXPORT', 'IMPORT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InvoiceStatus" ADD VALUE 'BANK_RATE_LOCKED';
ALTER TYPE "InvoiceStatus" ADD VALUE 'RIAL_RECEIVED';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "bankSpreadRial" DECIMAL(24,2),
ADD COLUMN     "beneficiaryWallet" TEXT,
ADD COLUMN     "depositAccount" TEXT,
ADD COLUMN     "direction" "TradeDirection" NOT NULL DEFAULT 'EXPORT',
ADD COLUMN     "exchangeRate" DECIMAL(24,4),
ADD COLUMN     "rateLockedAt" TIMESTAMP(3),
ADD COLUMN     "rialAmount" DECIMAL(24,2),
ADD COLUMN     "rialDepositAt" TIMESTAMP(3),
ADD COLUMN     "rialReceiptNo" TEXT;
