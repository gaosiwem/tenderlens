export type TenderEnquiryContact = {
  role: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

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
  enquiryContacts?: TenderEnquiryContact[];
  confidence: number;
  citations: unknown | null;
  extractedAt: string;
  updatedAt: string;
};
