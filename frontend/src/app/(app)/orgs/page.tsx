"use client";

import * as React from "react";
import { toast } from "sonner";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TLTableShell } from "@/components/tenderlens/table-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TLEmptyState } from "@/components/tenderlens/empty-state";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { Org } from "@/lib/types";

export default function OrgsPage() {
  const auth = useAuth();
  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const activeOrgId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("tl_active_org_id")
      : null;

  async function createOrg() {
    if (!name.trim()) return toast.error("Missing org name");
    setCreating(true);

    const res = await apiFetch<Org>("/api/v1/orgs", {
      method: "POST",
      body: JSON.stringify({ name }),
    });

    setCreating(false);

    if (!res.ok)
      return toast.error("Failed to create org", {
        description: res.error.message,
      });

    window.localStorage.setItem("tl_active_org_id", res.data.id);
    toast.success("Organization created", {
      description: "Active org updated.",
    });
    setName("");
    await auth.refreshMe();
  }

  function setActive(orgId: string) {
    window.localStorage.setItem("tl_active_org_id", orgId);
    toast.message("Active organization updated");
    auth.refreshMe();
  }

  const orgs = auth.me?.orgs ?? [];

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Organizations">
      <TLSection
        title="Create organization"
        description="This creates a tenant workspace. You will be the OWNER."
      >
        <Card className="tl-surface">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization name</Label>
              <Input
                id="orgName"
                className="h-10"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <TLButton disabled={creating} onClick={createOrg}>
              Create org
            </TLButton>
          </CardContent>
        </Card>
      </TLSection>

      <TLSection
        title="Your organizations"
        description="Select one to become the active org context."
      >
        {orgs.length === 0 ? (
          <TLEmptyState
            title="No organizations"
            description="Create your first organization above."
          />
        ) : (
          <TLTableShell title="Organizations">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((o) => (
                  <TableRow key={o.org.id}>
                    <TableCell className="font-semibold">
                      {o.org.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.org.slug}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.role}
                    </TableCell>
                    <TableCell className="text-right">
                      {activeOrgId === o.org.id ? (
                        <span className="text-xs font-semibold text-primary">
                          Active
                        </span>
                      ) : (
                        <TLButton
                          variant="secondary"
                          onClick={() => setActive(o.org.id)}
                        >
                          Set active
                        </TLButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TLTableShell>
        )}
      </TLSection>
    </TenderLensAppShell>
  );
}
