export type TenderSummaryCoverageFile = {
  tenderFileId: string;
  fileName: string;
  extractCreatedAt: string;
  availableChars: number;
  usedChars: number;
  truncated: boolean;
};

export type TenderSummaryCoverage = {
  fileCountTotal: number;
  fileCountIncluded: number;
  truncatedFileCount: number;
  totalCharsAvailable: number;
  totalCharsUsed: number;
  latestExtractCreatedAt: string | null;
  files: TenderSummaryCoverageFile[];
};

export type TenderSummaryMeta = {
  coverage?: TenderSummaryCoverage;
  latestExtractCreatedAt?: string | null;
  summaryCreatedAt?: string;
  isStale?: boolean;
} & Record<string, unknown>;

export type TenderSummary = {
  id: string;
  orgId: string;
  tenderId: string;
  content: string;
  meta: TenderSummaryMeta | null;
  createdAt: string;
  updatedAt: string;
};
