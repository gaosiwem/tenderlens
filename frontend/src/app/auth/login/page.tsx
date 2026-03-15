"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TLButton } from "@/components/tenderlens/button";
import { BrandLogo } from "@/components/tenderlens/brand-logo";
import { TLPasswordInput } from "@/components/tenderlens/password-input";
import { useAuth } from "@/lib/auth";
import { GoogleLogin } from "@react-oauth/google";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hostname !== "127.0.0.1") return;

    const redirectUrl = new URL(window.location.href);
    redirectUrl.hostname = "localhost";
    window.location.replace(redirectUrl.toString());
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[520px] px-4 py-10">
        <Card className="tl-surface">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-4">
              <BrandLogo size="auth" priority className="mx-auto" />
              <div className="font-display text-2xl font-extrabold">
                Sign in
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Access your organizations and dashboard.
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
