import Stripe from "stripe"
import { env } from "../config/env"

export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20" as any,
    })
  : ({
      checkout: { sessions: { create: async () => ({ url: "" }) } },
      billingPortal: { sessions: { create: async () => ({ url: "" }) } },
    } as unknown as Stripe)

if (!env.STRIPE_SECRET_KEY) {
  console.warn(
    "WARNING: STRIPE_SECRET_KEY is missing. Billing features will not work.",
  )
}

export async function createCheckoutSession(
  orgId: string,
  priceId: string,
  quantity: number = 1,
  metadata?: { referralCode?: string; experimentBucket?: string },
) {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity }],
    allow_promotion_codes: true,
    success_url: env.STRIPE_SUCCESS_URL,
    cancel_url: env.STRIPE_CANCEL_URL,
    metadata: { orgId, ...metadata },
  })

  return session.url
}

export async function createPortalSession(stripeCustomerId: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: env.FRONTEND_URL + "/settings/billing",
  })
  return session.url
}
