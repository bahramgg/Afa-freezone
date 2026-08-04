-- Calling an import off.
--
-- Until now an import that went wrong after the bank had taken the importer's
-- rial had no exit: `reject` and `expire` both stop at APPROVED, and the refund
-- route keys on the invoice owner — who, on an import, is the foreign seller,
-- not the importer whose money is sitting at the bank. The file froze and the
-- only way out was editing the database by hand.
ALTER TYPE "InvoiceStatus" ADD VALUE 'CANCELLING';
ALTER TYPE "InvoiceStatus" ADD VALUE 'CANCELLED';

ALTER TABLE "Invoice"
  ADD COLUMN "cancelRequestedAt"   TIMESTAMP(3),
  ADD COLUMN "cancelRequestedById" TEXT,
  ADD COLUMN "cancelReason"        TEXT,
  ADD COLUMN "cancelledAt"         TIMESTAMP(3),
  ADD COLUMN "rialReturnReceiptNo" TEXT,
  ADD COLUMN "rialReturnedAt"      TIMESTAMP(3);

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_cancelRequestedById_fkey"
  FOREIGN KEY ("cancelRequestedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
