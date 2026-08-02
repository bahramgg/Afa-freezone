-- An import is administrative work measured in days, not a wallet transfer
-- measured in minutes. Sharing the export window expired every import invoice
-- before the bank could price it.
ALTER TABLE "Settings" ADD COLUMN "importValidityHours" INTEGER NOT NULL DEFAULT 72;
