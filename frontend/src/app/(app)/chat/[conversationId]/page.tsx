"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLChatMessage } from "@/components/tenderlens/chat-message";
import { TLChatComposer } from "@/components/tenderlens/chat-composer";
import { TLSpendGuardBanner } from "@/components/tenderlens/spend-guard-banner";
import { TLChatSkeleton } from "@/components/tenderlens/chat-skeleton";
import { TLTypingBubble } from "@/components/tenderlens/typing-bubble";
import { getConversation } from "@/lib/chat.api";
import { streamChatMessage } from "@/lib/sse";
import { exportConversationPdf } from "@/lib/export.api";
import type { Message, GetConversationResponse } from "@/lib/chat.types";
import { useAuth } from "@/lib/auth";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";

export default function ConversationPage() {
  const params = useParams();
  const conversationId = String(params.conversationId);
  const { me } = useAuth();
  const activeOrgId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("tl_active_org_id")
      : null;
  const userRole =
    me?.orgs.find((o) => o.org.id === activeOrgId)?.role ?? "VIEWER";
  const canWriteChat = userRole !== "VIEWER";

  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [data, setData] = React.useState<GetConversationResponse | null>(null);

  const [q, setQ] = React.useState("");
  const [guard, setGuard] = React.useState<{
    kind: "policy" | "disabled";
    message: string;
  } | null>(null);

  const [streamingText, setStreamingText] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const streamRef = React.useRef<{ cancel: () => void } | null>(null);

  async function handleExportPdf() {
    setExporting(true);
    const res = await exportConversationPdf(conversationId);
    setExporting(false);

    if (!res.ok) {
      toast.error("Export failed", { description: res.error });
      return;
    }

    const a = document.createElement("a");
    a.href = res.url;
    a.download = `tenderlens-conversation-${conversationId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(res.url), 1000);
    toast.success("Downloaded PDF");
  }

  const load = React.useCallback(async () => {
    setLoading(true);
    setGuard(null);

    const c = await getConversation(conversationId);
    setLoading(false);

    if (!c.ok) {
      toast.error("Failed to load conversation", {
        description: c.error.message,
      });
      setData(null);
      return;
    }

    setData(c.data);
  }, [conversationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    const text = q.trim();
    if (!text || sending || streaming) return;
    if (!canWriteChat) {
      toast.error("Insufficient permission", {
        description:
          "You have read-only chat access. Ask a MEMBER, ADMIN, or OWNER to send messages.",
      });
      return;
    }

    setSending(true);
    setStreaming(true);
    setStreamingText("");
    setGuard(null);
    setQ("");

    const cancelable = streamChatMessage({
      conversationId,
      question: text,
      handlers: {
        onMeta: (m) => {
          // Meta received
        },
        onToken: (t) => {
          setStreamingText((prev) => prev + (t?.t ?? ""));
        },
        onDone: async (d) => {
          setSending(false);
          setStreaming(false);
          toast.success("Answer ready");
          await load();
        },
        onError: (message) => {
          setSending(false);
          setStreaming(false);

          const m = String(message || "");
          toast.error("Stream failed", { description: m });
        },
      },
    });

    streamRef.current = cancelable;
  }

  const title = data?.conversation.title || "Conversation";
  const tenderId = data?.conversation.tenderId;

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Chat">
      <TLSection>
        <div className="space-y-3">
          <div>
            <h2 className="font-display text-sm font-extrabold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tenderId ? "Tender-scoped chat" : "Organization-wide chat"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {streaming && (
              <TLButton
                variant="outline"
                size="sm"
                onClick={() => streamRef.current?.cancel()}
              >
                Cancel
              </TLButton>
            )}
            <TLButton
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={exporting || loading || !data?.messages.length}
              iconLeft={<Download className="h-4 w-4" />}
            >
              {exporting ? "Exporting..." : "Export PDF"}
            </TLButton>
            {tenderId ? (
              <Link href={`/tenders/${tenderId}`}>
                <TLButton variant="outline" size="sm">
                  Open tender
                </TLButton>
              </Link>
            ) : null}
            <TLButton
              variant="secondary"
              size="sm"
              onClick={load}
              disabled={loading}
            >
              Refresh
            </TLButton>
          </div>
        </div>
        {guard ? (
          <div className="mb-6">
            <TLSpendGuardBanner kind={guard.kind} message={guard.message} />
          </div>
        ) : null}
        {!canWriteChat ? (
          <div className="mb-6">
            <TLInlineAlert
              title="Read-only chat access"
              description="You can read this conversation, but only MEMBER, ADMIN, or OWNER can send messages."
              tone="neutral"
            />
          </div>
        ) : null}

        {loading ? <TLChatSkeleton /> : null}

        {!loading && data ? (
          <div className="grid gap-6">
            {data.messages.map((m: Message) => (
              <TLChatMessage key={m.id} m={m} />
            ))}
            {streaming && <TLTypingBubble text={streamingText} />}
          </div>
        ) : null}

        <TLChatComposer
          value={q}
          onChange={setQ}
          onSend={send}
          disabled={sending || streaming || loading || !canWriteChat}
          sending={sending || streaming}
          placeholder={
            canWriteChat
              ? "Ask a question. Example: What is the closing date and submission address?"
              : "Read-only access: ask a MEMBER, ADMIN, or OWNER to send chat messages."
          }
        />
      </TLSection>
    </TenderLensAppShell>
  );
}
