export type StreamMetaEvent = {
  conversationId: string;
  userMessageId: string;
  estimatedCost: number;
  chunks: Array<{ id: string; score: number }>;
};

export type StreamTokenEvent = { t: string };

export type StreamDoneEvent = {
  assistantMessageId: string;
  citations: any[];
  estimatedCost: number;
};
