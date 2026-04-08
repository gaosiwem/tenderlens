ALTER TABLE "OrgSubscription"
  DROP COLUMN IF EXISTS "stripeCustomerId",
  DROP COLUMN IF EXISTS "stripeSubscriptionId";

ALTER TABLE "OrgInvoice"
  DROP COLUMN IF EXISTS "stripeInvoiceId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ReferralAttribution'
      AND column_name = 'stripeCheckoutSessionId'
  ) THEN
    ALTER TABLE "ReferralAttribution"
      RENAME COLUMN "stripeCheckoutSessionId" TO "checkoutReference";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ReferralAttribution'
      AND column_name = 'stripeCustomerId'
  ) THEN
    ALTER TABLE "ReferralAttribution"
      RENAME COLUMN "stripeCustomerId" TO "customerReference";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ReferralAttribution'
      AND column_name = 'stripeSubscriptionId'
  ) THEN
    ALTER TABLE "ReferralAttribution"
      RENAME COLUMN "stripeSubscriptionId" TO "billingReference";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ReferralEarning'
      AND column_name = 'stripeSubscriptionId'
  ) THEN
    ALTER TABLE "ReferralEarning"
      RENAME COLUMN "stripeSubscriptionId" TO "billingReference";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'PartnerAttribution'
      AND column_name = 'stripeSubscriptionId'
  ) THEN
    ALTER TABLE "PartnerAttribution"
      RENAME COLUMN "stripeSubscriptionId" TO "billingReference";
  END IF;
END $$;
