"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TLButton } from "@/components/tenderlens/button";
import { BrandLogo } from "@/components/tenderlens/brand-logo";
import { requestPasswordReset } from "@/lib/auth.api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[520px] px-4 py-10">
        <Card className="tl-surface">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-4">
              <BrandLogo size="auth" priority className="mx-auto" />
              <div className="font-display text-2xl font-extrabold">
                Reset password
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Enter your email and we will send a reset link.
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                className="h-10 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>

            <TLButton
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                const res = await requestPasswordReset(email);
                setLoading(false);
                if (!res.ok) {
                  toast.error("Request failed", {
                    description: res.error.message,
                  });
                  return;
                }
                toast.success("If that email exists, a reset link has been sent.");
              }}
            >
              Send reset link
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
