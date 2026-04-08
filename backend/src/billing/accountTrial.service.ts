import { prisma } from "../db/prisma"

const ACCOUNT_TRIAL_DAYS = 14
const ACCOUNT_TRIAL_MS = ACCOUNT_TRIAL_DAYS * 24 * 60 * 60 * 1000

export type AccountTrialState = {
  trialStartedAt: Date
  trialEndsAt: Date
  status: "TRIALING" | "EXPIRED"
}

function buildTrialEndsAt(trialStartedAt: Date) {
  return new Date(trialStartedAt.getTime() + ACCOUNT_TRIAL_MS)
}

export function getTrialStatus(
  trialEndsAt: Date,
  now = new Date(),
): AccountTrialState["status"] {
  return now > trialEndsAt ? "EXPIRED" : "TRIALING"
}

export async function ensureAccountTrialState(
  userId: string,
  now = new Date(),
): Promise<AccountTrialState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      trialStartedAt: true,
      trialEndsAt: true,
    },
  })

  if (!user) {
    throw new Error(`User not found for account trial sync: ${userId}`)
  }

  if (user.trialStartedAt && user.trialEndsAt) {
    return {
      trialStartedAt: user.trialStartedAt,
      trialEndsAt: user.trialEndsAt,
      status: getTrialStatus(user.trialEndsAt, now),
    }
  }

  const trialStartedAt = user.trialStartedAt ?? now
  const trialEndsAt = user.trialEndsAt ?? buildTrialEndsAt(trialStartedAt)

  await prisma.user.update({
    where: { id: userId },
    data: { trialStartedAt, trialEndsAt },
  })

  return {
    trialStartedAt,
    trialEndsAt,
    status: getTrialStatus(trialEndsAt, now),
  }
}

export async function syncOwnerTrialSubscriptions(
  userId: string,
  now = new Date(),
) {
  const ownedMemberships = await prisma.membership.findMany({
    where: { userId, role: "OWNER" },
    select: { orgId: true },
  })

  if (ownedMemberships.length === 0) return null

  const trial = await ensureAccountTrialState(userId, now)
  const orgIds = ownedMemberships.map((membership) => membership.orgId)

  await prisma.orgSubscription.createMany({
    data: orgIds.map((orgId) => ({
      orgId,
      plan: "TRIAL",
      status: trial.status,
      trialEndsAt: trial.trialEndsAt,
    })),
    skipDuplicates: true,
  })

  await prisma.orgSubscription.updateMany({
    where: {
      orgId: { in: orgIds },
      plan: "TRIAL",
      status: { in: ["ACTIVE", "TRIALING", "EXPIRED"] },
    },
    data: {
      status: trial.status,
      trialEndsAt: trial.trialEndsAt,
    },
  })

  return { ...trial, orgIds }
}
