DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'TenderScrapedData'
  ) THEN
    EXECUTE 'ALTER TABLE "TenderScrapedData" DROP CONSTRAINT IF EXISTS "TenderScrapedData_orgId_fkey"';
    EXECUTE 'ALTER TABLE "TenderScrapedData" DROP CONSTRAINT IF EXISTS "TenderScrapedData_tenderId_fkey"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ScrapedTenderData'
  ) THEN
    EXECUTE 'ALTER TABLE "ScrapedTenderData" DROP CONSTRAINT IF EXISTS "ScrapedTenderData_orgId_fkey"';
    EXECUTE 'ALTER TABLE "ScrapedTenderData" DROP CONSTRAINT IF EXISTS "ScrapedTenderData_tenderId_fkey"';
  END IF;
END $$;
