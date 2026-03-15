export type WorkspaceStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "WON"
  | "LOST"
  | "ABANDONED";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type BidWorkspace = {
  id: string;
  orgId: string;
  tenderId: string;
  createdBy: string;
  status: WorkspaceStatus;
  decision: string | null;
  notes: string | null;
  riskScore: number;
  riskMeta: unknown | null;
  createdAt: string;
  updatedAt: string;
  // relations often returned
  tasks?: BidTask[];
  activities?: BidActivity[];
  attachments?: BidAttachment[];
};

export type BidTask = {
  id: string;
  orgId: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  tags: string[];
  ownerId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // added in sprint 11
  owner?: { id: string; name: string | null; email: string | null };
  comments?: BidTaskComment[];
};

export type BidTaskComment = {
  id: string;
  orgId: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  // added in sprint 11
  user?: { id: string; name: string | null; email: string | null };
};

export type BidAttachment = {
  id: string;
  orgId: string;
  workspaceId: string;
  taskId: string | null;
  targetType: "WORKSPACE" | "TASK";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
  uploadedBy: string;
  createdAt: string;
};

export type BidActivity = {
  id: string;
  orgId: string;
  workspaceId: string;
  userId: string;
  type: string;
  meta: unknown | null;
  createdAt: string;
  user?: { id: string; name: string | null; email: string | null };
};
