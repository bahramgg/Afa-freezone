-- CreateEnum
CREATE TYPE "TradeDocumentKind" AS ENUM ('PROFORMA', 'ORDER_REGISTRATION', 'CUSTOMS_DECLARATION', 'CONTRACT');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'SENT', 'REJECTED');

-- AlterEnum
ALTER TYPE "LedgerAccount" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "SendRequest" ADD COLUMN     "counterpartyEmail" TEXT,
ADD COLUMN     "counterpartyName" TEXT,
ADD COLUMN     "recipientConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TradeDocument" (
    "id" TEXT NOT NULL,
    "kind" "TradeDocumentKind" NOT NULL,
    "number" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "issuer" TEXT,
    "note" TEXT,
    "invoiceId" TEXT,
    "sendId" TEXT,
    "settlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "currency" "Currency" NOT NULL,
    "toAddress" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "requestedById" TEXT,
    "txHash" TEXT,
    "sentAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeDocument_invoiceId_idx" ON "TradeDocument"("invoiceId");

-- CreateIndex
CREATE INDEX "TradeDocument_sendId_idx" ON "TradeDocument"("sendId");

-- CreateIndex
CREATE INDEX "TradeDocument_settlementId_idx" ON "TradeDocument"("settlementId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_ref_key" ON "Refund"("ref");

-- CreateIndex
CREATE INDEX "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_invoiceId_idx" ON "Refund"("invoiceId");

-- AddForeignKey
ALTER TABLE "TradeDocument" ADD CONSTRAINT "TradeDocument_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeDocument" ADD CONSTRAINT "TradeDocument_sendId_fkey" FOREIGN KEY ("sendId") REFERENCES "SendRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeDocument" ADD CONSTRAINT "TradeDocument_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
