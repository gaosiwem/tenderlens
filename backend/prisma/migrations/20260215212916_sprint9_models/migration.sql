-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('CLOSING_7D', 'CLOSING_24H', 'CLOSING_2H');

-- CreateTable
CREATE TABLE "WhatsAppVerification" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderReminder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "tenderId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "fireAt" TIMESTAMP(3) NOT NULL,
    "firedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderComparison" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "tenderAId" TEXT NOT NULL,
    "tenderBId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidChecklist" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "tenderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppVerification_orgId_idx" ON "WhatsAppVerification"("orgId");

-- CreateIndex
CREATE INDEX "WhatsAppVerification_userId_idx" ON "WhatsAppVerification"("userId");

-- CreateIndex
CREATE INDEX "WhatsAppVerification_expiresAt_idx" ON "WhatsAppVerification"("expiresAt");

-- CreateIndex
CREATE INDEX "TenderReminder_orgId_idx" ON "TenderReminder"("orgId");

-- CreateIndex
CREATE INDEX "TenderReminder_tenderId_idx" ON "TenderReminder"("tenderId");

-- CreateIndex
CREATE INDEX "TenderReminder_fireAt_idx" ON "TenderReminder"("fireAt");

-- CreateIndex
CREATE INDEX "TenderReminder_firedAt_idx" ON "TenderReminder"("firedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenderReminder_tenderId_type_fireAt_key" ON "TenderReminder"("tenderId", "type", "fireAt");

-- CreateIndex
CREATE INDEX "TenderComparison_orgId_idx" ON "TenderComparison"("orgId");

-- CreateIndex
CREATE INDEX "TenderComparison_tenderAId_idx" ON "TenderComparison"("tenderAId");

-- CreateIndex
CREATE INDEX "TenderComparison_tenderBId_idx" ON "TenderComparison"("tenderBId");

-- CreateIndex
CREATE UNIQUE INDEX "BidChecklist_tenderId_key" ON "BidChecklist"("tenderId");

-- CreateIndex
CREATE INDEX "BidChecklist_orgId_idx" ON "BidChecklist"("orgId");

-- CreateIndex
CREATE INDEX "BidChecklist_tenderId_idx" ON "BidChecklist"("tenderId");
