import { prisma } from "../../db/prisma"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"
import { generateOtp, hashOtp } from "../../utils/otp"
import { sendSms } from "../notifications/sms.sender"
import { getEffectivePlanConfig } from "../../billing/effective-plan.service"

function minutesFromNow(m: number) {
  return new Date(Date.now() + m * 60_000)
}

function normalizePhoneNumber(input: string) {
  const compact = input.replace(/[\s()-]/g, "")

  let normalized = compact
  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`
  } else if (normalized.startsWith("0")) {
    // Default local-format numbers to South Africa for this deployment.
    normalized = `+27${normalized.slice(1)}`
  }

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Enter a valid phone number in international format.",
      400,
    )
  }

  return normalized
}

async function resolvePlanConfig(orgId: string) {
  const { config } = await getEffectivePlanConfig(orgId)
  return config
}

export async function startVerification(args: {
  orgId: string
  userId: string
  whatsappNumber: string
}) {
  const phoneNumber = normalizePhoneNumber(args.whatsappNumber)

  if (!env.SMS_VERIFICATION_ENABLED) {
    throw new AppError("DISABLED", "SMS verification disabled", 400)
  }

  const cfg = await resolvePlanConfig(args.orgId)
  if (!cfg.whatsapp) {
    throw new AppError(
      "PLAN_UPGRADE_REQUIRED",
      "SMS alerts are not available on your current plan.",
      403,
      { upgrade: true, limitType: "alerts" },
    )
  }

  const since = new Date(Date.now() - 60 * 60_000)
  const count = await prisma.whatsAppVerification.count({
    where: {
      orgId: args.orgId,
      userId: args.userId,
      createdAt: { gte: since },
    },
  })

  if (count >= env.SMS_OTP_RATE_LIMIT_PER_HOUR) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many OTP requests. Try again later.",
      429,
    )
  }

  const otp = generateOtp()
  const otpHash = hashOtp(otp)
  const expiresAt = minutesFromNow(env.SMS_OTP_TTL_MINUTES)

  const row = await prisma.whatsAppVerification.create({
    data: {
      orgId: args.orgId,
      userId: args.userId,
      whatsappNumber: phoneNumber,
      otpHash,
      expiresAt,
    },
  })

  await sendSms(
    phoneNumber,
    `TenderLens verification code: ${otp}. Expires in ${env.SMS_OTP_TTL_MINUTES} minutes.`,
  )

  return {
    verificationId: row.id,
    expiresAt: row.expiresAt,
    phoneNumber,
  }
}

export async function verifyOtp(args: {
  orgId: string
  userId: string
  verificationId: string
  otp: string
}) {
  const cfg = await resolvePlanConfig(args.orgId)
  if (!cfg.whatsapp) {
    throw new AppError(
      "PLAN_UPGRADE_REQUIRED",
      "SMS alerts are not available on your current plan.",
      403,
      { upgrade: true, limitType: "alerts" },
    )
  }

  const row = await prisma.whatsAppVerification.findFirst({
    where: {
      id: args.verificationId,
      orgId: args.orgId,
      userId: args.userId,
    },
  })

  if (!row) throw new AppError("NOT_FOUND", "Verification not found", 404)
  if (row.verifiedAt)
    return { verified: true, phoneNumber: row.whatsappNumber }
  if (row.expiresAt < new Date()) {
    throw new AppError("EXPIRED", "Code expired. Request a new one.", 400)
  }
  if (row.attempts >= env.SMS_OTP_MAX_ATTEMPTS) {
    throw new AppError("LOCKED", "Too many attempts. Request a new code.", 400)
  }

  const ok = hashOtp(args.otp) === row.otpHash

  await prisma.whatsAppVerification.update({
    where: { id: row.id },
    data: {
      attempts: { increment: 1 },
      verifiedAt: ok ? new Date() : null,
    },
  })

  if (!ok) throw new AppError("INVALID", "Invalid code", 400)

  // Update notification prefs in the current org scope.
  const existingPrefs = await prisma.userNotificationPrefs.findFirst({
    where: { orgId: args.orgId, userId: args.userId },
    select: { id: true },
  })

  if (existingPrefs) {
    await prisma.userNotificationPrefs.update({
      where: { id: existingPrefs.id },
      data: {
        whatsappNumber: row.whatsappNumber,
        whatsappEnabled: true,
        whatsappVerifiedAt: new Date(),
      },
    })
  } else {
    await prisma.userNotificationPrefs.create({
      data: {
        orgId: args.orgId,
        userId: args.userId,
        whatsappNumber: row.whatsappNumber,
        whatsappEnabled: true,
        whatsappVerifiedAt: new Date(),
      },
    })
  }

  return { verified: true, phoneNumber: row.whatsappNumber }
}
