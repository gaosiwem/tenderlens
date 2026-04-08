import { apiFetch } from "@/lib/api";

export async function startSmsVerification(phoneNumber: string) {
  return apiFetch<{
    verificationId: string;
    expiresAt: string;
    phoneNumber: string;
  }>("/api/v1/sms/start", {
    method: "POST",
    body: JSON.stringify({ phoneNumber }),
  });
}

export async function verifySmsOtp(verificationId: string, otp: string) {
  return apiFetch<{ verified: boolean; phoneNumber: string }>(
    "/api/v1/sms/verify",
    {
      method: "POST",
      body: JSON.stringify({ verificationId, otp }),
    },
  );
}
