-- Multi-tenant isolation fixes for workspaces, checklists, and notification preferences.

ALTER TABLE "BidWorkspace"
  DROP CONSTRAINT IF EXISTS "BidWorkspace_tenderId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "BidWorkspace_orgId_tenderId_key"
  ON "BidWorkspace"("orgId", "tenderId");

ALTER TABLE "BidChecklist"
  DROP CONSTRAINT IF EXISTS "BidChecklist_tenderId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "BidChecklist_orgId_tenderId_key"
  ON "BidChecklist"("orgId", "tenderId");

ALTER TABLE "UserNotificationPrefs"
  DROP CONSTRAINT IF EXISTS "UserNotificationPrefs_userId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "UserNotificationPrefs_orgId_userId_key"
  ON "UserNotificationPrefs"("orgId", "userId");
