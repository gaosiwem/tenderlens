"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/tenderlens/brand-logo";
import { TLButton } from "@/components/tenderlens/button";
import { TLPasswordInput } from "@/components/tenderlens/password-input";
import { resetPassword } from "@/lib/auth.api";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[520px] px-4 py-10">
        <Card className="tl-surface">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-4">
              <BrandLogo size="auth" priority className="mx-auto" />
              <div className="font-display text-2xl font-extrabold">
                Set new password
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Enter a new password for your account.
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <TLPasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
              />
            </div>

            <TLButton
              disabled={loading || !token}
              onClick={async () => {
                if (!token) {
                  toast.error("Missing reset token");
                  return;
                }
                setLoading(true);
                const res = await resetPassword(token, password);
                setLoading(false);
                if (!res.ok) {
                  toast.error("Reset failed", { description: res.error.message });
                  return;
                }
                toast.success("Password updated");
                router.push("/auth/login");
              }}
            >
              Update password
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
