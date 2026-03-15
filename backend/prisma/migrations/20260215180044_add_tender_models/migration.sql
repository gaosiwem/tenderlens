-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('EXTRACT_TEXT');

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT,
    "status" "TenderStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderFile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "tenderFileId" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderExtract" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "tenderFileId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "pageCount" INTEGER,
    "language" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderExtract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tender_orgId_idx" ON "Tender"("orgId");

-- CreateIndex
CREATE INDEX "Tender_createdAt_idx" ON "Tender"("createdAt");

-- CreateIndex
CREATE INDEX "TenderFile_orgId_idx" ON "TenderFile"("orgId");

-- CreateIndex
CREATE INDEX "TenderFile_tenderId_idx" ON "TenderFile"("tenderId");

-- CreateIndex
CREATE INDEX "TenderFile_createdAt_idx" ON "TenderFile"("createdAt");

-- CreateIndex
CREATE INDEX "ProcessingJob_orgId_idx" ON "ProcessingJob"("orgId");

-- CreateIndex
CREATE INDEX "ProcessingJob_tenderId_idx" ON "ProcessingJob"("tenderId");

-- CreateIndex
CREATE INDEX "ProcessingJob_tenderFileId_idx" ON "ProcessingJob"("tenderFileId");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_idx" ON "ProcessingJob"("status");

-- CreateIndex
CREATE INDEX "ProcessingJob_createdAt_idx" ON "ProcessingJob"("createdAt");

-- CreateIndex
CREATE INDEX "TenderExtract_orgId_idx" ON "TenderExtract"("orgId");

-- CreateIndex
CREATE INDEX "TenderExtract_tenderId_idx" ON "TenderExtract"("tenderId");

-- CreateIndex
CREATE INDEX "TenderExtract_tenderFileId_idx" ON "TenderExtract"("tenderFileId");

-- CreateIndex
CREATE INDEX "TenderExtract_createdAt_idx" ON "TenderExtract"("createdAt");

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderFile" ADD CONSTRAINT "TenderFile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderFile" ADD CONSTRAINT "TenderFile_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_tenderFileId_fkey" FOREIGN KEY ("tenderFileId") REFERENCES "TenderFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderExtract" ADD CONSTRAINT "TenderExtract_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderExtract" ADD CONSTRAINT "TenderExtract_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderExtract" ADD CONSTRAINT "TenderExtract_tenderFileId_fkey" FOREIGN KEY ("tenderFileId") REFERENCES "TenderFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
