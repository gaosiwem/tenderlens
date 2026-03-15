"use client";

import { FileText, Download, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { OrgInvoice } from "@/lib/invoices.types";
import { TLButton } from "@/components/tenderlens/button";

function money(cents: number | null, currency: string | null) {
  if (cents === null) return "-";
  const cur = (currency ?? "USD").toUpperCase();
  const amt = (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: cur,
  });
  return amt;
}

export function TLInvoiceList(props: { items: OrgInvoice[] }) {
  return (
    <Card className="tl-surface border-border/50">
      <CardContent className="p-0">
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-display text-sm font-extrabold">
              Invoice History
            </h3>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase tracking-wider">
            Latest {props.items.length}
          </span>
        </div>

        {props.items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground italic">
              No invoices found for this organization.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {props.items.map((inv) => (
              <div
                key={inv.stripeInvoiceId}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">
                      {new Date(inv.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-tight ${
                        inv.status === "paid"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                      }`}
                    >
                      {inv.status ?? "pending"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    Total {money(inv.amountPaid || inv.amountDue, inv.currency)}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {inv.hostedInvoiceUrl ? (
                    <a
                      href={inv.hostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <TLButton
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Details
                      </TLButton>
                    </a>
                  ) : null}
                  {inv.invoicePdf ? (
                    <a href={inv.invoicePdf} target="_blank" rel="noreferrer">
                      <TLButton
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Download className="w-3 h-3" />
                        PDF
                      </TLButton>
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
