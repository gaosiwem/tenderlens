"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import { computeWorkspaceRisk } from "@/lib/risk.api";

export function TLRiskCard(props: {
  workspaceId: string;
  riskScore: number;
  riskMeta: any;
  onUpdated: (s: number, m: any) => void;
}) {
  const [loading, setLoading] = React.useState(false);

  async function compute() {
    setLoading(true);
    const res = await computeWorkspaceRisk(props.workspaceId);
    setLoading(false);
    if (!res.ok) {
      toast.error("Failed to compute risk", { description: res.error.message });
      return;
    }
    props.onUpdated(res.data.riskScore, res.data.riskMeta);
    toast.success("Risk updated");
  }

  const signals = props.riskMeta?.signals ?? [];
  const score = Math.round(Number(props.riskScore ?? 0));

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-display text-sm font-extrabold">
              Risk score
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Explainable signals. Use as guidance only.
            </div>
          </div>
          <TLButton variant="secondary" onClick={compute} disabled={loading}>
            {loading ? "Computing..." : "Recompute"}
          </TLButton>
        </div>

        <div className="border border-border rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Score</div>
          <div className="font-display text-3xl font-extrabold">{score}</div>
          <div className="text-xs text-muted-foreground mt-1">
            0 is low risk. 100 is high risk.
          </div>
        </div>

        {Array.isArray(signals) && signals.length ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground ">
              Signals
            </div>
            <div className="grid gap-2">
              {signals.slice(0, 12).map((s: any, idx: number) => (
                <div
                  key={idx}
                  className="border border-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="text-sm font-semibold">
                    {String(s.key ?? "signal")}
                  </div>
                  <div className="flex items-center gap-2">
                    <TLCodeBadge value={`+${s.weight ?? 0}`} />
                    {s.conf !== undefined ? (
                      <TLCodeBadge value={`conf ${String(s.conf)}`} />
                    ) : null}
                    {s.itemCount !== undefined ? (
                      <TLCodeBadge value={`items ${String(s.itemCount)}`} />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No signals yet.</div>
        )}
      </CardContent>
    </Card>
  );
}
