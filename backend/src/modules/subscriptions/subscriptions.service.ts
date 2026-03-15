import Stripe from "stripe"
import { env } from "../../config/env"
import { prisma } from "../../db/prisma"
import { AppError } from "../../utils/responses"

function stripe() {
  if (!env.STRIPE_SECRET_KEY)
    throw new AppError("CONFIG_ERROR", "STRIPE_SECRET_KEY missing", 500)
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any })
}

export async function startSubscriptionCheckout(args: {
  orgId: string
  planCode: "starter" | "growth"
  successUrl: string
  cancelUrl: string
}) {
  if (!env.STRIPE_SUBSCRIPTIONS_ENABLED)
    throw new AppError("SUBSCRIPTIONS_DISABLED", "Subscriptions disabled", 400)

  const priceId =
    args.planCode === "starter"
      ? env.STRIPE_PRICE_STARTER_MONTHLY
      : args.planCode === "growth"
        ? env.STRIPE_PRICE_GROWTH_MONTHLY
        : null

  if (!priceId)
    throw new AppError("CONFIG_ERROR", "Price id missing for plan", 500)

  // Ensure subscription record exists
  await prisma.orgSubscription.upsert({
    where: { orgId: args.orgId },
    update: { plan: "PRO" }, // Simplified for legacy compatibility
    create: { orgId: args.orgId, plan: "PRO", status: "CANCELED" },
  })

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    metadata: { orgId: args.orgId, planCode: args.planCode },
  })

  return { url: session.url }
}

export async function upsertFromStripe(args: {
  orgId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  status: "ACTIVE" | "PAST_DUE" | "CANCELED"
  planCode: string
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
}) {
  return prisma.orgSubscription.upsert({
    where: { orgId: args.orgId },
    update: {
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      status: args.status as any,
      plan: "PRO",
      currentPeriodEnd: args.currentPeriodEnd,
    },
    create: {
      orgId: args.orgId,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      status: args.status as any,
      plan: "PRO",
      currentPeriodEnd: args.currentPeriodEnd,
    },
  })
}
