"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { createConversation } from "@/lib/chat.api";
import { useAuth } from "@/lib/auth";

export default function NewChatPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const tenderId = String(sp.get("tenderId") ?? "").trim();
  const { me } = useAuth();
  const activeOrgId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("tl_active_org_id")
      : null;
  const userRole =
    me?.orgs.find((o) => o.org.id === activeOrgId)?.role ?? "VIEWER";
  const canWriteChat = userRole !== "VIEWER";

  const [title, setTitle] = React.useState(
    tenderId ? "Tender Chat" : "Organization Chat",
  );
  const [loading, setLoading] = React.useState(false);

  async function create() {
    if (!canWriteChat) {
      toast.error("Insufficient permission", {
        description:
          "You have read-only chat access. Ask a MEMBER, ADMIN, or OWNER to create conversations.",
      });
      return;
    }

    setLoading(true);
    const res = await createConversation({
      title: title.trim() || "Chat",
      tenderId: tenderId || undefined,
    });
    setLoading(false);

    if (!res.ok) {
      toast.error("Failed to create chat", { description: res.error.message });
      return;
    }

    router.push(`/chat/${res.data.id}`);
  }

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Chat">
      <TLSection
        title="New conversation"
        description={
          tenderId
            ? "This chat will be scoped to a specific tender."
            : "This chat will search across all tenders in the organization."
        }
        right={
          <Link href="/chat">
            <TLButton variant="secondary">Back</TLButton>
          </Link>
        }
      >
        <div className="tl-surface p-5 space-y-3">
          {!canWriteChat ? (
            <TLInlineAlert
              title="Read-only chat access"
              description="You can view existing conversations, but only MEMBER, ADMIN, or OWNER can create new chats."
              tone="neutral"
            />
          ) : null}

          <div className="text-xs font-semibold tracking-wide text-muted-foreground ">
            Title
          </div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11"
            placeholder="Example: Tender closing date and submission checklist"
            disabled={!canWriteChat}
          />
          {tenderId ? (
            <TLInlineAlert
              title="Tender scope"
              description={`Tender id: ${tenderId}`}
              tone="neutral"
            />
          ) : (
            <TLInlineAlert
              title="Org scope"
              description="Consider scoping to a tender if you want strict accuracy."
              tone="neutral"
            />
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <TLButton onClick={create} disabled={loading || !canWriteChat}>
              {loading ? "Creating..." : "Create conversation"}
            </TLButton>
            <Link href="/chat">
              <TLButton variant="secondary">Cancel</TLButton>
            </Link>
          </div>
        </div>
      </TLSection>
    </TenderLensAppShell>
  );
}
