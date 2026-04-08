"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { NotificationEvent } from "@/lib/notifications.types";
import { BellRing, Clock3 } from "lucide-react";

function formatSignalTitle(event: NotificationEvent) {
  const meta =
    event.meta && typeof event.meta === "object" && !Array.isArray(event.meta)
      ? (event.meta as Record<string, unknown>)
      : null;
  const kind = typeof meta?.kind === "string" ? meta.kind : "";
  const raw = kind || event.type || "SYSTEM_EVENT";
  return raw
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function TLDashboardSignalsCard(props: {
  events: NotificationEvent[];
}) {
  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-4">
        <div className="space-y-1">
          <div className="font-display text-lg font-extrabold">
            Recent Signals
          </div>
          <div className="text-sm text-muted-foreground">
            The latest commercial and product events touching this organization.
          </div>
        </div>

        {props.events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 p-6 text-sm text-muted-foreground">
            No recent signals yet. As reminders, retention nudges, and product
            events arrive, they will show up here.
          </div>
        ) : (
          <div className="space-y-3">
            {props.events.slice(0, 5).map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/60 p-4"
              >
                <div className="rounded-xl border border-border/70 bg-primary/10 p-2 text-primary">
                  <BellRing className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">
                    {formatSignalTitle(event)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <Clock3 className="h-3 w-3" />
                    {new Date(event.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
