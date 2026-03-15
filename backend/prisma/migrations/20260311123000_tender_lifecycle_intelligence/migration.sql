ALTER TABLE "Tender"
  ADD COLUMN IF NOT EXISTS "lifecycle" TEXT,
  ADD COLUMN IF NOT EXISTS "lifecycleDetectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lifecycleDateSource" TEXT;

CREATE INDEX IF NOT EXISTS "Tender_lifecycle_idx" ON "Tender"("lifecycle");

DO $$
BEGIN
  ALTER TYPE "TenderChangeType" ADD VALUE 'LIFECYCLE_CHANGED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE "Tender"
SET
  "lifecycle" = CASE
    WHEN LOWER(COALESCE("scrapedStatus", '')) LIKE '%award%' THEN 'awarded'
    WHEN LOWER(COALESCE("scrapedStatus", '')) LIKE '%cancel%' THEN 'cancelled'
    WHEN LOWER(COALESCE("scrapedStatus", '')) LIKE '%closed%' THEN 'closed'
    WHEN LOWER(COALESCE("scrapedStatus", '')) LIKE '%publish%'
      OR LOWER(COALESCE("scrapedStatus", '')) LIKE '%open%'
      OR "scrapedStatus" IS NULL THEN 'open'
    ELSE CASE
      WHEN "closingDate" IS NOT NULL
        AND "closingDate" ~ '^\d{4}-\d{2}-\d{2}'
        AND (
          CASE
            WHEN BTRIM("closingDate") ~ '^\d{4}-\d{2}-\d{2}$'
              THEN (BTRIM("closingDate")::date + INTERVAL '1 day' - INTERVAL '1 second')
            WHEN BTRIM("closingDate") ~ '^\d{4}-\d{2}-\d{2}T'
              THEN BTRIM("closingDate")::timestamp
            ELSE NULL
          END
        ) < NOW()
      THEN 'closed'
      ELSE 'open'
    END
  END,
  "lifecycleDetectedAt" = COALESCE("lastScrapedAt", "updatedAt", "createdAt"),
  "lifecycleDateSource" = CASE
    WHEN LOWER(COALESCE("scrapedStatus", '')) LIKE '%award%' THEN 'import_detected_at'
    WHEN LOWER(COALESCE("scrapedStatus", '')) LIKE '%cancel%' THEN 'cancelled_date'
    WHEN LOWER(COALESCE("scrapedStatus", '')) LIKE '%closed%' THEN 'closing_date'
    ELSE 'closing_date'
  END
WHERE "lifecycle" IS NULL;
