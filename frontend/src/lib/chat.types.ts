export type Conversation = {
  id: string;
  orgId: string;
  createdBy: string;
  title: string | null;
  tenderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  orgId: string;
  conversationId: string;
  role: "user" | "assistant" | string;
  content: string;
  citations: any | null;
  tokenInput?: number;
  tokenOutput?: number;
  createdAt: string;
};

export type Citation = {
  chunkId: string;
  tenderId: string;
  tenderFileId: string;
  index: number;
  score: number;
};

export type ListConversationsResponse = { items: Conversation[] };
export type GetConversationResponse = {
  conversation: Conversation;
  messages: Message[];
};

export type PostMessageResponse = {
  user: Message;
  assistant: Message;
  citations: Citation[];
};

export type ConversationContextProgress = {
  conversationId: string;
  tenderId: string | null;
  phase: "idle" | "no_documents" | "preparing" | "indexing" | "ready";
  progressPercent: number;
  message: string;
  stats: {
    userMessages: number;
    totalFiles: number;
    extractedFiles: number;
    chunkedFiles: number;
    activeJobs: number;
    externalDocsTotal: number;
    externalDocsImported: number;
    externalDocsPending: number;
  };
};
