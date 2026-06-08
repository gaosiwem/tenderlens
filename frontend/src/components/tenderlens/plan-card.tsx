"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import {
  formatPlanDisplayName,
  type PlanType,
  type Subscription,
} from "@/lib/billing.types";
import { Check } from "lucide-react";

export function TLPlanCard(props: {
  plan: PlanType;
  priceLabel: string;
  features: string[];
  ctaLabel: string;
  onCta: () => void;
  current?: Subscription | null;
  loading?: boolean;
  highlight?: boolean;
  title?: string;
  audienceLabel?: string;
  description?: string;
  billingNote?: string;
  highlightLabel?: string;
}) {
  const isCurrent =
    props.current?.plan === props.plan &&
    (props.current?.status === "ACTIVE" ||
      props.current?.status === "TRIALING");

  return (
    <Card
      className={`tl-surface h-full relative overflow-hidden border-border/70 ${
        props.highlight
          ? "ring-2 ring-primary shadow-2xl shadow-primary/15 bg-card"
          : "bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))]"
      }`}
    >
      {props.highlight && (
        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-bl-lg shadow-lg shadow-primary/25">
          {props.highlightLabel ?? "Recommended"}
        </div>
      )}
      <CardContent className="relative flex h-full flex-col space-y-6 p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-display text-xl font-extrabold tracking-tight text-foreground">
              {props.title ??
                formatPlanDisplayName(props.plan, props.current?.status)}
            </div>
            {isCurrent && (
              <TLCodeBadge
                value="Active"
                className="bg-green-500/10 text-green-500 border-green-500/20"
              />
            )}
          </div>
          <div
            className={`font-display text-3xl font-extrabold tracking-tight ${
              props.highlight ? "text-primary" : "text-foreground"
            }`}
          >
            {props.priceLabel}
          </div>
          {props.audienceLabel ? (
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {props.audienceLabel}
            </div>
          ) : null}
          {props.description ? (
            <div className="text-sm leading-6 text-muted-foreground">
              {props.description}
            </div>
          ) : null}
        </div>

        <div className="flex-1 space-y-3">
          {props.features.map((f) => (
            <div
              key={f}
              className={`group flex items-start gap-2 rounded-2xl px-3 py-2 ${
                props.highlight ? "bg-primary/5" : "bg-background/55"
              }`}
            >
              <div className="mt-0.5 rounded-full bg-primary/10 p-0.5">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground leading-tight">
                {f}
              </span>
            </div>
          ))}
        </div>

        {props.billingNote ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs leading-5 text-muted-foreground ${
              props.highlight
                ? "border-primary/20 bg-primary/5"
                : "border-border/70 bg-background/70"
            }`}
          >
            {props.billingNote}
          </div>
        ) : null}

        <TLButton
          onClick={props.onCta}
          disabled={isCurrent}
          loading={props.loading}
          className="w-full"
          variant={props.highlight ? "default" : "secondary"}
        >
          {isCurrent ? "Current Plan" : props.ctaLabel}
        </TLButton>
      </CardContent>
    </Card>
  );
}
