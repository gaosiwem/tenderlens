"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import type { ChecklistItem } from "@/lib/onboarding.api";
import { completeChecklistItem } from "@/lib/onboarding.api";
import { CheckCircle2, Circle } from "lucide-react";

export function TLOnboardingChecklist(props: {
  items: ChecklistItem[];
  onChanged: () => Promise<void> | void;
}) {
  async function complete(key: string) {
    const r = await completeChecklistItem(key);
    if (!r.ok) {
      toast.error("Failed", { description: r.error.message });
      return;
    }
    toast.success("Completed");
    props.onChanged();
  }

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-4">
        <div>
          <div className="font-display text-sm font-extrabold">
            Trial checklist
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Complete these to see value quickly.
          </div>
        </div>

        <div className="grid gap-2">
          {props.items.map((it) => (
            <div
              key={it.key}
              className="border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                {it.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-sm font-semibold">{it.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {it.description}
                  </div>
                </div>
              </div>
              <TLButton
                variant={it.completed ? "secondary" : "default"}
                onClick={() => complete(it.key)}
                disabled={it.completed}
              >
                {it.completed ? "Done" : "Mark done"}
              </TLButton>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
