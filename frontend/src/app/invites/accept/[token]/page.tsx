"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptInvite } from "@/lib/invites.api";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function accept() {
    setLoading(true);
    const res = await acceptInvite(token);
    setLoading(false);

    if (!res.ok) {
      toast.error("Invite failed", { description: res.error.message });
      return;
    }

    setDone(true);
    toast.success("Joined org");
    router.push("/settings/members");
  }

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Invite">
      <TLSection title="Accept invite" description="Join your team workspace.">
        <div className="border border-border rounded-2xl p-6 space-y-3">
          <div className="text-sm text-muted-foreground">
            Click accept to join the organization and access TenderLens.
          </div>
          <TLButton onClick={accept} disabled={loading || done}>
            {done ? "Accepted" : loading ? "Accepting..." : "Accept invite"}
          </TLButton>
        </div>
      </TLSection>
    </TenderLensAppShell>
  );
}
