"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import { getTenderTimeline } from "@/lib/timeline.api";
import type { TenderChangeLog } from "@/lib/timeline.types";
import {
  History,
  FileText,
  Calendar,
  Info,
  RefreshCw,
  Sparkles,
} from "lucide-react";

function prettyType(t: string) {
  return t
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getIcon(type: string) {
  switch (type) {
    case "FILE_HASH_CHANGED":
      return <FileText className="h-4 w-4" />;
    case "DEADLINE_CHANGED":
      return <Calendar className="h-4 w-4" />;
    case "SUMMARY_CHANGED":
      return <FileText className="h-4 w-4" />;
    case "LIFECYCLE_CHANGED":
      return <Sparkles className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
}

export function TLTenderTimeline(props: { tenderId: string }) {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<TenderChangeLog[]>([]);

  async function load() {
    setLoading(true);
    const res = await getTenderTimeline(props.tenderId, 80);
    setLoading(false);
    if (!res.ok) {
      toast.error("Failed to load timeline", {
        description: res.error.message,
      });
      setItems([]);
      return;
    }
    setItems(res.data.items);
  }

  React.useEffect(() => {
    load();
  }, [props.tenderId]);

  return (
    <Card className="tl-surface border-border/40">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-display text-sm font-extrabold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Tender Timeline
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Audit trail of document versions, deadline updates, and AI
              summaries.
            </p>
          </div>
          <TLButton
            variant="secondary"
            size="sm"
            onClick={load}
            loading={loading}
            iconLeft={<RefreshCw className="h-3 w-3" />}
          >
            Refresh
          </TLButton>
        </div>

        {items.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border/40 rounded-2xl bg-muted/10">
            <History className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No events recorded for this tender yet.
            </p>
          </div>
        ) : null}

        <div className="relative space-y-4 pl-4 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-border/40">
          {items.map((i) => (
            <div key={i.id} className="relative group">
              <div className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary shadow-sm ring-4 ring-background" />

              <div className="border border-border/40 rounded-xl p-4 bg-muted/5 group-hover:bg-muted/10 transition-colors">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-primary/60">{getIcon(i.type)}</span>
                    <span className="font-display text-sm font-bold tracking-tight">
                      {prettyType(i.type)}
                    </span>
                  </div>
                  <time className="text-[10px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                    {new Date(i.createdAt).toLocaleString()}
                  </time>
                </div>

                {i.meta && Object.keys(i.meta).length > 0 ? (
                  <div className="mb-3 p-3 rounded-lg bg-background/50 border border-border/20 font-mono text-[11px] text-muted-foreground overflow-x-auto">
                    <pre className="whitespace-pre-wrap break-all">
                      {JSON.stringify(i.meta, null, 2)}
                    </pre>
                  </div>
                ) : null}

                  <div className="flex items-center justify-between pt-2 border-t border-border/20">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                      ID:
                    </span>
                    <TLCodeBadge
                      value={i.id.slice(0, 8)}
                      className="py-0 h-4"
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {i.type === "FILE_HASH_CHANGED"
                      ? "New document version"
                      : i.type === "LIFECYCLE_CHANGED"
                        ? "Lifecycle updated"
                      : "Update event"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
