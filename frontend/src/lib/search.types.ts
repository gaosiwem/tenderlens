export type SearchHit = {
  id: string;
  tenderId: string;
  tenderFileId: string;
  index: number;
  content: string;
  score: number;
};

export type SearchResponse = {
  items: SearchHit[];
  note?: string;
};

export type TenderInsightRecord = {
  id: string;
  orgId: string;
  tenderId: string;
  tenderFileId: string;
  kind: string;
  data: any;
  createdAt: string;
};

export type TenderInsightsResponse = {
  items: TenderInsightRecord[];
};

export type TenderChunksResponse = {
  items: Array<{
    id: string;
    tenderId: string;
    tenderFileId: string;
    index: number;
    content: string;
    createdAt: string;
  }>;
};
