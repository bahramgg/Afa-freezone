-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "receivedAmount" DECIMAL(38,18);

-- CreateTable
CREATE TABLE "DepositAddress" (
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "invoiceId" TEXT,
    "receivedAmount" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "sweptAt" TIMESTAMP(3),
    "sweepTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepositAddress_index_key" ON "DepositAddress"("index");

-- CreateIndex
CREATE UNIQUE INDEX "DepositAddress_address_key" ON "DepositAddress"("address");

-- CreateIndex
CREATE UNIQUE INDEX "DepositAddress_invoiceId_key" ON "DepositAddress"("invoiceId");

-- CreateIndex
CREATE INDEX "DepositAddress_sweptAt_idx" ON "DepositAddress"("sweptAt");

-- AddForeignKey
ALTER TABLE "DepositAddress" ADD CONSTRAINT "DepositAddress_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
