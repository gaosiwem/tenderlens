"use client";

import * as React from "react";
import { toast } from "sonner";
import { TrendingUp, Filter, Download } from "lucide-react";
import { TLSection } from "@/components/tenderlens/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TLAnalyticsSummary } from "@/components/tenderlens/analytics-summary";
import { getBillingEventSummary } from "@/lib/billing-analytics.api";
import { TLButton } from "@/components/tenderlens/button";

export default function BillingAnalyticsPage() {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<any[]>([]);
  const [days, setDays] = React.useState(14);

  async function loadData() {
    setLoading(true);
    const r = await getBillingEventSummary(days);
    setLoading(false);
    if (!r.ok) {
      toast.error("Analytics access denied", {
        description: "You might not have sufficient permissions.",
      });
      return;
    }
    setItems(r.data.items);
  }

  React.useEffect(() => {
    loadData();
  }, [days]);

  return (
    <div className="space-y-6">
      <TLSection
        title="Conversion Metrics"
        description="Monitor the health of your monetization funnel and track user upgrades."
        right={
          <div className="flex items-center gap-3">
            <select
              className="h-10 px-3 text-[10px] font-bold tracking-wider rounded-lg border bg-background text-foreground outline-none transition-all cursor-pointer"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>Last 7 Days</option>
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last Quarter</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              <TrendingUp className="w-3.5 h-3.5 mr-2" />
              Sync
            </Button>
          </div>
        }
      >
        <div className="grid gap-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="hover:border-blue-500/20 transition-all">
              <CardContent className="p-6 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-muted-foreground tracking-widest">
                  Pricing Views
                </span>
                <span className="text-3xl font-bold">
                  {items
                    .filter((i) => i.name === "pricing_viewed")
                    .reduce((acc, curr) => acc + curr.count, 0)}
                </span>
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-full" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:border-amber-500/20 transition-all">
              <CardContent className="p-6 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-muted-foreground tracking-widest">
                  Checkout Started
                </span>
                <span className="text-3xl font-bold text-amber-500">
                  {items
                    .filter((i) => i.name === "checkout_started")
                    .reduce((acc, curr) => acc + curr.count, 0)}
                </span>
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 w-[60%]" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:border-emerald-500/20 transition-all">
              <CardContent className="p-6 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-muted-foreground tracking-widest">
                  Conversions
                </span>
                <span className="text-3xl font-bold text-emerald-500">
                  {items
                    .filter((i) => i.name === "checkout_completed")
                    .reduce((acc, curr) => acc + curr.count, 0)}
                </span>
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[30%]" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="border rounded-2xl p-2 bg-muted/30">
            <TLAnalyticsSummary items={items} />
          </div>

          <Card className="hover:border-primary/20 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Filter className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold">Advanced Export</p>
                  <p className="text-[10px] text-muted-foreground font-bold tracking-widest mt-1">
                    Generate full report for external stakeholders
                  </p>
                </div>
              </div>
              <TLButton variant="secondary" size="sm" className="px-6">
                <Download className="w-3.5 h-3.5 mr-2" />
                Report
              </TLButton>
            </CardContent>
          </Card>
        </div>
      </TLSection>
    </div>
  );
}
