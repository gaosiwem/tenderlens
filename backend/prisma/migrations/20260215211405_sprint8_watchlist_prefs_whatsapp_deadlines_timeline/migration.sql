-- CreateEnum
CREATE TYPE "TenderChangeType" AS ENUM ('FILE_HASH_CHANGED', 'CHUNKS_CHANGED', 'DEADLINE_CHANGED', 'SUMMARY_CHANGED');

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotificationPrefs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappNumber" TEXT,
    "eventTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quietStart" TEXT,
    "quietEnd" TEXT,
    "digestMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPrefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderDeadline" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "closingAt" TIMESTAMP(3),
    "briefingAt" TIMESTAMP(3),
    "siteVisitAt" TIMESTAMP(3),
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "citations" JSONB,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderChangeLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "type" "TenderChangeType" NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WatchlistItem_orgId_idx" ON "WatchlistItem"("orgId");

-- CreateIndex
CREATE INDEX "WatchlistItem_userId_idx" ON "WatchlistItem"("userId");

-- CreateIndex
CREATE INDEX "WatchlistItem_tenderId_idx" ON "WatchlistItem"("tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_tenderId_key" ON "WatchlistItem"("userId", "tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationPrefs_userId_key" ON "UserNotificationPrefs"("userId");

-- CreateIndex
CREATE INDEX "UserNotificationPrefs_orgId_idx" ON "UserNotificationPrefs"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "TenderDeadline_tenderId_key" ON "TenderDeadline"("tenderId");

-- CreateIndex
CREATE INDEX "TenderDeadline_orgId_idx" ON "TenderDeadline"("orgId");

-- CreateIndex
CREATE INDEX "TenderChangeLog_orgId_idx" ON "TenderChangeLog"("orgId");

-- CreateIndex
CREATE INDEX "TenderChangeLog_tenderId_idx" ON "TenderChangeLog"("tenderId");

-- CreateIndex
CREATE INDEX "TenderChangeLog_createdAt_idx" ON "TenderChangeLog"("createdAt");

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotificationPrefs" ADD CONSTRAINT "UserNotificationPrefs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotificationPrefs" ADD CONSTRAINT "UserNotificationPrefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderDeadline" ADD CONSTRAINT "TenderDeadline_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderDeadline" ADD CONSTRAINT "TenderDeadline_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderChangeLog" ADD CONSTRAINT "TenderChangeLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderChangeLog" ADD CONSTRAINT "TenderChangeLog_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
