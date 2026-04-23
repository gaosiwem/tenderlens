import nodemailer from "nodemailer"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"

export function mailer() {
  if (!env.SMTP_HOST)
    throw new AppError("CONFIG_ERROR", "SMTP_HOST missing", 500)
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // Use TLS for port 465
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  })
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
) {
  if (!env.EMAIL_NOTIFICATIONS_ENABLED) return

  const forcedRecipient = env.EMAIL_TEST_OVERRIDE_TO.trim()
  const recipient = forcedRecipient || to

  const t = mailer()
  await t.sendMail({
    from: env.EMAIL_NOTIFICATIONS_FROM,
    to: recipient,
    subject,
    text,
    html,
  })
}
