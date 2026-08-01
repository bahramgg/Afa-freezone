-- One gateway fee, taken once per journey; a paid invoice now produces its own
-- payout settlement; and the two `bankAccount` columns get names that say which
-- direction the money moves.

-- ── SettlementStatus: BANK_APPROVED was in the enum, in the badge map and in
-- two panel filters, but no transition ever wrote it. Nothing to migrate.
BEGIN;
CREATE TYPE "SettlementStatus_new" AS ENUM ('AWAITING_ADMIN', 'AWAITING_BANK', 'BANK_RATE_LOCKED', 'CRYPTO_RECEIVED', 'CRYPTO_CONFIRMED', 'SETTLED', 'REJECTED');
UPDATE "Settlement" SET "status" = 'CRYPTO_CONFIRMED' WHERE "status" = 'BANK_APPROVED';
ALTER TABLE "Settlement" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Settlement" ALTER COLUMN "status" TYPE "SettlementStatus_new" USING ("status"::text::"SettlementStatus_new");
ALTER TYPE "SettlementStatus" RENAME TO "SettlementStatus_old";
ALTER TYPE "SettlementStatus_new" RENAME TO "SettlementStatus";
DROP TYPE "SettlementStatus_old";
ALTER TABLE "Settlement" ALTER COLUMN "status" SET DEFAULT 'AWAITING_ADMIN';
COMMIT;

-- ── SendRequest: renamed, not dropped, so live requests keep the account the
-- bank already told the merchant to pay into.
ALTER TABLE "SendRequest" RENAME COLUMN "bankAccount" TO "depositAccount";
ALTER TABLE "SendRequest" ADD COLUMN "feeAmount" DECIMAL(38,18);
ALTER TABLE "SendRequest" ADD COLUMN "netAmount" DECIMAL(38,18);

-- ── Settings: the bank's own fee percentage was editable in the bank panel and
-- entered no calculation anywhere. A rate tolerance replaces it as the one knob
-- guarding the rate an operator types by hand.
ALTER TABLE "Settings" DROP COLUMN "bankFeePercent";
ALTER TABLE "Settings" ADD COLUMN "rateTolerancePercent" DECIMAL(6,3) NOT NULL DEFAULT 10;

-- ── Settlement
ALTER TABLE "Settlement" RENAME COLUMN "bankAccount" TO "payoutAccount";
ALTER TABLE "Settlement" ALTER COLUMN "payoutAccount" DROP NOT NULL;
-- Null for a settlement raised from a paid invoice: the crypto is already in
-- the bank's wallet, so the merchant sends nothing from anywhere.
ALTER TABLE "Settlement" ALTER COLUMN "walletAddress" DROP NOT NULL;
ALTER TABLE "Settlement" ADD COLUMN "feeAmount" DECIMAL(38,18);
ALTER TABLE "Settlement" ADD COLUMN "netAmount" DECIMAL(38,18);
ALTER TABLE "Settlement" ADD COLUMN "sourceInvoiceId" TEXT;

CREATE UNIQUE INDEX "Settlement_sourceInvoiceId_key" ON "Settlement"("sourceInvoiceId");
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_sourceInvoiceId_fkey" FOREIGN KEY ("sourceInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Wallet: @@unique([address, userId]) never fires for a bank wallet, because
-- userId is null there and Postgres treats nulls as distinct — two bank wallets
-- could share an address, which would break the least-loaded gateway pick.
CREATE UNIQUE INDEX "Wallet_bank_address_key" ON "Wallet"("address") WHERE "ownerKind" = 'BANK';
