-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "TenderChunk" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "tenderFileId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "embedding" vector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderInsight" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "tenderFileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenderChunk_orgId_idx" ON "TenderChunk"("orgId");

-- CreateIndex
CREATE INDEX "TenderChunk_tenderId_idx" ON "TenderChunk"("tenderId");

-- CreateIndex
CREATE INDEX "TenderChunk_tenderFileId_idx" ON "TenderChunk"("tenderFileId");

-- CreateIndex
CREATE INDEX "TenderChunk_createdAt_idx" ON "TenderChunk"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenderChunk_tenderFileId_index_key" ON "TenderChunk"("tenderFileId", "index");

-- CreateIndex
CREATE INDEX "TenderInsight_orgId_idx" ON "TenderInsight"("orgId");

-- CreateIndex
CREATE INDEX "TenderInsight_tenderId_idx" ON "TenderInsight"("tenderId");

-- CreateIndex
CREATE INDEX "TenderInsight_tenderFileId_idx" ON "TenderInsight"("tenderFileId");

-- CreateIndex
CREATE INDEX "TenderInsight_kind_idx" ON "TenderInsight"("kind");

-- CreateIndex
CREATE INDEX "TenderInsight_createdAt_idx" ON "TenderInsight"("createdAt");

-- AddForeignKey
ALTER TABLE "TenderChunk" ADD CONSTRAINT "TenderChunk_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderChunk" ADD CONSTRAINT "TenderChunk_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderChunk" ADD CONSTRAINT "TenderChunk_tenderFileId_fkey" FOREIGN KEY ("tenderFileId") REFERENCES "TenderFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderInsight" ADD CONSTRAINT "TenderInsight_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderInsight" ADD CONSTRAINT "TenderInsight_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderInsight" ADD CONSTRAINT "TenderInsight_tenderFileId_fkey" FOREIGN KEY ("tenderFileId") REFERENCES "TenderFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
