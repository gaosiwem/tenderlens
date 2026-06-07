export type BidReviewStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type BidReviewFindingSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type BidReviewFindingCategory =
  | "UNANSWERED_REQUIREMENT"
  | "WEAK_RESPONSE"
  | "MISSING_EVIDENCE"
  | "POOR_STRUCTURE"
  | "COMPLIANCE_GAP"
  | "UNCLEAR_PRICING"
  | "EVALUATOR_RED_FLAG";

export type BidReviewEvidence = {
  source: "tender" | "proposal" | "compliance_audit";
  fileId?: string;
  filename?: string;
  page?: number;
  chunkId?: string;
  quote?: string;
};

export type BidReviewFinding = {
  id: string;
  category: BidReviewFindingCategory;
  title: string;
  severity: BidReviewFindingSeverity;
  affectedSection: string | null;
  requirement: string | null;
  proposalExcerpt: string | null;
  evidence: BidReviewEvidence[];
  recommendation: string | null;
};

export type BidReview = {
  id: string;
  tenderId: string;
  workspaceId: string | null;
  status: BidReviewStatus;
  score: number | null;
  summary: string | null;
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];
  proposalFileIds: string[];
  findings: BidReviewFinding[];
  createdAt: string;
  completedAt: string | null;
};
