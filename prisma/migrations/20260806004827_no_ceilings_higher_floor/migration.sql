-- AlterTable
ALTER TABLE "Settings" ALTER COLUMN "feeMax" SET DEFAULT 0,
ALTER COLUMN "invoiceMinAmount" SET DEFAULT 50,
ALTER COLUMN "invoiceMaxAmount" SET DEFAULT 0;

-- The row itself, not just the default a fresh install would get.
--
-- Only where it still holds the old defaults: an operator who had deliberately
-- set a different floor or ceiling chose that, and a migration has no business
-- overruling them. Zero means "no ceiling", the convention the settlement
-- contract already uses for its own fee bound.
UPDATE "Settings" SET "invoiceMinAmount" = 50  WHERE "invoiceMinAmount" = 10;
UPDATE "Settings" SET "invoiceMaxAmount" = 0   WHERE "invoiceMaxAmount" = 100000;
UPDATE "Settings" SET "feeMax"           = 0   WHERE "feeMax" = 500;
