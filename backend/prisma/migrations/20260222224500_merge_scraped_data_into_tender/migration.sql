ALTER TABLE "Tender"
  ADD COLUMN IF NOT EXISTS "externalId" INTEGER,
  ADD COLUMN IF NOT EXISTS "available" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "tenderNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "companyName" TEXT,
  ADD COLUMN IF NOT EXISTS "province" TEXT,
  ADD COLUMN IF NOT EXISTS "scrapedStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "publishedDate" TEXT,
  ADD COLUMN IF NOT EXISTS "closingDate" TEXT,
  ADD COLUMN IF NOT EXISTS "documents" JSONB,
  ADD COLUMN IF NOT EXISTS "lastScrapedAt" TIMESTAMP(3);

DO $$
DECLARE
  fallback_user_id TEXT;
BEGIN
  SELECT "id"
  INTO fallback_user_id
  FROM "User"
  ORDER BY "createdAt" ASC
  LIMIT 1;

  IF fallback_user_id IS NULL THEN
    INSERT INTO "User" (
      "id",
      "email",
      "passwordHash",
      "name",
      "isActive",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      gen_random_uuid(),
      'system+tender-migration@tenderlens.local',
      'migrated-placeholder',
      'System Migration',
      true,
      NOW(),
      NOW()
    )
    RETURNING "id" INTO fallback_user_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'TenderScrapedData'
  ) THEN
    EXECUTE '
      INSERT INTO "Tender" (
        "id",
        "orgId",
        "title",
        "source",
        "status",
        "createdByUserId",
        "createdAt",
        "updatedAt"
      )
      SELECT
        s."tenderId",
        NULL,
        COALESCE(
          NULLIF(BTRIM(s."description"), ''''),
          NULLIF(BTRIM(s."tenderNumber"), ''''),
          CASE
            WHEN s."externalId" IS NOT NULL THEN ''Imported eTender #'' || s."externalId"::text
            ELSE ''Imported eTender''
          END
        ),
        COALESCE(
          NULLIF(BTRIM(s."source"), ''''),
          CASE
            WHEN s."externalId" IS NOT NULL THEN ''etenders:'' || s."externalId"::text || '':'' || COALESCE(NULLIF(BTRIM(s."tenderNumber"), ''''), ''unknown'')
            ELSE NULL
          END
        ),
        ''DRAFT''::"TenderStatus",
        $1,
        COALESCE(s."createdAt", NOW()),
        COALESCE(s."updatedAt", NOW())
      FROM "TenderScrapedData" s
      LEFT JOIN "Tender" t ON t."id" = s."tenderId"
      WHERE s."tenderId" IS NOT NULL
        AND t."id" IS NULL
      ON CONFLICT ("id") DO NOTHING
    '
    USING fallback_user_id;

    EXECUTE '
      UPDATE "Tender" t
      SET
        "externalId" = s."externalId",
        "available" = COALESCE(s."available", t."available"),
        "tenderNumber" = s."tenderNumber",
        "description" = s."description",
        "category" = s."category",
        "companyName" = s."companyName",
        "province" = s."province",
        "scrapedStatus" = s."status",
        "publishedDate" = s."publishedDate",
        "closingDate" = s."closingDate",
        "documents" = s."documents",
        "lastScrapedAt" = COALESCE(s."updatedAt", t."lastScrapedAt"),
        "updatedAt" = NOW()
      FROM "TenderScrapedData" s
      WHERE s."tenderId" = t."id"
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ScrapedTenderData'
  ) THEN
    EXECUTE '
      INSERT INTO "Tender" (
        "id",
        "orgId",
        "title",
        "source",
        "status",
        "createdByUserId",
        "createdAt",
        "updatedAt"
      )
      SELECT
        s."tenderId",
        NULL,
        COALESCE(
          NULLIF(BTRIM(s."description"), ''''),
          NULLIF(BTRIM(s."tenderNumber"), ''''),
          CASE
            WHEN s."externalId" IS NOT NULL THEN ''Imported eTender #'' || s."externalId"::text
            ELSE ''Imported eTender''
          END
        ),
        COALESCE(
          NULLIF(BTRIM(s."source"), ''''),
          CASE
            WHEN s."externalId" IS NOT NULL THEN ''etenders:'' || s."externalId"::text || '':'' || COALESCE(NULLIF(BTRIM(s."tenderNumber"), ''''), ''unknown'')
            ELSE NULL
          END
        ),
        ''DRAFT''::"TenderStatus",
        $1,
        COALESCE(s."createdAt", NOW()),
        COALESCE(s."updatedAt", NOW())
      FROM "ScrapedTenderData" s
      LEFT JOIN "Tender" t ON t."id" = s."tenderId"
      WHERE s."tenderId" IS NOT NULL
        AND t."id" IS NULL
      ON CONFLICT ("id") DO NOTHING
    '
    USING fallback_user_id;

    EXECUTE '
      UPDATE "Tender" t
      SET
        "externalId" = s."externalId",
        "available" = COALESCE(s."available", t."available"),
        "tenderNumber" = s."tenderNumber",
        "description" = s."description",
        "category" = s."category",
        "companyName" = s."companyName",
        "province" = s."province",
        "scrapedStatus" = s."status",
        "publishedDate" = s."publishedDate",
        "closingDate" = s."closingDate",
        "documents" = s."documents",
        "lastScrapedAt" = COALESCE(s."updatedAt", t."lastScrapedAt"),
        "updatedAt" = NOW()
      FROM "ScrapedTenderData" s
      WHERE s."tenderId" = t."id"
    ';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Tender_externalId_idx" ON "Tender"("externalId");

DROP TABLE IF EXISTS "TenderScrapedData";
DROP TABLE IF EXISTS "ScrapedTenderData";
