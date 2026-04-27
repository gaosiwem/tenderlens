"use client";

import * as React from "react";
import {
  CalendarDays,
  CheckSquare,
  CircleAlert,
  FileText,
  GitCompareArrows,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const sectionMeta: Record<
  string,
  { title: string; icon: React.ReactNode; accent: string }
> = {
  deadlines: {
    title: "Deadlines",
    icon: <CalendarDays className="size-4" />,
    accent: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  },
  eligibility: {
    title: "Eligibility Requirements",
    icon: <ShieldCheck className="size-4" />,
    accent: "text-sky-600 bg-sky-500/10 border-sky-500/20",
  },
  documents: {
    title: "Required Documents",
    icon: <FileText className="size-4" />,
    accent: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
  },
  scope: {
    title: "Scope Of Work",
    icon: <GitCompareArrows className="size-4" />,
    accent: "text-violet-600 bg-violet-500/10 border-violet-500/20",
  },
  qualification_fit_tender_a: {
    title: "Tender A Fit",
    icon: <CheckSquare className="size-4" />,
    accent: "text-primary bg-primary/10 border-primary/20",
  },
  qualification_fit_tender_b: {
    title: "Tender B Fit",
    icon: <CheckSquare className="size-4" />,
    accent: "text-primary bg-primary/10 border-primary/20",
  },
  qualification_gaps: {
    title: "Critical Gaps",
    icon: <CircleAlert className="size-4" />,
    accent: "text-rose-600 bg-rose-500/10 border-rose-500/20",
  },
  summary: {
    title: "Executive Summary",
    icon: <Sparkles className="size-4" />,
    accent: "text-primary bg-primary/10 border-primary/20",
  },
};

const sectionOrder = [
  "summary",
  "deadlines",
  "eligibility",
  "documents",
  "scope",
  "qualification_fit_tender_a",
  "qualification_fit_tender_b",
  "qualification_gaps",
] as const;

function prettifyKey(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeText(value: string) {
  return value.replace(/\r/g, "").trim();
}

function isBulletLine(value: string) {
  return /^(\d+[\.\)]|[-*•])\s+/.test(value.trim());
}

function stripBulletPrefix(value: string) {
  return value.trim().replace(/^(\d+[\.\)]|[-*•])\s+/, "");
}

function renderStringContent(value: string) {
  const text = normalizeText(value);
  if (!text) {
    return <div className="text-sm text-muted-foreground">No details provided.</div>;
  }

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
      {paragraphs.map((paragraph, index) => {
        const lines = paragraph
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length > 0 && lines.every(isBulletLine)) {
          return (
            <ul
              key={`${paragraph}-${index}`}
              className="space-y-2 pl-5 text-muted-foreground list-disc marker:text-primary"
            >
              {lines.map((line) => (
                <li key={line}>{stripBulletPrefix(line)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`${paragraph}-${index}`} className="text-muted-foreground">
            {lines.join(" ")}
          </p>
        );
      })}
    </div>
  );
}

function renderPrimitive(value: unknown) {
  if (typeof value === "string") return renderStringContent(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return <div className="text-sm text-muted-foreground">{String(value)}</div>;
  }
  if (value === null || value === undefined) {
    return <div className="text-sm text-muted-foreground">No details provided.</div>;
  }
  return null;
}

function renderStructuredValue(value: unknown): React.ReactNode {
  const primitive = renderPrimitive(value);
  if (primitive) return primitive;

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <div className="text-sm text-muted-foreground">No details provided.</div>;
    }
    return (
      <ul className="space-y-2 pl-5 text-sm text-muted-foreground list-disc marker:text-primary">
        {value.map((item, index) => (
          <li key={index}>
            {typeof item === "string" || typeof item === "number" || typeof item === "boolean"
              ? String(item)
              : renderStructuredValue(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <div className="text-sm text-muted-foreground">No details provided.</div>;
    }
    return (
      <div className="space-y-3">
        {entries.map(([key, nestedValue]) => (
          <div key={key} className="rounded-lg border border-border/70 bg-background/70 p-3">
            <div className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground">
              {prettifyKey(key)}
            </div>
            {renderStructuredValue(nestedValue)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
      {String(value)}
    </div>
  );
}

function sectionCard(title: string, body: unknown, accent: string, icon: React.ReactNode) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className={`inline-flex rounded-lg border px-2.5 py-1 ${accent}`}>
          {icon}
        </div>
        <div className="font-display text-sm font-extrabold tracking-tight">
          {title}
        </div>
      </div>
      {renderStructuredValue(body)}
    </div>
  );
}

export function TLCompareResult(props: { result: unknown }) {
  const r =
    props.result && typeof props.result === "object"
      ? (props.result as Record<string, unknown>)
      : {};
  const keys = Object.keys(r);
  const orderedKeys = [
    ...sectionOrder.filter((key) => key in r),
    ...keys.filter((key) => !sectionOrder.includes(key as (typeof sectionOrder)[number])),
  ];
  const summary = r.summary;

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-5">
        <div className="font-display text-sm font-extrabold">
          Comparison Result
        </div>
        <div className="text-xs text-muted-foreground">
          AI-generated comparison rewritten into readable sections. Verify
          important decisions against the official tender documents.
        </div>

        {summary ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="mb-3 flex items-center gap-2 font-display text-base font-extrabold tracking-tight text-primary">
              <Sparkles className="size-4" />
              {sectionMeta.summary.title}
            </div>
            {renderStructuredValue(summary)}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {orderedKeys
            .filter((key) => key !== "summary")
            .map((key) => {
              const meta = sectionMeta[key] ?? {
                title: prettifyKey(key),
                icon: <FileText className="size-4" />,
                accent: "text-primary bg-primary/10 border-primary/20",
              };

              return (
                <div key={key}>
                  {sectionCard(meta.title, r[key], meta.accent, meta.icon)}
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
