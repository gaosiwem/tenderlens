import { SubscriptionStatus } from "@prisma/client"
import { env } from "../config/env"
import { prisma } from "../db/prisma"
import { trackBillingEvent } from "./analytics.service"

function addGracePeriod(value: Date) {
  const out = new Date(value)
  out.setDate(out.getDate() + env.PAYFAST_GRACE_DAYS)
  return out
}

export async function reconcilePayFastSubscriptions(now = new Date()) {
  const overdueActive = await prisma.orgSubscription.findMany({
    where: {
      paymentGateway: "PAYFAST",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { lt: now },
    },
    select: {
      orgId: true,
      plan: true,
      currentPeriodEnd: true,
      billingReference: true,
    },
  })

  let markedPastDue = 0
  for (const sub of overdueActive) {
    const graceEndsAt = addGracePeriod(now)
    await prisma.orgSubscription.update({
      where: { orgId: sub.orgId },
      data: {
        status: SubscriptionStatus.PAST_DUE,
        pastDueSince: now,
        graceEndsAt,
      },
    })
    markedPastDue += 1

    await trackBillingEvent({
      orgId: sub.orgId,
      name: "checkout_failed",
      meta: {
        gateway: "PAYFAST",
        reason: "RENEWAL_MISSED",
        plan: sub.plan,
        billingReference: sub.billingReference,
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        graceEndsAt: graceEndsAt.toISOString(),
      },
    })
  }

  const expired = await prisma.orgSubscription.updateMany({
    where: {
      paymentGateway: "PAYFAST",
      status: SubscriptionStatus.PAST_DUE,
      graceEndsAt: { lt: now },
    },
    data: {
      status: SubscriptionStatus.EXPIRED,
    },
  })

  const staleCheckoutCutoff = new Date(now)
  staleCheckoutCutoff.setDate(staleCheckoutCutoff.getDate() - 1)
  const staleCheckouts = await prisma.payFastCheckout.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: staleCheckoutCutoff },
    },
    data: {
      status: "EXPIRED",
    },
  })

  return {
    markedPastDue,
    expired: expired.count,
    staleCheckouts: staleCheckouts.count,
  }
}
