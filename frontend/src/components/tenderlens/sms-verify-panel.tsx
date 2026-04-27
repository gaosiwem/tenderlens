"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TLButton } from "@/components/tenderlens/button";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { startSmsVerification, verifySmsOtp } from "@/lib/sms.api";
import type { NotificationPrefs } from "@/lib/preferences.types";

export function TLSmsVerifyPanel(props: {
  prefs: NotificationPrefs;
  disabled?: boolean;
  onPatch: (p: Partial<NotificationPrefs>) => void;
  onReloadPrefs: () => Promise<void>;
}) {
  const [verificationId, setVerificationId] = React.useState<string | null>(
    null,
  );
  const [otp, setOtp] = React.useState("");
  const [starting, setStarting] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);

  const verifiedAt = props.prefs.whatsappVerifiedAt;

  async function start() {
    if (props.disabled) {
      toast.error("Upgrade required", {
        description: "SMS alerts are not available on your current plan.",
      });
      return;
    }
    const num = (props.prefs.whatsappNumber ?? "").trim();
    if (!num) {
      toast.error("Enter your phone number first");
      return;
    }

    setStarting(true);
    const res = await startSmsVerification(num);
    setStarting(false);

    if (!res.ok) {
      toast.error("Failed to send code", { description: res.error.message });
      return;
    }
    setVerificationId(res.data.verificationId);
    toast.success("Verification code sent");
  }

  async function verify() {
    if (props.disabled) {
      toast.error("Upgrade required", {
        description: "SMS alerts are not available on your current plan.",
      });
      return;
    }
    if (!verificationId) {
      toast.error("Start verification first");
      return;
    }
    const code = otp.trim();
    if (code.length < 4) {
      toast.error("Enter the code");
      return;
    }

    setVerifying(true);
    const res = await verifySmsOtp(verificationId, code);
    setVerifying(false);

    if (!res.ok) {
      toast.error("Verification failed", { description: res.error.message });
      return;
    }

    toast.success("SMS verified");
    setOtp("");
    setVerificationId(null);
    await props.onReloadPrefs();
  }

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-sm font-extrabold">SMS alerts</div>
            <div className="text-xs text-muted-foreground mt-1">
              Requires verification to prevent abuse. SMS alerts are subject to
              your subscription plan.
            </div>
          </div>
          <Switch
            checked={Boolean(props.prefs.whatsappEnabled)}
            onCheckedChange={(v) =>
              props.onPatch({ whatsappEnabled: Boolean(v) })
            }
            disabled={props.disabled}
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold tracking-wide text-muted-foreground ">
            Phone number
          </div>
          <Input
            className="h-11"
            value={props.prefs.whatsappNumber ?? ""}
            onChange={(e) => props.onPatch({ whatsappNumber: e.target.value })}
            placeholder='Example: "+27xxxxxxxxx"'
            disabled={props.disabled}
          />
          {verifiedAt ? (
            <div className="text-xs text-muted-foreground">
              Verified: {new Date(verifiedAt).toLocaleString()}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Not verified yet.
            </div>
          )}
          {props.disabled ? (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              SMS alerts are not available on your current plan.
            </div>
          ) : null}
        </div>

        {!verifiedAt ? (
          <div className="space-y-3">
            <TLInlineAlert
              title="Verification required"
              description="Tap Send code. You will receive an SMS OTP. Enter it below to verify."
              tone="neutral"
            />

            <div className="flex flex-col sm:flex-row gap-2">
              <TLButton onClick={start} disabled={starting || props.disabled}>
                {starting ? "Sending..." : "Send code"}
              </TLButton>

              {verificationId ? (
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <Input
                    className="h-11"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter OTP"
                  />
                  <TLButton
                    onClick={verify}
                    disabled={verifying || props.disabled}
                  >
                    {verifying ? "Verifying..." : "Verify"}
                  </TLButton>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
