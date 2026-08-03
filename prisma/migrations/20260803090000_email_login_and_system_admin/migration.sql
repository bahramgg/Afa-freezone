-- Running the system and running the business are different powers.
ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';

-- A sign-in link carries 32 random bytes, not the six digits a URL would leak.
ALTER TABLE "OtpCode" ADD COLUMN "linkTokenHash" TEXT;

-- Off to begin with: turning people away before anyone is inside is a way to
-- have no users.
ALTER TABLE "Settings" ADD COLUMN "registrationRestricted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AllowedEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "note" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllowedEmail_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AllowedEmail_email_key" ON "AllowedEmail"("email");
ALTER TABLE "AllowedEmail" ADD CONSTRAINT "AllowedEmail_addedById_fkey"
  FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- What people did, as distinct from what money did.
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT,
    "detail" TEXT,
    "actorId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
