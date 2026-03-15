-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

-- CreateTable
CREATE TABLE "ReferralEarning" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "referralCodeId" TEXT,
    "attributedOrgId" TEXT,
    "stripeSubscriptionId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "ReferralEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralPayout" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "ReferralPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgSegmentSnapshot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgSegmentSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingChecklistItem" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingChecklistProgress" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OnboardingChecklistProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferralEarning_orgId_idx" ON "ReferralEarning"("orgId");

-- CreateIndex
CREATE INDEX "ReferralEarning_userId_idx" ON "ReferralEarning"("userId");

-- CreateIndex
CREATE INDEX "ReferralEarning_status_idx" ON "ReferralEarning"("status");

-- CreateIndex
CREATE INDEX "ReferralEarning_createdAt_idx" ON "ReferralEarning"("createdAt");

-- CreateIndex
CREATE INDEX "ReferralPayout_orgId_idx" ON "ReferralPayout"("orgId");

-- CreateIndex
CREATE INDEX "ReferralPayout_userId_idx" ON "ReferralPayout"("userId");

-- CreateIndex
CREATE INDEX "ReferralPayout_status_idx" ON "ReferralPayout"("status");

-- CreateIndex
CREATE INDEX "OrgSegmentSnapshot_segment_idx" ON "OrgSegmentSnapshot"("segment");

-- CreateIndex
CREATE INDEX "OrgSegmentSnapshot_day_idx" ON "OrgSegmentSnapshot"("day");

-- CreateIndex
CREATE UNIQUE INDEX "OrgSegmentSnapshot_orgId_day_key" ON "OrgSegmentSnapshot"("orgId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingChecklistItem_key_key" ON "OnboardingChecklistItem"("key");

-- CreateIndex
CREATE INDEX "OnboardingChecklistItem_order_idx" ON "OnboardingChecklistItem"("order");

-- CreateIndex
CREATE INDEX "OnboardingChecklistProgress_orgId_idx" ON "OnboardingChecklistProgress"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingChecklistProgress_orgId_itemKey_key" ON "OnboardingChecklistProgress"("orgId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentConfig_key_key" ON "ExperimentConfig"("key");
