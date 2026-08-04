-- The allowlist learns what it is admitting an address as.
ALTER TABLE "AllowedEmail" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'IRANIAN';

CREATE INDEX "AllowedEmail_role_idx" ON "AllowedEmail"("role");

-- Every operator that already exists is written onto the list.
--
-- From here a staff role is only valid while its address is listed, so without
-- this the migration would lock the free zone, the bank and the system
-- administrator out of their own panels the moment it ran.
INSERT INTO "AllowedEmail" ("id", "email", "role", "note", "createdAt")
SELECT
  gen_random_uuid()::text,
  "email",
  "role",
  'افزوده‌شده هنگام ساخت فهرست دسترسی',
  now()
FROM "User"
WHERE "role" IN ('ADMIN', 'BANK', 'SUPERADMIN')
  AND "email" IS NOT NULL
ON CONFLICT ("email") DO UPDATE SET "role" = EXCLUDED."role";
