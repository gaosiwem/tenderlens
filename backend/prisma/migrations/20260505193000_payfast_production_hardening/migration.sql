-- PayFast production hardening: persist checkout intent, ITN audit trail, and
-- gateway references used for recurring subscription reconciliation.

ALTER TABLE "OrgSubscription"
  ADD COLUMN "paymentGateway" TEXT,
  ADD COLUMN "billingReference" TEXT,
  ADD COLUMN "payfastToken" TEXT,
  ADD COLUMN "lastPaymentAt" TIMESTAMP(3);

CREATE TABLE "PayFastCheckout" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT,
  "reference" TEXT NOT NULL,
  "plan" "PlanType" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "mode" TEXT NOT NULL,
  "paymentUrl" TEXT,
  "payfastPaymentId" TEXT,
  "payfastToken" TEXT,
  "rawPayload" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayFastCheckout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayFastNotification" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "reference" TEXT,
  "payfastPaymentId" TEXT,
  "paymentStatus" TEXT,
  "validationStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
  "rawPayload" JSONB NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "PayFastNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayFastCheckout_reference_key" ON "PayFastCheckout"("reference");
CREATE UNIQUE INDEX "PayFastCheckout_payfastPaymentId_key" ON "PayFastCheckout"("payfastPaymentId");
CREATE INDEX "PayFastCheckout_orgId_idx" ON "PayFastCheckout"("orgId");
CREATE INDEX "PayFastCheckout_userId_idx" ON "PayFastCheckout"("userId");
CREATE INDEX "PayFastCheckout_status_idx" ON "PayFastCheckout"("status");
CREATE INDEX "PayFastCheckout_createdAt_idx" ON "PayFastCheckout"("createdAt");

CREATE INDEX "PayFastNotification_orgId_idx" ON "PayFastNotification"("orgId");
CREATE INDEX "PayFastNotification_reference_idx" ON "PayFastNotification"("reference");
CREATE INDEX "PayFastNotification_payfastPaymentId_idx" ON "PayFastNotification"("payfastPaymentId");
CREATE INDEX "PayFastNotification_validationStatus_idx" ON "PayFastNotification"("validationStatus");
CREATE INDEX "PayFastNotification_createdAt_idx" ON "PayFastNotification"("createdAt");

ALTER TABLE "PayFastCheckout"
  ADD CONSTRAINT "PayFastCheckout_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayFastNotification"
  ADD CONSTRAINT "PayFastNotification_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
