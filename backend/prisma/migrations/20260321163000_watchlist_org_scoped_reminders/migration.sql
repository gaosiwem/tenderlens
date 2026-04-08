DROP INDEX IF EXISTS "TenderReminder_tenderId_type_fireAt_key";

CREATE UNIQUE INDEX "TenderReminder_orgId_tenderId_type_fireAt_key"
ON "TenderReminder"("orgId", "tenderId", "type", "fireAt");
