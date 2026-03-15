"use client";

import { BarChart3, Calendar, Tag, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function TLAnalyticsSummary(props: {
  items: Array<{ day: string; name: string; count: number }>;
}) {
  return (
    <Card className="tl-surface border-border/50">
      <CardContent className="p-0">
        <div className="p-5 border-b border-border/50 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="font-display text-sm font-extrabold uppercase tracking-tight">
              Conversion Funnel Analytics
            </h3>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
            <Activity className="w-3 h-3" />
            LIVE DATA
          </div>
        </div>

        <div className="p-0">
          {props.items.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground italic">
                No conversion data collected for this period.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/30">
                    <th className="text-left py-3 px-5 font-bold">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        Timestamp
                      </div>
                    </th>
                    <th className="text-left py-3 px-5 font-bold">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3" />
                        Event Name
                      </div>
                    </th>
                    <th className="text-right py-3 px-5 font-bold">
                      Occurrences
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {props.items.map((r, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-primary/5 transition-colors group"
                    >
                      <td className="py-3 px-5 font-medium tabular-nums text-muted-foreground group-hover:text-foreground">
                        {r.day}
                      </td>
                      <td className="py-3 px-5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold text-foreground uppercase border border-border group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                          {r.name.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right font-display font-extrabold text-sm tabular-nums">
                        {r.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
