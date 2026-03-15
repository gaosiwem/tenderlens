import Stripe from "stripe"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"
import { upsertFromStripe } from "./subscriptions.service"

function stripe() {
  if (!env.STRIPE_SECRET_KEY)
    throw new AppError("CONFIG_ERROR", "STRIPE_SECRET_KEY missing", 500)
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any })
}

export async function handleStripeWebhook(req: any) {
  const sig = req.headers["stripe-signature"]
  if (!sig)
    throw new AppError("VALIDATION_ERROR", "Missing stripe signature", 400)
  if (!env.STRIPE_WEBHOOK_SECRET)
    throw new AppError("CONFIG_ERROR", "STRIPE_WEBHOOK_SECRET missing", 500)

  // req.rawBody must be provided by express configuration
  const event = stripe().webhooks.constructEvent(
    req.rawBody,
    sig,
    env.STRIPE_WEBHOOK_SECRET,
  )

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as any
    const orgId = String(sub.metadata?.orgId ?? "")
    const planCode = String(sub.metadata?.planCode ?? "starter")

    const status =
      sub.status === "active"
        ? "ACTIVE"
        : sub.status === "past_due"
          ? "PAST_DUE"
          : "CANCELED"

    if (orgId) {
      await upsertFromStripe({
        orgId,
        stripeCustomerId: String(sub.customer),
        stripeSubscriptionId: String(sub.id),
        status: status as any,
        planCode,
        currentPeriodEnd: sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : undefined,
      })
    }
  }

  return { received: true }
}
