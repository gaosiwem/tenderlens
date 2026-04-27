"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TLButton } from "@/components/tenderlens/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type HeroAction = {
  href: string;
  label: string;
  variant?: React.ComponentProps<typeof TLButton>["variant"];
};

export function TLDashboardHero(props: {
  greeting: string;
  headline: string;
  description: string;
  planLabel: string;
  planTone?: "default" | "secondary" | "warning" | "success" | "danger";
  roleLabel: string;
  activeOrgLabel: string;
  verificationLabel: string;
  readinessLabel: string;
  actions: HeroAction[];
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(19,91,236,0.18),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.94),rgba(238,245,255,0.92))] p-6 shadow-xl shadow-primary/5 dark:bg-[radial-gradient(circle_at_top_left,rgba(19,91,236,0.22),transparent_35%),linear-gradient(135deg,rgba(16,22,34,0.98),rgba(10,18,30,0.95))] sm:p-8">
      <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-24 w-full bg-[linear-gradient(90deg,rgba(19,91,236,0.09),transparent_30%,rgba(19,91,236,0.03))]" />

      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px] xl:items-end">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
              <Sparkles className="mr-1.5 h-3 w-3" />
              Tender Ops Command Desk
            </Badge>
            <Badge variant={props.planTone ?? "secondary"}>{props.planLabel}</Badge>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold tracking-[0.18em] text-muted-foreground">
              {props.greeting}
            </div>
            <div className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {props.headline}
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {props.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="outline" className="border-border/70 bg-background/70 px-3 py-1">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              {props.activeOrgLabel}
            </Badge>
            <Badge variant="outline" className="border-border/70 bg-background/70 px-3 py-1">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              {props.roleLabel}
            </Badge>
            <Badge variant="outline" className="border-border/70 bg-background/70 px-3 py-1">
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              {props.verificationLabel}
            </Badge>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {props.actions.map((action, index) => (
              <Link key={action.href + action.label} href={action.href}>
                <TLButton
                  variant={action.variant ?? (index === 0 ? "default" : "secondary")}
                  className={cn(
                    "min-w-[180px]",
                    index === 0 && "shadow-lg shadow-primary/20",
                  )}
                  rightIcon={index === 0 ? <ArrowRight className="h-4 w-4" /> : undefined}
                >
                  {action.label}
                </TLButton>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <HeroPanel label="Active organization" value={props.activeOrgLabel} />
          <HeroPanel label="Account readiness" value={props.readinessLabel} />
          <HeroPanel label="Current plan" value={props.planLabel} />
        </div>
      </div>
    </section>
  );
}

function HeroPanel(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/75 p-4 backdrop-blur">
      <div className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
        {props.label}
      </div>
      <div className="mt-2 font-display text-lg font-extrabold tracking-tight text-foreground">
        {props.value}
      </div>
    </div>
  );
}
