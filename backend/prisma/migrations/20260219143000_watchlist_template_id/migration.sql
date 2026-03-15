ALTER TABLE "WatchlistItem"
ADD COLUMN "templateId" TEXT;

UPDATE "WatchlistItem"
SET "templateId" = 'govt-construction'
WHERE "templateId" IS NULL;

ALTER TABLE "WatchlistItem"
ALTER COLUMN "templateId" SET NOT NULL;

CREATE INDEX "WatchlistItem_templateId_idx" ON "WatchlistItem"("templateId");
