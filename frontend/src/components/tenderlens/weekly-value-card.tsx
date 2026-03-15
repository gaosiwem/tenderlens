"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";

export function TLWeeklyValueCard(props: { summary: any }) {
  const usage = props.summary?.meta?.usage;
  const eventsCount = props.summary?.meta?.eventsCount ?? 0;

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-3">
        <div className="font-display text-sm font-extrabold">
          Weekly summary
        </div>
        <div className="text-xs text-muted-foreground">
          Your TenderLens activity for the last 7 days.
        </div>

        <div className="flex flex-wrap gap-2">
          <TLCodeBadge value={`events ${eventsCount}`} />
          {usage?.aiQueries !== undefined ? (
            <TLCodeBadge value={`ai ${usage.aiQueries}`} />
          ) : null}
          {usage?.exports !== undefined ? (
            <TLCodeBadge value={`exports ${usage.exports}`} />
          ) : null}
        </div>

        <div className="text-sm text-muted-foreground">
          Keep using compare, risk, and the workspace to move faster on bids.
        </div>
      </CardContent>
    </Card>
  );
}
