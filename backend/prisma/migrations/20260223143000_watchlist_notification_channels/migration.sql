ALTER TABLE "WatchlistItem"
ADD COLUMN "notificationChannels" TEXT[] NOT NULL DEFAULT ARRAY['email']::TEXT[];

CREATE INDEX "WatchlistItem_notificationChannels_idx"
ON "WatchlistItem"
USING GIN ("notificationChannels");
