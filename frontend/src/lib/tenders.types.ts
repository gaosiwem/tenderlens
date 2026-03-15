export enum TenderStatus {
  DRAFT = "DRAFT",
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum JobStatus {
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum JobType {
  EXTRACT_TEXT = "EXTRACT_TEXT",
}

export type Tender = {
  id: string;
  orgId: string;
  title: string;
  source: string | null;
  status: TenderStatus;
  amount?: string | null;
  tenderAmount?: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type TenderListItem = Tender & {
  closingDate: string | null;
  companyName: string | null;
  amount?: string | null;
  tenderAmount?: string | null;
  lifecycle?: TenderLifecycle;
};

export type TenderFile = {
  id: string;
  orgId: string;
  tenderId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type ExternalTenderDocument = {
  id: string;
  name: string;
  path: string;
};

export type ScrapedTenderData = {
  source: string | null;
  externalId: number | null;
  available: boolean;
  tenderNumber: string | null;
  description: string | null;
  category: string | null;
  companyName: string | null;
  province: string | null;
  status: string | null;
  publishedDate: string | null;
  closingDate: string | null;
  amount?: string | null;
  tenderAmount?: string | null;
};

export type TenderLifecycle = "open" | "awarded" | "closed" | "cancelled";

export type TenderLifecycleDateSource =
  | "closing_date"
  | "cancelled_date"
  | "import_detected_at"
  | "unknown";

export type OutcomeInsightAction = {
  kind:
    | "watch_tender"
    | "track_reissue"
    | "review_timeline"
    | "open_compare"
    | "open_workspace";
  label: string;
  href: string;
  description: string;
};

export type OutcomeInsightRelatedTender = {
  id: string;
  title: string;
  companyName: string | null;
  closingDate: string | null;
  amount: string | null;
  lifecycle: TenderLifecycle;
  reason: string;
};

export type TenderOutcomeInsights = {
  tenderId: string;
  generationMode: "rules";
  lifecycle: TenderLifecycle;
  lifecycleDetectedAt: string | null;
  lifecycleDate: string | null;
  lifecycleDateSource: TenderLifecycleDateSource;
  lifecycleDateLabel: string;
  statusLabel: string;
  summary: string;
  staleDays: number | null;
  watched: boolean;
  recommendedActions: OutcomeInsightAction[];
  similarTenders: OutcomeInsightRelatedTender[];
  reissueCandidates: OutcomeInsightRelatedTender[];
  stats: {
    buyerTenderCount: number;
    buyerAwardedCount: number;
    buyerCancelledCount: number;
    categoryTenderCount: number;
  };
};

export type ProcessingJob = {
  id: string;
  orgId: string;
  tenderId: string;
  tenderFileId: string;
  type: JobType;
  status: JobStatus;
  attempts: number;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type TenderExtract = {
  id: string;
  orgId: string;
  tenderId: string;
  tenderFileId: string;
  text: string;
  pageCount: number | null;
  language: string | null;
  meta: unknown;
  createdAt: string;
};

export type CreateTenderInput = {
  title: string;
  source?: string;
};
