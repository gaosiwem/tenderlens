import { env } from "../../config/env"
import { buildBrandedEmailLayout } from "./message.builder"

export function buildEmailVerificationContent(args: {
  verifyUrl: string
  expiresInHours: number
}) {
  const { text, html } = buildBrandedEmailLayout({
    title: "Verify your email",
    subtitle: "Confirm your email address to activate your TenderLens account.",
    details: [
      { label: "Action", value: "Email verification" },
      { label: "Expires", value: `In ${args.expiresInHours} hour(s)` },
      { label: "Account URL", value: env.FRONTEND_URL },
    ],
    ctaLabel: "Verify email",
    ctaUrl: args.verifyUrl,
  })

  return {
    subject: "Verify your TenderLens email",
    text,
    html,
  }
}

export function buildPasswordResetContent(args: {
  resetUrl: string
  expiresInHours: number
}) {
  const { text, html } = buildBrandedEmailLayout({
    title: "Reset your password",
    subtitle:
      "A password reset was requested for your TenderLens account. If this was not you, ignore this email.",
    details: [
      { label: "Action", value: "Password reset" },
      { label: "Expires", value: `In ${args.expiresInHours} hour(s)` },
      { label: "Account URL", value: env.FRONTEND_URL },
    ],
    ctaLabel: "Reset password",
    ctaUrl: args.resetUrl,
  })

  return {
    subject: "Reset your TenderLens password",
    text,
    html,
  }
}

export function buildInviteTemporaryPasswordContent(args: {
  orgName: string
  loginUrl: string
  temporaryPassword: string
}) {
  const { text, html } = buildBrandedEmailLayout({
    title: "Invitation accepted",
    subtitle:
      "Your TenderLens invitation has been accepted. Use the temporary password below to sign in, then set a new password immediately.",
    details: [
      { label: "Organization", value: args.orgName },
      { label: "Temporary password", value: args.temporaryPassword },
      { label: "Account URL", value: env.FRONTEND_URL },
    ],
    ctaLabel: "Sign in",
    ctaUrl: args.loginUrl,
  })

  return {
    subject: "Your TenderLens temporary password",
    text,
    html,
  }
}
