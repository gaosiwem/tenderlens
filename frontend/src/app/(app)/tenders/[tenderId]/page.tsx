"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FileText,
  Clock,
  Database,
  ListChecks,
} from "lucide-react";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { TLWatchToggle } from "@/components/tenderlens/watch-toggle";
import { TLChatComposer } from "@/components/tenderlens/chat-composer";
import { TLChatMessage } from "@/components/tenderlens/chat-message";
import { TLTypingBubble } from "@/components/tenderlens/typing-bubble";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { downloadBlob } from "@/lib/download-blob";
import { tenderStatusLabel } from "@/lib/tender-status";
import {
  createConversation,
  getConversation,
  getConversationContextProgress,
  listConversations,
  postMessage,
} from "@/lib/chat.api";
import type { Message, ConversationContextProgress } from "@/lib/chat.types";
import {
  Tender,
  TenderFile,
  ExternalTenderDocument,
  ScrapedTenderData,
  TenderStatus,
} from "@/lib/tenders.types";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/date-utils";

export default function TenderDetailPage() {
  const params = useParams();
  const tenderId = params.tenderId as string;
  const { me } = useAuth();
  const activeOrgId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("tl_active_org_id")
      : null;
  const userRole =
    me?.orgs.find((o) => o.org.id === activeOrgId)?.role ?? "VIEWER";
  const canWriteChat = userRole !== "VIEWER";

  const [tender, setTender] = React.useState<Tender | null>(null);
  const [files, setFiles] = React.useState<TenderFile[]>([]);
  const [externalDocs, setExternalDocs] = React.useState<
    ExternalTenderDocument[]
  >([]);
  const [scraped, setScraped] = React.useState<ScrapedTenderData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [polling, setPolling] = React.useState(false);
  const [downloadingFileId, setDownloadingFileId] = React.useState<
    string | null
  >(null);
  const [chatConversationId, setChatConversationId] = React.useState<
    string | null
  >(null);
  const [chatMessages, setChatMessages] = React.useState<Message[]>([]);
  const [chatLoading, setChatLoading] = React.useState(true);
  const [chatInput, setChatInput] = React.useState("");
  const [chatSending, setChatSending] = React.useState(false);
  const [pendingQuestion, setPendingQuestion] = React.useState<string | null>(
    null,
  );
  const [chatError, setChatError] = React.useState<string | null>(null);
  const [chatProgress, setChatProgress] =
    React.useState<ConversationContextProgress | null>(null);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    if (chatMessages.length > 0 || chatSending) {
      scrollToBottom();
    }
  }, [chatMessages, chatSending]);

  const fetchData = React.useCallback(async () => {
    try {
      const [tRes, fRes, dRes, sRes] = await Promise.all([
        apiFetch<Tender>(`/api/v1/tenders/${tenderId}`),
        apiFetch<{ items: TenderFile[] }>(`/api/v1/tenders/${tenderId}/files`),
        apiFetch<{ items: ExternalTenderDocument[] }>(
          `/api/v1/tenders/${tenderId}/external-documents`,
        ),
        apiFetch<ScrapedTenderData>(`/api/v1/tenders/${tenderId}/scraped-data`),
      ]);

      if (tRes.ok) setTender(tRes.data);
      if (fRes.ok) setFiles(fRes.data.items);
      if (dRes.ok) setExternalDocs(dRes.data.items);
      if (sRes.ok) setScraped(sRes.data);

      return tRes.ok ? tRes.data : null;
    } catch {
      return null;
    }
  }, [tenderId]);

  React.useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  React.useEffect(() => {
    if (!tender) return;

    const isProcessing =
      tender.status === TenderStatus.QUEUED ||
      tender.status === TenderStatus.PROCESSING;

    if (isProcessing) {
      setPolling(true);
      const interval = setInterval(async () => {
        const updated = await fetchData();
        if (
          updated &&
          updated.status !== TenderStatus.QUEUED &&
          updated.status !== TenderStatus.PROCESSING
        ) {
          setPolling(false);
        }
      }, 3000);
      return () => clearInterval(interval);
    }

    setPolling(false);
  }, [tender, fetchData]);

  const loadTenderChat = React.useCallback(async () => {
    setChatLoading(true);
    setChatError(null);

    const conversationsRes = await listConversations();
    if (!conversationsRes.ok) {
      setChatConversationId(null);
      setChatMessages([]);
      setChatError(conversationsRes.error.message);
      setChatLoading(false);
      return;
    }

    const conversation =
      conversationsRes.data.items.find((c) => c.tenderId === tenderId) ?? null;

    if (!conversation) {
      setChatConversationId(null);
      setChatMessages([]);
      setChatLoading(false);
      return;
    }

    setChatConversationId(conversation.id);

    const historyRes = await getConversation(conversation.id);
    if (!historyRes.ok) {
      setChatMessages([]);
      setChatError(historyRes.error.message);
      setChatLoading(false);
      return;
    }

    setChatMessages(historyRes.data.messages);
    setChatLoading(false);
  }, [tenderId]);

  React.useEffect(() => {
    void loadTenderChat();
  }, [loadTenderChat]);

  React.useEffect(() => {
    if (!chatConversationId || chatSending) return;
    const phase = chatProgress?.phase;
    if (!phase) return;
    if (phase === "ready" || phase === "idle" || phase === "no_documents") {
      return;
    }

    const timer = setInterval(async () => {
      const p = await getConversationContextProgress(chatConversationId);
      if (p.ok) setChatProgress(p.data);
    }, 1800);

    return () => clearInterval(timer);
  }, [chatConversationId, chatSending, chatProgress?.phase]);

  async function sendTenderChatMessage() {
    const question = chatInput.trim();
    if (!question || chatSending || chatLoading) return;
    if (!canWriteChat) {
      const message =
        "You have read-only chat access. Ask a MEMBER, ADMIN, or OWNER to send messages.";
      setChatError(message);
      toast.error("Insufficient permission", { description: message });
      return;
    }

    setChatSending(true);
    setPendingQuestion(question);
    setChatInput("");
    setChatError(null);
    setChatProgress(null);

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    try {
      let conversationId = chatConversationId;
      if (!conversationId) {
        const createRes = await createConversation({
          title: tender?.title?.trim() ? `${tender.title}` : "Tender Chat",
          tenderId,
        });
        if (!createRes.ok) {
          setChatInput(question);
          setChatError(createRes.error.message);
          setChatProgress(null);
          toast.error("Chat failed", { description: createRes.error.message });
          return;
        }
        conversationId = createRes.data.id;
        setChatConversationId(conversationId);
      }

      const pollProgress = async () => {
        const p = await getConversationContextProgress(conversationId);
        if (!cancelled && p.ok) {
          setChatProgress(p.data);
        }
      };

      await pollProgress();
      timer = setInterval(() => {
        void pollProgress();
      }, 1200);

      const res = await postMessage(conversationId, question);
      if (!res.ok) {
        setChatInput(question);
        setChatError(res.error.message);
        setChatProgress(null);
        toast.error("Chat failed", { description: res.error.message });
        return;
      }

      const finalProgress =
        await getConversationContextProgress(conversationId);
      if (finalProgress.ok) setChatProgress(finalProgress.data);
      setChatMessages((prev) => [...prev, res.data.user, res.data.assistant]);
    } catch {
      setChatInput(question);
      setChatError("Network error while sending chat message.");
      setChatProgress(null);
      toast.error("Chat failed", {
        description: "Network error while sending chat message.",
      });
    } finally {
      cancelled = true;
      if (timer) clearInterval(timer);
      setChatSending(false);
      setPendingQuestion(null);
    }
  }

  async function downloadTenderFile(file: TenderFile) {
    setDownloadingFileId(file.id);
    try {
      await downloadBlob(
        `/api/v1/tenders/${tenderId}/files/${file.id}/download`,
        file.originalFilename,
      );
    } catch (e: unknown) {
      toast.error("Failed to download file", {
        description: e instanceof Error ? e.message : "Download failed",
      });
    } finally {
      setDownloadingFileId(null);
    }
  }

  function openExternalDocument(path: string) {
    window.open(path, "_blank", "noopener,noreferrer");
  }

  function normalizeDocNameForComparison(name: string) {
    return name
      .replace(/\s*\[etenders:[^\]]+\]\s*$/i, "")
      .trim()
      .toLowerCase();
  }

  function isHiddenGeneratedOrRecreatedFile(name: string) {
    const trimmed = (name ?? "").trim();
    if (!trimmed) return false;
    if (/\(generated\)/i.test(trimmed)) return true;
    if (/\s\[etenders:[^\]]+\]\s*$/i.test(trimmed)) return true;
    return false;
  }

  const visibleFiles = React.useMemo(() => {
    const externalNames = new Set(
      externalDocs.map((doc) => normalizeDocNameForComparison(doc.name)),
    );

    return files.filter((file) => {
      if (isHiddenGeneratedOrRecreatedFile(file.originalFilename)) return false;
      const normalized = normalizeDocNameForComparison(file.originalFilename);
      if (!normalized) return false;
      return !externalNames.has(normalized);
    });
  }, [externalDocs, files]);

  function closingUrgency(value: string | null) {
    if (!value) return "Closing date not available in scraped data.";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "Closing date format is unavailable.";

    const now = Date.now();
    const diffMs = d.getTime() - now;
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays < 0) return `Closed ${Math.abs(diffDays)} day(s) ago.`;
    if (diffDays === 0) return "Closes today.";
    if (diffDays === 1) return "Closes tomorrow.";
    return `Closes in ${diffDays} day(s).`;
  }

  if (loading) {
    return (
      <TenderLensAppShell title={<Skeleton className="h-8 w-64" />}>
        <TLSection>
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4 animate-spin" />
            Loading tender data...
          </div>
          <Skeleton className="h-48 w-full" />
        </TLSection>
      </TenderLensAppShell>
    );
  }

  if (!tender) return <div>Tender not found</div>;

  return (
    <TenderLensAppShell
      title="Tender Details"
      description="Review tender documents, processing status, and related activity."
      showSearch={false}
      actions={
        <div className="flex flex-wrap gap-2">
          <TLWatchToggle tenderId={tender.id} />
          <Link href={`/tenders/${tender.id}/workspace`}>
            <TLButton>
              <Database className="size-4 mr-2" />
              Workspace
            </TLButton>
          </Link>

          {(tender.status === TenderStatus.COMPLETED ||
            tender.status === TenderStatus.DRAFT) && (
            <>
              <Link href={`/tenders/${tender.id}/checklist`}>
                <TLButton variant="outline">
                  <ListChecks className="size-4 mr-2" />
                  Checklist
                </TLButton>
              </Link>
              <Link href={`/tenders/${tender.id}/summary?autogen=1`}>
                <TLButton variant="outline">
                  <FileText className="size-4 mr-2" />
                  Summary
                </TLButton>
              </Link>
            </>
          )}
        </div>
      }
    >
      {tender.status === TenderStatus.FAILED && (
        <TLSection>
          <TLInlineAlert variant="error" title="Processing Failed">
            Something went wrong while processing this tender. Please try
            uploading again.
          </TLInlineAlert>
        </TLSection>
      )}

      {polling && (
        <TLSection>
          <TLInlineAlert variant="info" title="Processing in Progress">
            <div className="flex items-center gap-2">
              <Clock className="size-4 animate-spin" />
              We are currently extracting data from your documents. This page
              will update automatically.
            </div>
          </TLInlineAlert>
        </TLSection>
      )}

      <div className="space-y-6">
        <TLSection title="Details" className="min-w-0">
          <Card className="min-w-0 w-full">
            <CardContent className="pt-6 space-y-5 overflow-hidden">
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Closing Date
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  <div className="text-base font-semibold">
                    {formatDate(scraped?.closingDate ?? null)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {closingUrgency(scraped?.closingDate ?? null)}
                </div>
              </div>

              <div className="min-w-0 w-full text-sm">
                <div className="block rounded-sm">
                  <div className="text-muted-foreground text-xs uppercase tracking-wide">
                    Tender Title
                  </div>
                  <h1 className="text-sm font-bold tracking-tight text-foreground/90 md:text-base break-words">
                    {tender.title}
                  </h1>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wide">
                    Tender Number
                  </div>
                  <div>{scraped?.tenderNumber || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wide">
                    Procuring Entity
                  </div>
                  <div>{scraped?.companyName || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wide">
                    Category
                  </div>
                  <div>{scraped?.category || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wide">
                    Province
                  </div>
                  <div>{scraped?.province || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wide">
                    Published Date
                  </div>
                  <div>{formatDate(scraped?.publishedDate ?? null)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wide">
                    External Tender ID
                  </div>
                  <div>
                    {scraped?.externalId ? String(scraped.externalId) : "-"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TLSection>

        <TLSection title="Documents" className="min-w-0">
          <Card className="min-w-0 w-full">
            <CardContent className="p-0">
              {visibleFiles.length === 0 && externalDocs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No documents available.
                </div>
              ) : (
                <div className="divide-y">
                  {externalDocs.map((doc) => (
                    <div
                      key={`ext-${doc.id}`}
                      className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors"
                      role="link"
                      tabIndex={0}
                      onClick={() => openExternalDocument(doc.path)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openExternalDocument(doc.path);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-primary/10 p-2 rounded">
                          <FileText className="size-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Source: eTenders
                          </div>
                        </div>
                      </div>
                      <a
                        href={doc.path}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary hover:underline shrink-0"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Download
                      </a>
                    </div>
                  ))}

                  {visibleFiles.map((f) => (
                    <div
                      key={f.id}
                      className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors"
                      role="button"
                      tabIndex={0}
                      aria-busy={downloadingFileId === f.id}
                      onClick={() => {
                        void downloadTenderFile(f);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void downloadTenderFile(f);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-primary/10 p-2 rounded">
                          <FileText className="size-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {f.originalFilename}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(f.sizeBytes / 1024 / 1024).toFixed(2)} MB -{" "}
                            {f.mimeType}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          className="text-sm font-medium text-primary hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            void downloadTenderFile(f);
                          }}
                        >
                          {downloadingFileId === f.id
                            ? "Downloading..."
                            : "Download"}
                        </button>
                        <div className="text-xs text-muted-foreground">
                          {new Date(f.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TLSection>

        <div id="ai-tender-chat">
          <TLSection
            title="AI Tender Chat"
            description="Ask questions about this tender and get answers grounded in extracted document sections."
            className="min-w-0"
            right={
              <div className="flex items-center gap-2">
                <Link
                  href={
                    chatConversationId ? `/chat/${chatConversationId}` : "/chat"
                  }
                >
                  <TLButton variant="outline" size="sm">
                    {chatConversationId ? "Open Full Chat" : "Open Chat Hub"}
                  </TLButton>
                </Link>
                <TLButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void loadTenderChat();
                  }}
                  disabled={chatLoading || chatSending}
                >
                  Refresh Chat
                </TLButton>
              </div>
            }
          >
            <Card className="min-w-0 w-full">
              <CardContent className="p-5 space-y-4">
                {tender.status !== TenderStatus.COMPLETED ? (
                  <TLInlineAlert
                    variant="info"
                    title="Chat context not ready yet"
                  >
                    Current state: {tenderStatusLabel(tender.status)}. You can
                    chat now, but answers may be limited until the tender is
                    Ready.
                  </TLInlineAlert>
                ) : null}

                {chatError ? (
                  <TLInlineAlert variant="error" title="Chat unavailable">
                    {chatError}
                  </TLInlineAlert>
                ) : null}
                {!canWriteChat ? (
                  <TLInlineAlert
                    variant="neutral"
                    title="Read-only chat access"
                  >
                    Your role is VIEWER. You can read conversation history, but
                    only MEMBER, ADMIN, or OWNER can start chats and send
                    messages.
                  </TLInlineAlert>
                ) : null}

                {chatLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    No chat messages yet. Ask your first question about
                    requirements, deadlines, compliance, or submission details.
                  </div>
                ) : (
                  <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {chatMessages.map((m) => (
                      <TLChatMessage key={m.id} m={m} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}

                {chatSending ? (
                  <TLTypingBubble
                    text={
                      pendingQuestion
                        ? `Working on: ${pendingQuestion}`
                        : "Analyzing tender documents..."
                    }
                  />
                ) : null}

                <TLChatComposer
                  value={chatInput}
                  onChange={setChatInput}
                  onSend={sendTenderChatMessage}
                  sending={chatSending}
                  disabled={chatLoading || chatSending || !canWriteChat}
                  placeholder={
                    canWriteChat
                      ? "Ask this tender anything, e.g. What is required for submission and when is closing?"
                      : "Read-only access: ask a MEMBER, ADMIN, or OWNER to send chat messages."
                  }
                />
              </CardContent>
            </Card>
          </TLSection>
        </div>
      </div>
    </TenderLensAppShell>
  );
}
