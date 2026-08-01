-- CreateEnum
CREATE TYPE "Role" AS ENUM ('IRANIAN', 'FOREIGN', 'ADMIN', 'BANK');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN');

-- CreateEnum
CREATE TYPE "WalletOwnerKind" AS ENUM ('USER', 'BANK');

-- CreateEnum
CREATE TYPE "BankWalletKind" AS ENUM ('SEND', 'RECEIVE', 'SHARED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USDT', 'BNB');

-- CreateEnum
CREATE TYPE "Actor" AS ENUM ('USER', 'COUNTERPARTY', 'ADMIN', 'BANK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'APPROVED', 'PAYMENT_PENDING', 'PAID', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SendStatus" AS ENUM ('AWAITING_COUNTERPARTY', 'AWAITING_ADMIN', 'AWAITING_BANK_REVIEW', 'BANK_RATE_LOCKED', 'RIAL_RECEIVED', 'CRYPTO_SENT', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('AWAITING_ADMIN', 'AWAITING_BANK', 'BANK_RATE_LOCKED', 'CRYPTO_RECEIVED', 'CRYPTO_CONFIRMED', 'BANK_APPROVED', 'SETTLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChainTxStatus" AS ENUM ('SEEN', 'CONFIRMING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "ChainTxDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "nationalId" TEXT,
    "freezoneId" TEXT,
    "passportNo" TEXT,
    "country" TEXT,
    "address" TEXT,
    "avatarColor" TEXT NOT NULL DEFAULT 'oklch(0.7 0.16 280)',
    "kyc" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "kycRejectReason" TEXT,
    "kycReviewedAt" TIMESTAMP(3),
    "kycReviewedById" TEXT,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'LOGIN',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ownerKind" "WalletOwnerKind" NOT NULL DEFAULT 'USER',
    "userId" TEXT,
    "bankKind" "BankWalletKind",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusEvent" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actor" "Actor" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "trxRef" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "currency" "Currency" NOT NULL,
    "description" TEXT NOT NULL,
    "goodsTitle" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "paymentAddress" TEXT,
    "walletAddress" TEXT,
    "feeAmount" DECIMAL(38,18),
    "netAmount" DECIMAL(38,18),
    "rejectReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chainTxId" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendRequest" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "trxRef" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "counterpartyId" TEXT,
    "counterpartyUid" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "currency" "Currency" NOT NULL,
    "description" TEXT,
    "status" "SendStatus" NOT NULL DEFAULT 'AWAITING_COUNTERPARTY',
    "exchangeRate" DECIMAL(24,4),
    "rateLocked" BOOLEAN NOT NULL DEFAULT false,
    "rateLockedAt" TIMESTAMP(3),
    "rialAmount" DECIMAL(24,2),
    "bankAccount" TEXT,
    "rialReceiptNo" TEXT,
    "rialDepositAt" TIMESTAMP(3),
    "recipientWalletAddress" TEXT,
    "bankWalletAddress" TEXT,
    "rejectedBy" "Actor",
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chainTxId" TEXT,

    CONSTRAINT "SendRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "trxRef" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "goodsTitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "currency" "Currency" NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "bankAccount" TEXT NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'AWAITING_ADMIN',
    "exchangeRate" DECIMAL(24,4),
    "rateLocked" BOOLEAN NOT NULL DEFAULT false,
    "rateLockedAt" TIMESTAMP(3),
    "rialAmount" DECIMAL(24,2),
    "bankWalletAddress" TEXT,
    "bankResponseAt" TIMESTAMP(3),
    "bankResponseNote" TEXT,
    "rialReceiptNo" TEXT,
    "rialDepositAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "rejectedBy" "Actor",
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chainTxId" TEXT,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainTx" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "direction" "ChainTxDirection" NOT NULL,
    "status" "ChainTxStatus" NOT NULL DEFAULT 'SEEN',
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "rawValue" TEXT NOT NULL,
    "blockNumber" BIGINT,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "gasFee" DECIMAL(38,18),
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "matchedAt" TIMESTAMP(3),

    CONSTRAINT "ChainTx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainCursor" (
    "chainId" INTEGER NOT NULL,
    "lastScannedBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainCursor_pkey" PRIMARY KEY ("chainId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "feeBasePercent" DECIMAL(6,3) NOT NULL DEFAULT 2,
    "feeMin" DECIMAL(38,18) NOT NULL DEFAULT 1,
    "feeMax" DECIMAL(38,18) NOT NULL DEFAULT 500,
    "invoiceValidityMinutes" INTEGER NOT NULL DEFAULT 30,
    "invoiceMinAmount" DECIMAL(38,18) NOT NULL DEFAULT 10,
    "invoiceMaxAmount" DECIMAL(38,18) NOT NULL DEFAULT 100000,
    "usdtRate" DECIMAL(24,4) NOT NULL DEFAULT 66800,
    "bnbRate" DECIMAL(24,4) NOT NULL DEFAULT 222000,
    "dailySendLimit" DECIMAL(38,18) NOT NULL DEFAULT 50000,
    "dailySettlementLimit" DECIMAL(38,18) NOT NULL DEFAULT 50000,
    "minTxAmount" DECIMAL(38,18) NOT NULL DEFAULT 10,
    "bankFeePercent" DECIMAL(6,3) NOT NULL DEFAULT 0.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_uid_key" ON "User"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_nationalId_key" ON "User"("nationalId");

-- CreateIndex
CREATE INDEX "User_role_kyc_idx" ON "User"("role", "kyc");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "OtpCode_phone_createdAt_idx" ON "OtpCode"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "Wallet_ownerKind_active_idx" ON "Wallet"("ownerKind", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_userId_key" ON "Wallet"("address", "userId");

-- CreateIndex
CREATE INDEX "StatusEvent_subject_subjectId_createdAt_idx" ON "StatusEvent"("subject", "subjectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_ref_key" ON "Invoice"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_trxRef_key" ON "Invoice"("trxRef");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_chainTxId_key" ON "Invoice"("chainTxId");

-- CreateIndex
CREATE INDEX "Invoice_ownerId_status_idx" ON "Invoice"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Invoice_status_createdAt_idx" ON "Invoice"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SendRequest_ref_key" ON "SendRequest"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "SendRequest_trxRef_key" ON "SendRequest"("trxRef");

-- CreateIndex
CREATE UNIQUE INDEX "SendRequest_chainTxId_key" ON "SendRequest"("chainTxId");

-- CreateIndex
CREATE INDEX "SendRequest_ownerId_status_idx" ON "SendRequest"("ownerId", "status");

-- CreateIndex
CREATE INDEX "SendRequest_status_createdAt_idx" ON "SendRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_ref_key" ON "Settlement"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_trxRef_key" ON "Settlement"("trxRef");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_chainTxId_key" ON "Settlement"("chainTxId");

-- CreateIndex
CREATE INDEX "Settlement_ownerId_status_idx" ON "Settlement"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Settlement_status_createdAt_idx" ON "Settlement"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChainTx_hash_key" ON "ChainTx"("hash");

-- CreateIndex
CREATE INDEX "ChainTx_toAddress_status_idx" ON "ChainTx"("toAddress", "status");

-- CreateIndex
CREATE INDEX "ChainTx_status_blockNumber_idx" ON "ChainTx"("status", "blockNumber");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_kycReviewedById_fkey" FOREIGN KEY ("kycReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_chainTxId_fkey" FOREIGN KEY ("chainTxId") REFERENCES "ChainTx"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendRequest" ADD CONSTRAINT "SendRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendRequest" ADD CONSTRAINT "SendRequest_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendRequest" ADD CONSTRAINT "SendRequest_chainTxId_fkey" FOREIGN KEY ("chainTxId") REFERENCES "ChainTx"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_chainTxId_fkey" FOREIGN KEY ("chainTxId") REFERENCES "ChainTx"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
