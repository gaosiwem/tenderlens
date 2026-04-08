"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function TLDashboardMetricCard(props: {
  label: string;
  value: string;
  sublabel: string;
  icon: LucideIcon;
  accentClassName?: string;
}) {
  const Icon = props.icon;

  return (
    <Card className="tl-surface relative overflow-hidden">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary via-primary/70 to-primary/20",
          props.accentClassName,
        )}
      />
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {props.label}
            </div>
            <div className="mt-3 font-display text-3xl font-extrabold tracking-tight">
              {props.value}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {props.sublabel}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-primary/10 p-3 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
