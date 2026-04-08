import { apiFetch } from "./api";

export async function requestPasswordReset(email: string) {
  return apiFetch<{ message: string }>("/api/v1/auth/request-password-reset", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string) {
  return apiFetch<{}>("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function verifyEmail(token: string) {
  return apiFetch<{}>("/api/v1/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification(email: string) {
  return apiFetch<{}>("/api/v1/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function completeInvitePassword(
  email: string,
  temporaryPassword: string,
  newPassword: string,
) {
  return apiFetch<{ accessToken: string }>("/api/v1/auth/complete-invite-password", {
    method: "POST",
    body: JSON.stringify({ email, temporaryPassword, newPassword }),
  });
}
