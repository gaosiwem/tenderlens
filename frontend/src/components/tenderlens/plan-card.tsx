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
}) {
  const isCurrent =
    props.current?.plan === props.plan &&
    (props.current?.status === "ACTIVE" ||
      props.current?.status === "TRIALING");

  return (
    <Card
      className={`tl-surface h-full relative overflow-hidden ${props.highlight ? "ring-2 ring-primary" : ""}`}
    >
      {props.highlight && (
        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-bl-lg uppercase">
          Recommended
        </div>
      )}
      <CardContent className="p-6 flex flex-col h-full space-y-6">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="font-display text-xl font-extrabold tracking-tight">
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
          <div className="text-2xl font-bold font-display tracking-tight">
            {props.priceLabel}
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {props.features.map((f) => (
            <div key={f} className="flex items-start gap-2 group">
              <div className="mt-0.5 rounded-full bg-primary/10 p-0.5">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground leading-tight">
                {f}
              </span>
            </div>
          ))}
        </div>

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
