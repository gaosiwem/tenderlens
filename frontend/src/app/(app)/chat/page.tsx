"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { TenderLensEmptyStateCard } from "@/components/tenderlens/empty-state";
import { TLConversationCard } from "@/components/tenderlens/conversation-card";
import { TLChatSkeleton } from "@/components/tenderlens/chat-skeleton";
import { listConversations } from "@/lib/chat.api";
import type { Conversation } from "@/lib/chat.types";
import { useAuth } from "@/lib/auth";

export default function ChatHomePage() {
  const { me } = useAuth();
  const activeOrgId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("tl_active_org_id")
      : null;
  const userRole =
    me?.orgs.find((o) => o.org.id === activeOrgId)?.role ?? "VIEWER";
  const canWriteChat = userRole !== "VIEWER";

  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<Conversation[]>([]);

  async function load() {
    setLoading(true);
    const res = await listConversations();
    setLoading(false);

    if (!res.ok) {
      toast.error("Failed to load conversations", {
        description: res.error.message,
      });
      setItems([]);
      return;
    }
    setItems(res.data.items);
  }

  React.useEffect(() => {
    load();
  }, []);

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Chat">
      <TLSection
        title="Ask the Tender"
        description="Ask questions about deadlines, requirements, compliance hints, and submission steps."
        right={
          <div className="flex items-center gap-2">
            {canWriteChat ? (
              <Link href="/chat/new">
                <TLButton>New chat</TLButton>
              </Link>
            ) : (
              <TLButton disabled>New chat</TLButton>
            )}
            <TLButton variant="secondary" onClick={load} disabled={loading}>
              Refresh
            </TLButton>
          </div>
        }
      >
        {!canWriteChat ? (
          <TLInlineAlert
            title="Read-only chat access"
            description="You can view existing conversations. Creating new chats requires MEMBER, ADMIN, or OWNER role."
            tone="neutral"
          />
        ) : null}

        {loading ? <TLChatSkeleton /> : null}

        {!loading && items.length === 0 ? (
          <TenderLensEmptyStateCard
            title="No conversations yet"
            description="Create a new chat to ask questions across all tenders, or scope to a specific tender for accuracy."
            action={
              canWriteChat ? (
                <Link href="/chat/new">
                  <TLButton>Create chat</TLButton>
                </Link>
              ) : (
                <TLButton disabled>Create chat</TLButton>
              )
            }
          />
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="grid gap-4">
            {items.map((c) => (
              <TLConversationCard key={c.id} c={c} />
            ))}
          </div>
        ) : null}

        {!loading && (
          <TLInlineAlert
            title="Tip"
            description="For best results, create a chat scoped to a tender. That prevents mixing across documents."
            tone="neutral"
          />
        )}
      </TLSection>
    </TenderLensAppShell>
  );
}
