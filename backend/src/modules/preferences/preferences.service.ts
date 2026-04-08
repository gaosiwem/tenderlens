import { prisma } from "../../db/prisma"
import { AppError } from "../../utils/responses"
import { getEffectivePlanConfig } from "../../billing/effective-plan.service"

async function resolvePlanConfig(orgId: string) {
  const { config } = await getEffectivePlanConfig(orgId)
  return config
}

export async function getPrefs(args: { orgId: string; userId: string }) {
  const existing = await prisma.userNotificationPrefs.findFirst({
    where: { orgId: args.orgId, userId: args.userId },
  })
  if (existing) return existing

  return prisma.userNotificationPrefs.create({
    data: {
      orgId: args.orgId,
      userId: args.userId,
      emailEnabled: true,
      whatsappEnabled: false,
      eventTypes: [],
    },
  })
}

export async function updatePrefs(args: {
  orgId: string
  userId: string
  patch: any
}) {
  const requestedWhatsappEnable = args.patch.whatsappEnabled === true
  const requestedWhatsappNumber =
    args.patch.whatsappNumber !== undefined &&
    String(args.patch.whatsappNumber ?? "").trim().length > 0

  if (requestedWhatsappEnable || requestedWhatsappNumber) {
    const cfg = await resolvePlanConfig(args.orgId)
    if (!cfg.whatsapp) {
      throw new AppError(
        "PLAN_UPGRADE_REQUIRED",
        "SMS alerts are not available on your current plan.",
        403,
        { upgrade: true, limitType: "alerts" },
      )
    }
  }

  const allowed: any = {}
  if (args.patch.emailEnabled !== undefined)
    allowed.emailEnabled = Boolean(args.patch.emailEnabled)
  if (args.patch.whatsappEnabled !== undefined)
    allowed.whatsappEnabled = Boolean(args.patch.whatsappEnabled)
  if (args.patch.whatsappNumber !== undefined)
    allowed.whatsappNumber = args.patch.whatsappNumber
      ? String(args.patch.whatsappNumber)
      : null
  if (args.patch.eventTypes !== undefined)
    allowed.eventTypes = Array.isArray(args.patch.eventTypes)
      ? args.patch.eventTypes.map(String)
      : []
  if (args.patch.quietStart !== undefined)
    allowed.quietStart = args.patch.quietStart
      ? String(args.patch.quietStart)
      : null
  if (args.patch.quietEnd !== undefined)
    allowed.quietEnd = args.patch.quietEnd ? String(args.patch.quietEnd) : null
  if (args.patch.digestMode !== undefined)
    allowed.digestMode = Boolean(args.patch.digestMode)

  const existing = await prisma.userNotificationPrefs.findFirst({
    where: { orgId: args.orgId, userId: args.userId },
    select: { id: true },
  })

  if (existing) {
    return prisma.userNotificationPrefs.update({
      where: { id: existing.id },
      data: allowed,
    })
  }

  return prisma.userNotificationPrefs.create({
    data: {
      orgId: args.orgId,
      userId: args.userId,
      emailEnabled: allowed.emailEnabled ?? true,
      whatsappEnabled: allowed.whatsappEnabled ?? false,
      whatsappNumber: allowed.whatsappNumber ?? null,
      eventTypes: allowed.eventTypes ?? [],
      quietStart: allowed.quietStart ?? null,
      quietEnd: allowed.quietEnd ?? null,
      digestMode: allowed.digestMode ?? false,
    },
  })
}
