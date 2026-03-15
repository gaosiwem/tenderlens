export type OrgBusinessDocFile = {
  id: string;
  tenderId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  status: "queued" | "processing" | "ready" | "failed" | "unknown";
  statusMessage: string | null;
};

export type OrgBusinessDocsResponse = {
  profileTenderId: string | null;
  ready: boolean;
  processing: boolean;
  items: OrgBusinessDocFile[];
};

export type OrgBusinessDocUploadResponse = {
  profileTenderId: string;
  tenderFileId: string;
  processingJobId: string;
};
