"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { Card, CardContent } from "@/components/ui/card";
import { TLCardSkeleton } from "@/components/tenderlens/skeleton-blocks";
import { getWorkspaceByTender, updateWorkspace } from "@/lib/workspace.api";
import { apiFetch } from "@/lib/api";
import type {
  BidActivity,
  BidAttachment,
  BidTask,
  BidWorkspace,
  WorkspaceStatus,
} from "@/lib/workspace.types";
import type { Tender } from "@/lib/tenders.types";
import { TLTaskCard } from "@/components/tenderlens/task-card";
import { TLTaskEditorDialog } from "@/components/tenderlens/task-editor-dialog";
import { TLTaskComments } from "@/components/tenderlens/task-comments";
import { TLActivityFeed } from "@/components/tenderlens/activity-feed";
import { TLAttachmentUploader } from "@/components/tenderlens/attachment-uploader";
import { TLRiskCard } from "@/components/tenderlens/risk-card";
import { useWorkspaceSocket } from "@/hooks/use-workspace-socket";
import { downloadBlob } from "@/lib/download-blob";
import { TLPaywallGuard } from "@/components/tenderlens/paywall-guard";
import {
  ArrowLeftIcon,
  FileDownIcon,
  PlusIcon,
  RefreshCcwIcon,
  TableIcon,
} from "lucide-react";

