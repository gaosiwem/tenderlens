"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TLButton } from "@/components/tenderlens/button";
import { BrandLogo } from "@/components/tenderlens/brand-logo";
import { TLPasswordInput } from "@/components/tenderlens/password-input";
import { useAuth } from "@/lib/auth";
import { completeInvitePassword } from "@/lib/auth.api";
import { setAccessToken } from "@/lib/api";
import { GoogleLogin } from "@react-oauth/google";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const [changingPassword, setChangingPassword] = React.useState(false);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [mustChangePassword, setMustChangePassword] = React.useState(false);
  const [temporaryPassword, setTemporaryPassword] = React.useState("");
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

  React.useEffect(() => {
    const invitedEmail = searchParams.get("email");
    if (invitedEmail) {
      setEmail(invitedEmail);
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hostname !== "127.0.0.1") return;

    const redirectUrl = new URL(window.location.href);
    redirectUrl.hostname = "localhost";
    window.location.replace(redirectUrl.toString());
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[520px] space-y-6">
        <div className="flex justify-center">
          <BrandLogo size="auth" priority className="mx-auto" />
        </div>
        <Card className="tl-surface mx-auto">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-4 text-center">
              <div className="font-display text-2xl font-extrabold">
                Sign in
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Sign in to continue with your tenders, workspace, and team.
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

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <TLPasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <TLButton
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                const res = await auth.login(email, password);
                setLoading(false);
                if (!res.ok) {
                  if (res.code === "EMAIL_NOT_VERIFIED") {
                    router.push(
                      `/auth/verify-email?email=${encodeURIComponent(email)}`,
                    );
                  }
                  if (res.code === "PASSWORD_CHANGE_REQUIRED") {
                    setMustChangePassword(true);
                    setTemporaryPassword(password);
                    return;
                  }
                  return toast.error("Login failed", {
                    description: res.message,
                  });
                }
                toast.success("Welcome back");
                router.push("/dashboard");
              }}
            >
              Sign in
            </TLButton>

            {mustChangePassword ? (
              <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="text-sm font-semibold text-foreground">
                  Change temporary password
                </div>
                <div className="text-xs text-muted-foreground">
                  This account uses a temporary password. Set a new password to
                  continue.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <TLPasswordInput
                    id="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <TLPasswordInput
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                  />
                </div>
                <TLButton
                  disabled={changingPassword}
                  onClick={async () => {
                    if (newPassword.length < 8) {
                      toast.error("Password must be at least 8 characters");
                      return;
                    }
                    if (newPassword !== confirmPassword) {
                      toast.error("Passwords do not match");
                      return;
                    }

                    setChangingPassword(true);
                    const res = await completeInvitePassword(
                      email,
                      temporaryPassword,
                      newPassword,
                    );
                    setChangingPassword(false);

                    if (!res.ok) {
                      toast.error("Could not update password", {
                        description: res.error.message,
                      });
                      return;
                    }

                    setAccessToken(res.data.accessToken);
                    await auth.refreshMe();
                    toast.success("Password updated");
                    router.push("/dashboard");
                  }}
                >
                  {changingPassword ? "Updating..." : "Change password & continue"}
                </TLButton>
              </div>
            ) : null}

            {googleEnabled ? (
              <div className="pt-1">
                <GoogleLogin
                  logo_alignment="left"
                  onSuccess={async (credentialResponse) => {
                    const credential = credentialResponse.credential;
                    if (!credential) {
                      toast.error("Google sign-in failed");
                      return;
                    }
                    const res = await auth.loginWithGoogle(credential);
                    if (!res.ok) {
                      toast.error("Google sign-in failed", {
                        description: res.message,
                      });
                      return;
                    }
                    toast.success("Welcome back");
                    router.push("/dashboard");
                  }}
                  onError={() => {
                    toast.error("Google sign-in failed");
                  }}
                />
              </div>
            ) : null}

            <div className="text-sm">
              <Link
                className="text-foreground font-semibold hover:underline"
                href="/auth/forgot-password"
              >
                Forgot password?
              </Link>
            </div>

            <div className="text-sm text-muted-foreground">
              No account yet.{" "}
              <Link
                className="text-foreground font-semibold hover:underline"
                href="/auth/register"
              >
                Create one
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
