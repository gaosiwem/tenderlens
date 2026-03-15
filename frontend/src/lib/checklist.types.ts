export type ChecklistItem = {
  task: string;
  category: string;
  mandatory: boolean;
  checked?: boolean;
  notes?: string;
};

export type BidChecklistDoc = {
  id: string;
  orgId: string;
  tenderId: string;
  title: string;
  checklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
};
