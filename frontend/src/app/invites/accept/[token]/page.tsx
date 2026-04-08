"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { BrandLogo } from "@/components/tenderlens/brand-logo";
import { acceptInviteAnonymous, getInviteInfo } from "@/lib/invites.api";

type InvitePreview = {
  token: string;
  email: string;
  role: string;
  expiresAt: string;
  org: { id: string; name: string };
};

function formatExpiry(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export default function AcceptInvitePage() {
  const params = useParams();
  const token = String(params.token);
  const [loadingInfo, setLoadingInfo] = React.useState(true);
  const [accepting, setAccepting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [invite, setInvite] = React.useState<InvitePreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [acceptedEmail, setAcceptedEmail] = React.useState<string | null>(null);
  const [createdProvisional, setCreatedProvisional] = React.useState(false);

  const loadInvite = React.useCallback(async () => {
    setLoadingInfo(true);
    const res = await getInviteInfo(token);
    setLoadingInfo(false);

    if (!res.ok) {
      setError(res.error.message || "This invitation is not valid.");
      return;
    }

    setInvite(res.data);
    setError(null);
  }, [token]);

  React.useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  async function accept() {
    setAccepting(true);
    const res = await acceptInviteAnonymous(token);
    setAccepting(false);

    if (!res.ok) {
      toast.error("Invite failed", { description: res.error.message });
      setError(res.error.message || "Unable to accept invitation.");
      return;
    }

    setDone(true);
    setAcceptedEmail(res.data.email);
    setCreatedProvisional(Boolean(res.data.provisionalAccountCreated));
    toast.success("Invitation accepted");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[620px] px-4 py-10">
        <Card className="tl-surface">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <BrandLogo size="auth" priority className="mx-auto" />
              <div className="font-display text-2xl font-extrabold">
                Accept invitation
              </div>
              <div className="text-sm text-muted-foreground">
                Confirm your invitation to join your team on TenderLens.
              </div>
            </div>

            {loadingInfo ? (
              <div className="text-sm text-muted-foreground animate-pulse">
                Checking invitation...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : invite ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
                  <div>
                    <strong>Organization:</strong> {invite.org.name}
                  </div>
                  <div>
                    <strong>Email:</strong> {invite.email}
                  </div>
                  <div>
                    <strong>Role:</strong> {invite.role}
                  </div>
                  <div>
                    <strong>Expires:</strong> {formatExpiry(invite.expiresAt)}
                  </div>
                </div>

                {!done ? (
                  <TLButton onClick={accept} disabled={accepting}>
                    {accepting ? "Accepting..." : "Accept invitation"}
                  </TLButton>
                ) : (
                  <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                    <div className="font-semibold text-foreground">
                      Invitation accepted
                    </div>
                    {createdProvisional ? (
                      <div className="text-muted-foreground">
                        A temporary password was sent to{" "}
                        <strong>{acceptedEmail ?? invite.email}</strong>. Sign
                        in with that temporary password, then you will be
                        prompted to change it.
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        You can now sign in using your existing account
                        credentials.
                      </div>
                    )}
                    <Link href={`/auth/login?email=${encodeURIComponent(acceptedEmail ?? invite.email)}`}>
                      <TLButton variant="secondary">Go to sign in</TLButton>
                    </Link>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
