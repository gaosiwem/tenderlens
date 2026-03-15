"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { resendVerification, verifyEmail } from "@/lib/auth.api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";
  const [loading, setLoading] = React.useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[520px] px-4 py-10">
        <Card className="tl-surface">
          <CardContent className="p-6 space-y-5">
            <div>
              <div className="font-display text-2xl font-extrabold">
                Verify your email
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Confirm your email address to finish account setup.
              </div>
            </div>

            <TLButton
              disabled={loading || !token}
              onClick={async () => {
                if (!token) {
                  toast.error("Missing verification token");
                  return;
                }
                setLoading(true);
                const res = await verifyEmail(token);
                setLoading(false);
                if (!res.ok) {
                  toast.error("Verification failed", {
                    description: res.error.message,
                  });
                  return;
                }
                toast.success("Email verified. You can now sign in.");
              }}
            >
              Verify email
            </TLButton>

            <TLButton
              variant="secondary"
              disabled={loading || !email}
              onClick={async () => {
                if (!email) {
                  toast.error("Email is required to resend verification.");
                  return;
                }
                setLoading(true);
                const res = await resendVerification(email);
                setLoading(false);
                if (!res.ok) {
                  toast.error("Failed to resend", {
                    description: res.error.message,
                  });
                  return;
                }
                toast.success("Verification email sent.");
              }}
            >
              Resend verification
            </TLButton>

            <div className="text-sm text-muted-foreground">
              Back to{" "}
              <Link
                className="text-foreground font-semibold hover:underline"
                href="/auth/login"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
