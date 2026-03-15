import * as React from "react";
import { cn } from "@/lib/utils";

export function TLSection(props: {
  title?: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", props.className)}>
      {props.title || props.right ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {props.title ? (
              <div className="font-display text-lg font-extrabold">
                {props.title}
              </div>
            ) : null}
            {props.description ? (
              <div className="mt-1 text-sm text-muted-foreground">
                {props.description}
              </div>
            ) : null}
          </div>
          {props.right ? <div className="shrink-0">{props.right}</div> : null}
        </div>
      ) : null}
      <div className="grid gap-4">{props.children}</div>
    </section>
  );
}
