"use client";

import { Card, CardContent } from "@/components/ui/card";

export function TLRevenuePlanBreakdown(props: {
  byPlan: Record<string, number>;
}) {
  const rows = Object.entries(props.byPlan ?? {}).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  return (
    <Card className="tl-surface border-border/40 bg-linear-to-b from-background to-muted/5 shadow-2xl shadow-black/5 overflow-hidden rounded-[2.5rem]">
      <CardContent className="p-10 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-display text-xl font-extrabold tracking-tight">
              Plan Distribution
            </h3>
            <p className="text-sm text-muted-foreground/60 font-medium tracking-tight italic">
              Breakdown of active subscriptions by plan type
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-primary/5 text-primary">
            <svg
              className="size-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
        </div>

        <div className="overflow-hidden border border-border/60 rounded-3xl backdrop-blur-sm bg-white/5">
          <table className="min-w-[520px] w-full text-sm">
            <thead className="bg-muted/40 ">
              <tr className="border-b border-border/60">
                <th className="text-left p-4 pl-8 text-[10px] font-bold tracking-[0.2em] text-muted-foreground">
                  Product Plan
                </th>
                <th className="text-right p-4 pr-8 text-[10px] font-bold tracking-[0.2em] text-muted-foreground transition-colors">
                  Total Units
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map(([plan, count]) => (
                <tr
                  key={plan}
                  className="group hover:bg-primary/5 transition-colors"
                >
                  <td className="p-5 pl-8 font-bold tracking-tight text-foreground/90">
                    {plan}
                  </td>
                  <td className="p-5 pr-8 text-right font-mono font-extrabold text-primary tabular-nums">
                    <span className="bg-primary/10 px-3 py-1 rounded-lg">
                      {count.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td
                    className="p-12 text-muted-foreground italic text-center text-sm font-medium"
                    colSpan={2}
                  >
                    No active subscriptions found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
