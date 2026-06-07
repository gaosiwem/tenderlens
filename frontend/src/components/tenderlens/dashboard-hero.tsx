"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TLButton } from "@/components/tenderlens/button";
import { cn } from "@/lib/utils";

type HeroAction = {
  href: string;
  label: string;
  variant?: React.ComponentProps<typeof TLButton>["variant"];
};

export function TLDashboardHero(props: {
  greeting: string;
  headline: string;
  description: string;
  activeOrgLabel: string;
  actions: HeroAction[];
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
      <div className="max-w-3xl space-y-5">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-muted-foreground">
            {props.greeting}
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {props.headline}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {props.description}
          </p>
        </div>

        <div className="text-sm text-muted-foreground">
          Active organization:{" "}
          <span className="font-semibold text-foreground">
            {props.activeOrgLabel}
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {props.actions.map((action, index) => (
            <Link key={action.href + action.label} href={action.href}>
              <TLButton
                variant={action.variant ?? (index === 0 ? "default" : "secondary")}
                className={cn("min-w-[180px]", index === 0 && "justify-between")}
                rightIcon={index === 0 ? <ArrowRight className="h-4 w-4" /> : undefined}
              >
                {action.label}
              </TLButton>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
