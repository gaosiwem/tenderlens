ALTER TABLE "WatchlistItem"
ADD COLUMN "reminderTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "WatchlistItem_reminderTypes_idx"
ON "WatchlistItem"
USING GIN ("reminderTypes");
