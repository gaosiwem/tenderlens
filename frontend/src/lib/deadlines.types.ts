export type TenderDeadlines = {
  id: string;
  orgId: string;
  tenderId: string;
  closingAt: string | null;
  briefingAt: string | null;
  siteVisitAt: string | null;
  contactName?: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  confidence: number;
  citations: unknown | null;
  extractedAt: string;
  updatedAt: string;
};
