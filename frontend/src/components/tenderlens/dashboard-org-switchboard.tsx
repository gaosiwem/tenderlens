"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { Badge } from "@/components/ui/badge";
import type { MeResponse } from "@/lib/types";
import { Building2, CheckCircle2, ChevronsUpDown } from "lucide-react";

export function TLDashboardOrgSwitchboard(props: {
  orgs: MeResponse["orgs"];
  activeOrgId: string | null;
  onSelectOrg: (orgId: string) => Promise<void> | void;
}) {
  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-4">
        <div className="space-y-1">
          <div className="font-display text-lg font-extrabold">
            Organization Switchboard
          </div>
          <div className="text-sm text-muted-foreground">
            Review your organizations and switch context without leaving the dashboard.
          </div>
        </div>

        <div className="space-y-3">
          {props.orgs.map((membership) => {
            const isActive = membership.org.id === props.activeOrgId;
            return (
              <div
                key={membership.org.id}
                className="rounded-2xl border border-border/70 bg-background/60 p-4"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="rounded-xl border border-border/70 bg-primary/10 p-2 text-primary">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-display text-base font-extrabold tracking-tight">
                            {membership.org.name}
                          </div>
                          <div className="truncate text-xs tracking-[0.18em] text-muted-foreground">
                            {membership.org.slug}
                          </div>
                        </div>
                      </div>
                    </div>
                    {isActive ? (
                      <Badge variant="success" className="shrink-0 gap-1.5">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      Role: <span className="font-semibold text-foreground">{membership.role}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isActive ? (
                        <TLButton
                          variant="secondary"
                          onClick={() => void props.onSelectOrg(membership.org.id)}
                          leftIcon={<ChevronsUpDown className="h-4 w-4" />}
                        >
                          Set Active
                        </TLButton>
                      ) : null}
                      <Link href="/orgs">
                        <TLButton variant="ghost">View</TLButton>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
