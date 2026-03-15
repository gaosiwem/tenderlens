import { prisma } from "../db/prisma"

/**
 * Compute referral earnings from attributions
 * Runs daily to create earning records for successful referrals
 */
export async function computeReferralEarnings() {
  if (process.env.REFERRAL_PAYOUTS_ENABLED !== "true") {
    return { created: 0 }
  }

  const lookbackDays = Number(process.env.REFERRAL_PAYOUT_LOOKBACK_DAYS ?? 30)
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60_000)

  const attributions = await prisma.referralAttribution.findMany({
    where: { createdAt: { gte: since } },
    take: 500,
  })

  const pct = Number(process.env.REFERRAL_PAYOUT_PERCENT ?? 10)
  const currency = String(process.env.REFERRAL_PAYOUT_CURRENCY ?? "ZAR")

  let created = 0

  for (const a of attributions) {
    if (!a.code) continue

    const ref = await prisma.referralCode.findFirst({
      where: { code: a.code, active: true },
    })

    if (!ref) continue

    // Prevent duplicates for same subscription
    const existing = await prisma.referralEarning.findFirst({
      where: {
        stripeSubscriptionId: a.stripeSubscriptionId ?? undefined,
      },
    })

    if (existing) continue

    // Calculate earning amount
    // MVP: use minimum threshold as base, apply percentage
    const base = Number(process.env.REFERRAL_PAYOUT_MIN_CENTS ?? 50000)
    const amountCents = Math.round(base * (pct / 100))

    await prisma.referralEarning.create({
      data: {
        orgId: ref.orgId ?? a.orgId,
        userId: ref.userId ?? null,
        referralCodeId: ref.id,
        attributedOrgId: a.orgId,
        stripeSubscriptionId: a.stripeSubscriptionId ?? null,
        amountCents,
        currency,
        status: "PENDING",
      },
    })

    created++
  }

  return { created }
}
