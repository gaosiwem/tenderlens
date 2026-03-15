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

export default function RegisterPage() {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[520px] px-4 py-10">
        <Card className="tl-surface">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-4">
              <BrandLogo size="auth" priority className="mx-auto" />
              <div className="font-display text-2xl font-extrabold">
                Create account
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Use your work email to get started.
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                className="h-10 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
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
              <div className="text-xs text-muted-foreground">
                Minimum 8 characters.
              </div>
            </div>

            <TLButton
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                const res = await auth.register(email, password, name);
                setLoading(false);
                if (!res.ok)
                  return toast.error("Registration failed", {
                    description: res.message,
                  });
                toast.success("Account created", {
                  description: "Check your inbox and verify your email, then sign in.",
                });
                router.push("/auth/login");
              }}
            >
              Create account
            </TLButton>

            <div className="text-sm text-muted-foreground">
              Already have an account.{" "}
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
