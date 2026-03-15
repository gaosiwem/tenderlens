"use client";

import * as React from "react";
import { toast } from "sonner";
import { TLSection } from "@/components/tenderlens/section";
import { getRevenueSummary } from "@/lib/revenue-reporting.api";
import { TLRevenueSummaryCards } from "@/components/tenderlens/revenue-summary-cards";
import { TLRevenuePlanBreakdown } from "@/components/tenderlens/revenue-plan-breakdown";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminRevenuePage() {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any | null>(null);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await getRevenueSummary();
      setLoading(false);
      if (!r.ok) {
        toast.error("Failed", { description: (r.error as any).message });
        return;
      }
      setData(r.data);
    })();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-display font-extrabold tracking-tight">
            Revenue <span className="text-primary">Intelligence</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-sm">
            Directional insights into platform monetization and growth metrics.
          </p>
        </div>

        {data && (
          <Card className="bg-primary/5 border-primary/10 min-w-[200px]">
            <CardContent className="p-4">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                Active Subscriptions
              </div>
              <div className="text-3xl font-display font-bold">
                {data.activeSubscriptions.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <TLSection>
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 gap-4">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-full border-2 border-primary/10" />
              <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
              Synthesizing Financial Data...
            </div>
          </div>
        ) : null}

        {data ? (
          <div className="grid gap-8">
            <TLRevenueSummaryCards
              windowDays={data.windowDays}
              revenueCents={data.revenueCents}
              mrrEstimateCents={data.mrrEstimateCents}
              churned={data.churned}
              activeSubscriptions={data.activeSubscriptions}
              partnerAttributedUpgrades={data.partnerAttributedUpgrades}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2">
                <TLRevenuePlanBreakdown byPlan={data.byPlan} />
              </div>

              <Card>
                <CardContent className="p-6">
                  <div className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase mb-6 border-b pb-4">
                    Payout Automation
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-between items-center text-sm font-semibold">
                      <div className="flex flex-col">
                        <span>Active Batches</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Monthly partner disbursements
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted">
                        Phase 2
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm font-semibold">
                      <div className="flex flex-col">
                        <span>Scheduled Transfers</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Awaiting threshold confirmation
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted">
                        Phase 2
                      </span>
                    </div>

                    <div className="p-4 bg-primary/10 rounded-xl mt-6 border border-primary/20">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Real-time payout visibility is currently locked.
                        Integration with the Payout Automation engine is
                        scheduled for the next release cycle.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </TLSection>
    </div>
  );
}
