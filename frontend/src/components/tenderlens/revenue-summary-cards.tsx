"use client";

import { Card, CardContent } from "@/components/ui/card";

function moneyZar(cents: number) {
  const amt = (cents / 100).toFixed(2);
  return `ZAR ${amt}`;
}

export function TLRevenueSummaryCards(props: {
  windowDays: number;
  revenueCents: number;
  mrrEstimateCents: number;
  churned: number;
  activeSubscriptions: number;
  partnerAttributedUpgrades: number;
}) {
  const cards = [
    {
      label: "MRR estimate",
      value: moneyZar(props.mrrEstimateCents),
      sub: `based on last ${props.windowDays} days`,
    },
    {
      label: "Revenue",
      value: moneyZar(props.revenueCents),
      sub: `window ${props.windowDays} days`,
    },
    {
      label: "Active subs",
      value: String(props.activeSubscriptions),
      sub: "currently active",
    },
    {
      label: "Churned",
      value: String(props.churned),
      sub: `last ${props.windowDays} days`,
    },
    {
      label: "Partner upgrades",
      value: String(props.partnerAttributedUpgrades),
      sub: `last ${props.windowDays} days`,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((c, i) => (
        <Card
          key={c.label}
          className="tl-surface border-border/40 bg-linear-to-br from-background via-background to-muted/10 shadow-xl shadow-black/5 overflow-hidden group hover:border-primary/30 transition-all duration-500 animate-in fade-in fill-mode-both"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <CardContent className="p-8 relative">
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />

            <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground/60 uppercase mb-4">
              {c.label}
            </div>
            <div className="font-display text-4xl font-extrabold mt-2 tracking-tight transition-transform group-hover:scale-[1.02] duration-500">
              {c.value}
            </div>
            <div className="text-xs font-medium text-muted-foreground/50 mt-3 flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-primary/40" />
              {c.sub}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
