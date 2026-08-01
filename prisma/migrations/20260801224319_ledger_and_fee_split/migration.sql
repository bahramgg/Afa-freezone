-- CreateEnum
CREATE TYPE "LedgerAccount" AS ENUM ('DEPOSIT_HELD', 'BANK_HELD', 'MERCHANT_PAYABLE', 'GATEWAY_SHARE', 'FREEZONE_SHARE', 'BANK_SPREAD');

-- CreateEnum
CREATE TYPE "LedgerUnit" AS ENUM ('USDT', 'BNB', 'IRR');

-- AlterTable
ALTER TABLE "SendRequest" ADD COLUMN     "bankSpreadRial" DECIMAL(24,2);

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "freezoneSharePercent" DECIMAL(6,3) NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "bankSpreadRial" DECIMAL(24,2);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "account" "LedgerAccount" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "unit" "LedgerUnit" NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT,
    "subjectId" TEXT,
    "subjectRef" TEXT,
    "userId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerEntry_account_createdAt_idx" ON "LedgerEntry"("account", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_subject_subjectId_idx" ON "LedgerEntry"("subject", "subjectId");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_account_idx" ON "LedgerEntry"("userId", "account");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
