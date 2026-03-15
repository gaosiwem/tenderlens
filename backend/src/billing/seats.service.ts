import { prisma } from "../db/prisma"
import { AppError } from "../utils/responses"
import { trackBillingEvent } from "./analytics.service"
import { getEffectivePlanConfig } from "./effective-plan.service"

/**
 * Recalculates and caches the number of seats used (active members) for an organization.
 */
export async function refreshSeatsUsed(orgId: string) {
  const count = await prisma.membership.count({
    where: { orgId },
  })

  await prisma.orgSubscription.update({
    where: { orgId },
    data: { seatsUsed: count },
  })

  return count
}

/**
 * Checks if an organization can add or invite a new member.
 */
export async function enforceMemberLimit(orgId: string, userId?: string) {
  const sub = await prisma.orgSubscription.findUnique({
    where: { orgId },
  })

  const activeSub = sub ?? { plan: "TRIAL", seatsPurchased: 1, seatsUsed: 0 }

  const { config } = await getEffectivePlanConfig(orgId)
  const max = config.maxMembers

  if (max === "unlimited") return true

  const currentUsed = await refreshSeatsUsed(orgId)

  if (max === "seats") {
    // PRO mode: Check against purchased seats
    if (currentUsed >= activeSub.seatsPurchased) {
      await trackBillingEvent({
        orgId,
        userId,
        name: "member_limit_hit",
        meta: {
          used: currentUsed,
          limit: activeSub.seatsPurchased,
          mode: "seats",
        },
      }).catch(() => undefined)
      throw new AppError(
        "PAYMENT_REQUIRED",
        `You have used all ${activeSub.seatsPurchased} seats. Please purchase more seats in billing settings.`,
        402,
        { upgrade: true, limitType: "members", used: currentUsed, limit: activeSub.seatsPurchased },
      )
    }
  } else if (typeof max === "number") {
    // TRIAL or fixed-limit mode
    if (currentUsed >= max) {
      await trackBillingEvent({
        orgId,
        userId,
        name: "member_limit_hit",
        meta: {
          used: currentUsed,
          limit: max,
          mode: "fixed",
        },
      }).catch(() => undefined)
      const upgradeHint =
        activeSub.plan === "TRIAL"
          ? "Upgrade to PRO for team collaboration."
          : "Upgrade to BUSINESS for additional team capacity."
      throw new AppError(
        "PAYMENT_REQUIRED",
        `Your plan allows up to ${max} members. ${upgradeHint}`,
        402,
        { upgrade: true, limitType: "members", used: currentUsed, limit: max },
      )
    }
  }

  return true
}
