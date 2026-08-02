-- The remainder of a split belongs to whoever the terms name as beneficiary:
-- the bank's treasury on an export, the foreign seller on an import. The column
-- is renamed rather than replaced so the figures already recorded survive.
ALTER TABLE "DepositAddress" RENAME COLUMN "bankAmount" TO "beneficiaryAmount";

-- An import's remainder leaves the system instead of moving into the bank's
-- holding, and needs an account of its own to land in.
ALTER TYPE "LedgerAccount" ADD VALUE 'SUPPLIER_PAID';
