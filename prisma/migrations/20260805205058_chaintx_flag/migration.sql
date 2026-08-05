-- AlterTable
ALTER TABLE "ChainTx" ADD COLUMN     "flagNote" TEXT,
ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "flaggedById" TEXT;

-- CreateIndex
CREATE INDEX "ChainTx_matchedAt_flaggedAt_idx" ON "ChainTx"("matchedAt", "flaggedAt");

-- AddForeignKey
ALTER TABLE "ChainTx" ADD CONSTRAINT "ChainTx_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
