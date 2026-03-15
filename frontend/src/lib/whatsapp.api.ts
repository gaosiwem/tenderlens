import { apiFetch } from "@/lib/api";

export async function startWhatsAppVerification(whatsappNumber: string) {
  return apiFetch<{ verificationId: string; expiresAt: string }>(
    "/api/v1/whatsapp/start",
    {
      method: "POST",
      body: JSON.stringify({ whatsappNumber }),
    },
  );
}

export async function verifyWhatsAppOtp(verificationId: string, otp: string) {
  return apiFetch<{ verified: boolean; whatsappNumber: string }>(
    "/api/v1/whatsapp/verify",
    {
      method: "POST",
      body: JSON.stringify({ verificationId, otp }),
    },
  );
}
