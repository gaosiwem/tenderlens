CREATE TYPE "ComplianceAuditStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TYPE "ComplianceFindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE "ComplianceAudit" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "tenderId" TEXT NOT NULL,
  "status" "ComplianceAuditStatus" NOT NULL DEFAULT 'PENDING',
  "score" INTEGER,
  "summary" TEXT,
  "missing" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "risks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "model" TEXT,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceFinding" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "severity" "ComplianceFindingSeverity" NOT NULL,
  "status" TEXT NOT NULL,
  "requirement" TEXT,
  "evidence" JSONB,
  "suggestion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceFinding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ComplianceAudit_orgId_idx" ON "ComplianceAudit"("orgId");
CREATE INDEX "ComplianceAudit_tenderId_idx" ON "ComplianceAudit"("tenderId");
CREATE INDEX "ComplianceAudit_status_idx" ON "ComplianceAudit"("status");
CREATE INDEX "ComplianceAudit_createdAt_idx" ON "ComplianceAudit"("createdAt");

CREATE INDEX "ComplianceFinding_orgId_idx" ON "ComplianceFinding"("orgId");
CREATE INDEX "ComplianceFinding_auditId_idx" ON "ComplianceFinding"("auditId");
CREATE INDEX "ComplianceFinding_category_idx" ON "ComplianceFinding"("category");
CREATE INDEX "ComplianceFinding_severity_idx" ON "ComplianceFinding"("severity");

ALTER TABLE "ComplianceAudit"
  ADD CONSTRAINT "ComplianceAudit_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplianceAudit"
  ADD CONSTRAINT "ComplianceAudit_tenderId_fkey"
  FOREIGN KEY ("tenderId") REFERENCES "Tender"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplianceAudit"
  ADD CONSTRAINT "ComplianceAudit_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ComplianceFinding"
  ADD CONSTRAINT "ComplianceFinding_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplianceFinding"
  ADD CONSTRAINT "ComplianceFinding_auditId_fkey"
  FOREIGN KEY ("auditId") REFERENCES "ComplianceAudit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
