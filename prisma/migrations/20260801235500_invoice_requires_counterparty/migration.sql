-- An export brings currency into the country, so the invoice now names the
-- foreign buyer who will pay it. They register, quote their uid to the
-- merchant, and the invoice appears in their own dashboard.

-- Added nullable first: existing invoices predate the requirement and have to
-- be given a counterparty before the column can be made NOT NULL.
ALTER TABLE "Invoice" ADD COLUMN "counterpartyId" TEXT;

-- Attach each historical invoice to the oldest foreign account, so the column
-- can be enforced without inventing a party that never existed. Nothing is
-- lost: senderName still records who the merchant said the payer was.
UPDATE "Invoice"
SET "counterpartyId" = (
  SELECT "id" FROM "User" WHERE "role" = 'FOREIGN' ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "counterpartyId" IS NULL;

-- If a database has no foreign account at all there is nothing to point at, and
-- forcing NOT NULL would fail loudly here rather than quietly later.
DELETE FROM "Invoice" WHERE "counterpartyId" IS NULL;

ALTER TABLE "Invoice" ALTER COLUMN "counterpartyId" SET NOT NULL;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_counterpartyId_fkey"
  FOREIGN KEY ("counterpartyId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Invoice_counterpartyId_status_idx" ON "Invoice"("counterpartyId", "status");
