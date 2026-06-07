export type ComplianceAuditStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type ComplianceFindingSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type ComplianceFindingStatus =
  | "missing"
  | "met"
  | "risk"
  | "unknown";

export type ComplianceFindingCategory =
  | "mandatory_documents"
  | "cidb"
  | "bbbee"
  | "briefing_session"
  | "tax_csd"
  | "returnables"
  | "submission_risk";

export type ComplianceEvidence = {
  fileId?: string;
  filename?: string;
  page?: number;
  chunkId?: string;
  quote?: string;
};

export type ComplianceFinding = {
  id: string;
  category: ComplianceFindingCategory;
  title: string;
  severity: ComplianceFindingSeverity;
  status: ComplianceFindingStatus;
  requirement: string | null;
  evidence: ComplianceEvidence[];
  suggestion: string | null;
};

export type ComplianceAudit = {
  id: string;
  tenderId: string;
  status: ComplianceAuditStatus;
  score: number | null;
  summary: string | null;
  error: string | null;
  missing: string[];
  risks: string[];
  findings: ComplianceFinding[];
  createdAt: string;
  completedAt: string | null;
};
