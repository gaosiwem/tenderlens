-- CreateTable
CREATE TABLE "TenderScrapedData" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "source" TEXT,
    "externalId" INTEGER,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "tenderNumber" TEXT,
    "description" TEXT,
    "category" TEXT,
    "companyName" TEXT,
    "province" TEXT,
    "status" TEXT,
    "publishedDate" TEXT,
    "closingDate" TEXT,
    "documents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderScrapedData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenderScrapedData_tenderId_key" ON "TenderScrapedData"("tenderId");

-- CreateIndex
CREATE INDEX "TenderScrapedData_orgId_idx" ON "TenderScrapedData"("orgId");

-- CreateIndex
CREATE INDEX "TenderScrapedData_externalId_idx" ON "TenderScrapedData"("externalId");

-- AddForeignKey
ALTER TABLE "TenderScrapedData" ADD CONSTRAINT "TenderScrapedData_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderScrapedData" ADD CONSTRAINT "TenderScrapedData_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