export default function WorkspacePage() {
  const params = useParams();
  const tenderId = String(params.tenderId);

  const [loading, setLoading] = React.useState(true);
  const [workspace, setWorkspace] = React.useState<BidWorkspace | null>(null);
  const [tasks, setTasks] = React.useState<BidTask[]>([]);
  const [activity, setActivity] = React.useState<BidActivity[]>([]);
  const [attachments, setAttachments] = React.useState<BidAttachment[]>([]);
  const [tenderTitle, setTenderTitle] = React.useState("");
  const [savingStatus, setSavingStatus] = React.useState<WorkspaceStatus | null>(
    null,
  );
  const [savingDecision, setSavingDecision] = React.useState<string | null>(null);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<BidTask | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [workspaceRes, tenderRes] = await Promise.all([
      getWorkspaceByTender(tenderId),
      apiFetch<Tender>(`/api/v1/tenders/${tenderId}`, { method: "GET" }),
    ]);
    setLoading(false);

    if (tenderRes.ok) {
      setTenderTitle(tenderRes.data.title);
    }

    if (!workspaceRes.ok) {
      toast.error("Failed to load workspace", {
        description: workspaceRes.error.message,
      });
      setWorkspace(null);
      setTasks([]);
      setActivity([]);
      setAttachments([]);
      return;
    }

    setWorkspace(workspaceRes.data.workspace);
    setTasks(workspaceRes.data.tasks);
    setActivity(workspaceRes.data.activity);
    setAttachments(workspaceRes.data.attachments);
  }, [tenderId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  useWorkspaceSocket(workspace?.id ?? null, async () => {
    await load();
  });

  async function setStatus(status: WorkspaceStatus) {
    if (!workspace) return;
    setSavingStatus(status);
    const res = await updateWorkspace(tenderId, { status });
    setSavingStatus(null);
    if (!res.ok) {
      toast.error("Failed to update workspace", {
        description: res.error.message,
      });
      return;
    }
    toast.success("Workspace updated");
    await load();
  }

  async function setDecision(decision: string | null) {
    if (!workspace) return;
    setSavingDecision(decision ?? "clear");
    const res = await updateWorkspace(tenderId, { decision });
    setSavingDecision(null);
    if (!res.ok) {
      toast.error("Failed to update decision", {
        description: res.error.message,
      });
      return;
    }
    toast.success("Decision updated");
    await load();
  }

  const status = workspace?.status ?? "DRAFT";
  const decision = workspace?.decision ?? null;

  return (
    <TenderLensAppShell
      title="Bid Workspace"
      subtitle={tenderTitle || "Execution & Collaboration"}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/tenders/${tenderId}`}>
            <TLButton
              variant="ghost"
              size="sm"
              iconLeft={<ArrowLeftIcon size={14} />}
            >
              Back to Tender
            </TLButton>
          </Link>
          <TLButton
            variant="secondary"
            size="sm"
            onClick={load}
            loading={loading}
            iconLeft={<RefreshCcwIcon size={14} />}
          >
            Refresh
          </TLButton>
        </div>
      }
    >
      <TLSection
        title="Bidding Environment"
        description="Coordinate your team, manage preparation tasks, and monitor submission risk in one place."
        right={
          workspace ? (
            <TLPaywallGuard>
              {({ run: guardRun }) => (
                <div className="flex items-center gap-2">
                  <TLButton
                    variant="outline"
                    size="sm"
                    iconLeft={<FileDownIcon size={14} />}
                    onClick={() =>
                      guardRun(
                        () =>
                          downloadBlob(
                            `/api/v1/exports/workspace/${tenderId}/pdf`,
                            "workspace-summary.pdf",
                          ),
                        {
                          title: "PDF Export Requires Pro",
                          description:
                            "Upgrade to Pro to export comprehensive workspace reports.",
                        },
                      )
                    }
                  >
                    PDF Report
                  </TLButton>
                  <TLButton
                    variant="outline"
                    size="sm"
                    iconLeft={<TableIcon size={14} />}
                    onClick={() =>
                      guardRun(
                        () =>
                          downloadBlob(
                            `/api/v1/exports/workspace/${tenderId}/xlsx`,
                            "workspace-tasks.xlsx",
                          ),
                        {
                          title: "XLSX Export Requires Pro",
                          description:
                            "Upgrade to Pro to export your project tasks to Excel.",
                        },
                      )
                    }
                  >
                    Export XLSX
                  </TLButton>
                </div>
              )}
            </TLPaywallGuard>
          ) : null
        }
      >
        {loading && !workspace ? (
          <div className="grid gap-4">
            <TLCardSkeleton />
            <TLCardSkeleton />
          </div>
        ) : null}

        {!workspace && !loading ? (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-2xl bg-background/20 opacity-60">
            <div className="text-sm font-semibold mb-1">
              Workspace not available
            </div>
            <div className="text-xs text-muted-foreground text-center max-w-[200px]">
              It seems this tender does not have an active workspace yet.
            </div>
          </div>
        ) : null}

        {workspace ? (
          <div className="grid gap-6">
            <Card className="tl-surface border-primary/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    {tenderTitle ? (
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground mb-2">
                        Tender: {tenderTitle}
                      </div>
                    ) : null}
                    <div className="font-display text-base font-extrabold uppercase tracking-tight">
                      Bid Status
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Track progress from planning to submission.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        "DRAFT",
                        "IN_PROGRESS",
                        "SUBMITTED",
                        "WON",
                        "LOST",
                        "ABANDONED",
                      ] as const
                    ).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        disabled={savingStatus !== null || savingDecision !== null}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-colors rounded-lg border ${status === s ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted text-muted-foreground"}`}
                      >
                        {savingStatus === s ? (
                          <RefreshCcwIcon className="mr-1 inline size-3 animate-spin" />
                        ) : null}
                        {s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-border/40">
                  <div className="text-xs text-muted-foreground">
                    Last updated:{" "}
                    <span className="font-medium text-foreground">
                      {new Date(workspace.updatedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold mr-2 uppercase tracking-wider text-muted-foreground">
                      Decision
                    </div>
                    <div className="flex items-center border border-border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setDecision("Bid")}
                        disabled={savingStatus !== null || savingDecision !== null}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-colors ${decision === "Bid" ? "bg-emerald-500 text-white" : "bg-background hover:bg-muted text-muted-foreground"}`}
                      >
                        {savingDecision === "Bid" ? (
                          <RefreshCcwIcon className="mr-1 inline size-3 animate-spin" />
                        ) : null}
                        Bid
                      </button>
                      <button
                        onClick={() => setDecision("No-bid")}
                        disabled={savingStatus !== null || savingDecision !== null}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-colors ${decision === "No-bid" ? "bg-destructive text-white" : "bg-background hover:bg-muted text-muted-foreground"}`}
                      >
                        {savingDecision === "No-bid" ? (
                          <RefreshCcwIcon className="mr-1 inline size-3 animate-spin" />
                        ) : null}
                        No-bid
                      </button>
                      <button
                        onClick={() => setDecision(null)}
                        disabled={savingStatus !== null || savingDecision !== null}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-colors border-l border-border ${!decision ? "bg-secondary text-secondary-foreground" : "bg-background hover:bg-muted text-muted-foreground"}`}
                      >
                        {savingDecision === "clear" ? (
                          <RefreshCcwIcon className="mr-1 inline size-3 animate-spin" />
                        ) : null}
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Main Column: Tasks */}
              <div className="lg:col-span-8 space-y-6">
                <Card className="tl-surface">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-display text-base font-extrabold uppercase tracking-tight">
                          Bid Tasks
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Action items and responsibilities for this submission.
                        </div>
                      </div>
                      <TLButton
                        size="sm"
                        iconLeft={<PlusIcon size={16} />}
                        onClick={() => {
                          setEditingTask(null);
                          setEditorOpen(true);
                        }}
                      >
                        Add Task
                      </TLButton>
                    </div>

                    <div className="grid gap-4 mt-4">
                      {tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-2xl bg-background/20 opacity-60">
                          <div className="text-sm font-semibold mb-1">
                            No tasks created yet
                          </div>
                          <div className="text-xs text-muted-foreground text-center max-w-[200px]">
                            Start by adding the first preparation task for your
                            team.
                          </div>
                        </div>
                      ) : null}

                      {tasks.map((task) => (
                        <div key={task.id} className="space-y-3">
                          <TLTaskCard
                            tenderId={tenderId}
                            task={task}
                            onEdit={(t) => {
                              setEditingTask(t);
                              setEditorOpen(true);
                            }}
                            onReload={load}
                          />
                          <Card className="tl-surface">
                            <CardContent className="p-4">
                              <TLTaskComments
                                tenderId={tenderId}
                                taskId={task.id}
                                comments={task.comments ?? []}
                                onCommentAdded={() => {
                                  void load();
                                }}
                              />
                            </CardContent>
                          </Card>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <TLActivityFeed items={activity} />
              </div>

              {/* Sidebar: Risk & Attachments */}
              <div className="lg:col-span-4 space-y-6">
                <TLRiskCard
                  workspaceId={workspace.id}
                  riskScore={workspace.riskScore}
                  riskMeta={workspace.riskMeta}
                  onUpdated={(s, m) => {
                    setWorkspace((prev) =>
                      prev ? { ...prev, riskScore: s, riskMeta: m } : null,
                    );
                  }}
                />

                <TLAttachmentUploader
                  workspaceId={workspace.id}
                  attachments={attachments}
                  onUploaded={load}
                />
              </div>
            </div>
          </div>
        ) : null}
      </TLSection>

      <TLTaskEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        tenderId={tenderId}
        task={editingTask}
        onSaved={load}
      />
    </TenderLensAppShell>
  );
}
