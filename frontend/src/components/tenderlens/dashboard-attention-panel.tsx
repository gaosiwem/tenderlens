"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
} from "lucide-react";

export type AttentionItem = {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  tone?: "warning" | "default" | "success";
};

export function TLDashboardAttentionPanel(props: {
  items: AttentionItem[];
}) {
  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-4">
        {props.items.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-border/70 bg-background/60 p-4"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <AttentionBadge tone={item.tone} />
                  <div className="font-display text-base font-extrabold tracking-tight">
                    {item.title}
                  </div>
                </div>
                <div className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {item.description}
                </div>
              </div>
              <Link href={item.href}>
                <TLButton variant="secondary" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  {item.ctaLabel}
                </TLButton>
              </Link>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AttentionBadge(props: { tone?: "warning" | "default" | "success" }) {
  if (props.tone === "success") {
    return (
      <Badge variant="success" className="gap-1.5">
        <CheckCircle2 className="h-3 w-3" />
        Ready
      </Badge>
    );
  }

  if (props.tone === "warning") {
    return (
      <Badge variant="warning" className="gap-1.5">
        <AlertTriangle className="h-3 w-3" />
        Needs action
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1.5">
      <Clock3 className="h-3 w-3" />
      Next up
    </Badge>
  );
}
