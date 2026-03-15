"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { BidActivity } from "@/lib/workspace.types";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown) {
  if (typeof value === "string") return value || "cleared";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value == null) return "cleared";
  return null;
}

function describeActivity(item: BidActivity) {
  const meta = isRecord(item.meta) ? item.meta : null;
  const title =
    meta && typeof meta.title === "string" && meta.title.trim()
      ? meta.title.trim()
      : null;

  switch (item.type) {
    case "TASK_CREATED":
      return title ? `Created task "${title}"` : "Created a new task";
    case "TASK_ASSIGNED":
      return "Updated task ownership";
    case "TASK_STATUS_CHANGED":
      return "Updated task status";
    case "TASK_UPDATED":
      return "Updated task details";
    case "COMMENT_ADDED":
      return "Added a task comment";
    case "WORKSPACE_UPDATED":
      return "Updated workspace details";
    default:
      return formatLabel(item.type);
  }
}

function describeDetails(item: BidActivity) {
  const meta = isRecord(item.meta) ? item.meta : null;
  if (!meta) return [];

  const details: string[] = [];

  if (isRecord(meta.changes)) {
    for (const [key, rawChange] of Object.entries(meta.changes)) {
      if (!isRecord(rawChange)) continue;
      const from = formatValue(rawChange.from);
      const to = formatValue(rawChange.to);
      if (!from && !to) continue;

      if (from && to) {
        details.push(`${formatLabel(key)}: ${from} to ${to}`);
      } else if (to) {
        details.push(`${formatLabel(key)}: ${to}`);
      }
    }
  }

  if (details.length === 0 && typeof meta.field === "string") {
    const from = formatValue(meta.from);
    const to = formatValue(meta.to);
    if (from && to) {
      details.push(`${formatLabel(meta.field)}: ${from} to ${to}`);
    } else if (to) {
      details.push(`${formatLabel(meta.field)}: ${to}`);
    }
  }

  if (details.length === 0 && typeof meta.commentId === "string") {
    details.push("Conversation updated on the task thread");
  }

  return details.slice(0, 4);
}

export function TLActivityFeed(props: { items: BidActivity[] }) {
  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-4">
        <div className="font-display text-sm font-extrabold">Activity</div>
        <div className="grid gap-2">
          {props.items.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No activity yet.
            </div>
          ) : null}

          {props.items.slice(0, 40).map((a) => (
            <div
              key={a.id}
              className="border border-border rounded-xl p-3 space-y-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-sm font-semibold">{describeActivity(a)}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <TLCodeBadge
                  value={
                    a.user?.name || a.user?.email || a.userId.slice(0, 10)
                  }
                />
              </div>
              {describeDetails(a).length > 0 ? (
                <div className="space-y-1">
                  {describeDetails(a).map((detail) => (
                    <div
                      key={detail}
                      className="text-xs text-muted-foreground"
                    >
                      {detail}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No additional details recorded.
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
