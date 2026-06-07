"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import type { WatchTemplate } from "@/lib/templates.types";
import { applyWatchTemplate } from "@/lib/templates.api";

export function TLTemplateCard(props: {
  t: WatchTemplate;
  onApplied?: () => void;
}) {
  const [applying, setApplying] = React.useState(false);

  async function apply() {
    setApplying(true);
    const res = await applyWatchTemplate(props.t.id);
    setApplying(false);

    if (!res.ok) {
      toast.error("Failed to apply category", {
        description: res.error.message,
      });
      return;
    }

    const addedCount = res.data.addedCount ?? 0;

    toast.success("Category applied", {
      description:
        addedCount > 0
          ? `Applied ${props.t.name} category and added ${addedCount} existing tenders to your watchlist.`
          : `Applied ${props.t.name} category for future monitoring.`,
    });

    // Dispatch global refresh
    window.dispatchEvent(new CustomEvent("tl:usage-refresh"));

    await props.onApplied?.();
  }

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-3">
        <div className="font-display text-base font-extrabold">
          {props.t.name}
        </div>
        <div className="text-sm text-muted-foreground">
          {props.t.description}
        </div>
        <div className="flex flex-wrap gap-2">
          {props.t.keywords.slice(0, 8).map((k) => (
            <TLCodeBadge key={k} value={k} />
          ))}
        </div>
        <TLButton onClick={apply} disabled={applying}>
          {applying ? "Applying..." : "Apply category"}
        </TLButton>
      </CardContent>
    </Card>
  );
}
