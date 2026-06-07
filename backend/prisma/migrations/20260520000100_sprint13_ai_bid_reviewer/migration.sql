CREATE TYPE "BidReviewStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TYPE "BidReviewFindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "BidReviewFindingCategory" AS ENUM (
  'UNANSWERED_REQUIREMENT',
  'WEAK_RESPONSE',
  'MISSING_EVIDENCE',
  'POOR_STRUCTURE',
  'COMPLIANCE_GAP',
  'UNCLEAR_PRICING',
  'EVALUATOR_RED_FLAG'
);

CREATE TABLE "BidReview" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "tenderId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "status" "BidReviewStatus" NOT NULL DEFAULT 'PENDING',
  "score" INTEGER,
  "summary" TEXT,
  "strengths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "weaknesses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "redFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "proposalFileIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "model" TEXT,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BidReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BidReviewFinding" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "category" "BidReviewFindingCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "severity" "BidReviewFindingSeverity" NOT NULL,
  "affectedSection" TEXT,
  "requirement" TEXT,
  "proposalExcerpt" TEXT,
  "evidence" JSONB,
  "recommendation" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BidReviewFinding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BidReview_orgId_idx" ON "BidReview"("orgId");
CREATE INDEX "BidReview_tenderId_idx" ON "BidReview"("tenderId");
CREATE INDEX "BidReview_workspaceId_idx" ON "BidReview"("workspaceId");
CREATE INDEX "BidReview_status_idx" ON "BidReview"("status");
CREATE INDEX "BidReview_createdAt_idx" ON "BidReview"("createdAt");

CREATE INDEX "BidReviewFinding_orgId_idx" ON "BidReviewFinding"("orgId");
CREATE INDEX "BidReviewFinding_reviewId_idx" ON "BidReviewFinding"("reviewId");
CREATE INDEX "BidReviewFinding_category_idx" ON "BidReviewFinding"("category");
CREATE INDEX "BidReviewFinding_severity_idx" ON "BidReviewFinding"("severity");

ALTER TABLE "BidReview"
  ADD CONSTRAINT "BidReview_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BidReview"
  ADD CONSTRAINT "BidReview_tenderId_fkey"
  FOREIGN KEY ("tenderId") REFERENCES "Tender"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BidReview"
  ADD CONSTRAINT "BidReview_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "BidWorkspace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BidReview"
  ADD CONSTRAINT "BidReview_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BidReviewFinding"
  ADD CONSTRAINT "BidReviewFinding_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BidReviewFinding"
  ADD CONSTRAINT "BidReviewFinding_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "BidReview"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
