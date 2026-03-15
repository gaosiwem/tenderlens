"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import { updateTask } from "@/lib/workspace.api";
import type { BidTask } from "@/lib/workspace.types";
import { TLDueBadge } from "@/components/tenderlens/due-badge";

function fmt(d: string | null) {
  if (!d) return "No due date";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return d;
  }
}

export function TLTaskCard(props: {
  task: BidTask;
  onEdit: (t: BidTask) => void;
  onReload: () => Promise<void>;
  tenderId: string;
}) {
  const [saving, setSaving] = React.useState(false);

  async function setStatus(status: BidTask["status"]) {
    setSaving(true);
    const res = await updateTask(props.tenderId, props.task.id, { status });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to update task", { description: res.error.message });
      return;
    }
    await props.onReload();
  }

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="font-display text-sm font-extrabold">
              {props.task.title}
            </div>
            <div className="text-xs text-muted-foreground">
              {props.task.description ?? "No description"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <TLDueBadge dueAt={props.task.dueAt} status={props.task.status} />
            <TLCodeBadge value={props.task.status} />
            <TLCodeBadge value={props.task.priority} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Due: {fmt(props.task.dueAt)}
            {props.task.owner
              ? ` . Owner: ${props.task.owner.name || props.task.owner.email || props.task.owner.id}`
              : props.task.ownerId
                ? ` . Owner: ${props.task.ownerId.slice(0, 10)}`
                : " . Owner: Unassigned"}
          </div>

          <div className="flex flex-wrap gap-2">
            <TLButton
              variant="secondary"
              onClick={() => props.onEdit(props.task)}
              disabled={saving}
            >
              Edit
            </TLButton>
            <TLButton
              variant="secondary"
              onClick={() => setStatus("IN_PROGRESS")}
              disabled={saving}
            >
              Start
            </TLButton>
            <TLButton
              variant="secondary"
              onClick={() => setStatus("BLOCKED")}
              disabled={saving}
            >
              Block
            </TLButton>
            <TLButton onClick={() => setStatus("DONE")} disabled={saving}>
              Done
            </TLButton>
          </div>
        </div>

        {props.task.tags?.length ? (
          <div className="flex flex-wrap gap-2">
            {props.task.tags.slice(0, 10).map((t) => (
              <TLCodeBadge key={t} value={t} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
