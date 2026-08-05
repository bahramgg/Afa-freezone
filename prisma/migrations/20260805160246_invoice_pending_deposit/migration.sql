-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "pendingAmount" DECIMAL(38,18) NOT NULL DEFAULT 0;
