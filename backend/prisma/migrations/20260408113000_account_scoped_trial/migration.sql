ALTER TABLE "User"
ADD COLUMN "trialStartedAt" TIMESTAMP(3),
ADD COLUMN "trialEndsAt" TIMESTAMP(3);

UPDATE "User"
SET
  "trialStartedAt" = COALESCE("trialStartedAt", "createdAt"),
  "trialEndsAt" = COALESCE(
    "trialEndsAt",
    COALESCE("trialStartedAt", "createdAt") + INTERVAL '14 days'
  )
WHERE "trialStartedAt" IS NULL
   OR "trialEndsAt" IS NULL;

WITH owner_trial AS (
  SELECT DISTINCT ON (m."orgId")
    m."orgId",
    u."trialEndsAt"
  FROM "Membership" m
  JOIN "User" u ON u.id = m."userId"
  WHERE m."role" = 'OWNER'
  ORDER BY m."orgId", m."createdAt" ASC
)
UPDATE "OrgSubscription" AS s
SET
  "status" = CASE
    WHEN owner_trial."trialEndsAt" IS NULL THEN 'EXPIRED'::"SubscriptionStatus"
    WHEN NOW() > owner_trial."trialEndsAt" THEN 'EXPIRED'::"SubscriptionStatus"
    ELSE 'TRIALING'::"SubscriptionStatus"
  END,
  "trialEndsAt" = owner_trial."trialEndsAt"
FROM owner_trial
WHERE s."orgId" = owner_trial."orgId"
  AND s."plan" = 'TRIAL';
