"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import type { Usage } from "@/lib/billing.types";

function remaining(limit: number | "unlimited", used: number) {
  if (limit === "unlimited") return "Unlimited";
  return String(Math.max(0, limit - used));
}

export function TLUsageMeter(props: { usage: Usage }) {
  const u = props.usage;
  const lim = u.limits;

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-4">
        <div className="font-display text-sm font-extrabold uppercase tracking-tight">
          Usage Overview
        </div>
        <div className="text-xs text-muted-foreground">
          Current cycle: {u.month}
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 p-3">
            <div className="text-sm font-semibold">AI Queries</div>
            <div className="flex items-center gap-2">
              <TLCodeBadge value={`${u.aiQueries} used`} />
              <TLCodeBadge
                value={`${remaining(lim.maxAiQueries, u.aiQueries)} left`}
                className="bg-primary/10 text-primary border-primary/20"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 p-3">
            <div className="text-sm font-semibold">Workspace Exports</div>
            <div className="flex items-center gap-2">
              <TLCodeBadge value={`${u.exports} used`} />
              <TLCodeBadge
                value={lim.exportsEnabled ? "Enabled" : "Locked"}
                className={
                  lim.exportsEnabled
                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                    : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 p-3">
            <div className="text-sm font-semibold">Auto Reminders</div>
            <div className="flex items-center gap-2">
              <TLCodeBadge value={`${u.reminders} sent`} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
