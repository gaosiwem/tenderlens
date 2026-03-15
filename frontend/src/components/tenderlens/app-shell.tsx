"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TenderLensSidebar } from "./sidebar";
import { TenderLensAppHeader } from "./app-header";

export function TenderLensAppShell(props: {
  title?: React.ReactNode;
  subtitle?: string;
  description?: string;
  badges?: React.ReactNode[];
  actions?: React.ReactNode;
  showSearch?: boolean;
  children: React.ReactNode;
  className?: string;
  contentWidth?: "default" | "wide" | "full";
}) {
  const resolvedContentWidth = props.contentWidth ?? "wide";
  const contentWidthClass =
    resolvedContentWidth === "full"
      ? "max-w-none"
      : resolvedContentWidth === "wide"
        ? "max-w-[1720px]"
        : "max-w-[1320px]";

  return (
    <div
      className={cn("min-h-screen overflow-x-hidden bg-background", props.className)}
    >
      <div className={cn("mx-auto px-4", contentWidthClass)}>
        <div className="grid grid-cols-1 gap-4 py-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="hidden lg:sticky lg:top-4 lg:block lg:h-[calc(100dvh-2rem)]">
            <TenderLensSidebar />
          </div>
          <div className="flex min-w-0 flex-col pb-16">
            <TenderLensAppHeader
              title={props.title}
              subtitle={props.subtitle}
              description={props.description}
              badges={props.badges}
              actions={props.actions}
              showSearch={props.showSearch}
            />
            <main className="mt-4 space-y-6 pb-6">{props.children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
