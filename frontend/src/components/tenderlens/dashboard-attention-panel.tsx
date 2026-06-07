"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";

export type AttentionItem = {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  tone?: "warning" | "default" | "success";
};

export function TLDashboardAttentionPanel(props: { items: AttentionItem[] }) {
  if (props.items.length === 0) {
    return (
      <Card className="tl-surface">
        <CardContent className="p-5 text-sm text-muted-foreground">
          Nothing urgent right now. Browse open tenders when you are ready.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="tl-surface">
      <CardContent className="divide-y divide-border/70 p-0">
        {props.items.map((item) => (
          <div
            key={item.title}
            className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"
          >
            <div className="space-y-1">
              <div className="font-display text-base font-extrabold tracking-tight">
                {item.title}
              </div>
              <div className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {item.description}
              </div>
            </div>
            <Link href={item.href}>
              <TLButton
                variant={item.tone === "warning" ? "default" : "secondary"}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {item.ctaLabel}
              </TLButton>
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
