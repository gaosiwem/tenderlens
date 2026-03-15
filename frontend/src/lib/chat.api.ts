import { apiFetch } from "@/lib/api";
import type {
  Conversation,
  ListConversationsResponse,
  GetConversationResponse,
  PostMessageResponse,
  ConversationContextProgress,
} from "./chat.types";

export async function listConversations() {
  return apiFetch<ListConversationsResponse>("/api/v1/chat/conversations", {
    method: "GET",
  });
}

export async function createConversation(payload: {
  title?: string;
  tenderId?: string;
}) {
  return apiFetch<Conversation>("/api/v1/chat/conversations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getConversation(conversationId: string) {
  return apiFetch<GetConversationResponse>(
    `/api/v1/chat/conversations/${conversationId}`,
    { method: "GET" },
  );
}

export async function postMessage(conversationId: string, question: string) {
  return apiFetch<PostMessageResponse>(
    `/api/v1/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ question }),
    },
  );
}

export async function getConversationContextProgress(conversationId: string) {
  const ts = Date.now();
  return apiFetch<ConversationContextProgress>(
    `/api/v1/chat/conversations/${conversationId}/context-progress?_ts=${ts}`,
    { method: "GET", cache: "no-store" },
  );
}
