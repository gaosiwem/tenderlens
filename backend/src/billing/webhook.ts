import type { Request, Response } from "express"
import Stripe from "stripe"
import { env } from "../config/env"
import { prisma } from "../db/prisma"
import { stripe } from "./stripe.service"
import { AppError } from "../utils/responses"

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"]
  if (!sig || typeof sig !== "string") {
    return res.status(400).send("Webhook Error: Missing signature")
  }

  const rawBody = (req as any).rawBody as Buffer
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata.orgId
        if (!orgId) break

        const stripePriceId = subscription.items.data[0]?.plan.id
        let mappedPlan: "PRO" | "ENTERPRISE"
        if (stripePriceId === env.STRIPE_PRICE_STARTER_MONTHLY) {
          mappedPlan = "PRO"
        } else if (stripePriceId === env.STRIPE_PRICE_GROWTH_MONTHLY) {
          mappedPlan = "ENTERPRISE"
        } else {
          const existing = await prisma.orgSubscription.findUnique({
            where: { orgId },
            select: { plan: true },
          })
          mappedPlan = (existing?.plan === "ENTERPRISE" ? "ENTERPRISE" : "PRO")
        }

        await prisma.orgSubscription.update({
          where: { orgId },
          data: {
            stripeSubscriptionId: subscription.id,
            status: mapStripeStatus(subscription.status),
            plan: mappedPlan,
            seatsPurchased: subscription.items.data[0].quantity || 1,
            currentPeriodEnd: new Date(
              (subscription as any).current_period_end * 1000,
            ),
          },
        })
        break
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.orgId
        const referralCodeStr = session.metadata?.referralCode

        if (orgId && referralCodeStr) {
          const referralCode = await prisma.referralCode.findUnique({
            where: { code: referralCodeStr },
          })

          await prisma.referralAttribution.create({
            data: {
              orgId,
              code: referralCodeStr,
              stripeCheckoutSessionId: session.id,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
            },
          })

          if (referralCode?.partnerId) {
            await prisma.partnerAttribution.create({
              data: {
                partnerId: referralCode.partnerId,
                orgId,
                stripeSubscriptionId: session.subscription as string,
                amountCents: session.amount_total ?? null,
              },
            })
          }
        }
        break
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice
        const orgId =
          invoice.metadata?.orgId ||
          (invoice as any).subscription_details?.metadata?.orgId
        if (!orgId) break

        await prisma.orgSubscription.update({
          where: { orgId },
          data: {
            pastDueSince: null,
            graceEndsAt: null,
          },
        })

        await prisma.orgInvoice.upsert({
          where: { stripeInvoiceId: invoice.id },
          create: {
            orgId,
            stripeInvoiceId: invoice.id,
            status: invoice.status,
            amountDue: invoice.amount_due,
            amountPaid: invoice.amount_paid,
            currency: invoice.currency,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            invoicePdf: invoice.invoice_pdf,
            createdAt: new Date(invoice.created * 1000),
            periodStart: new Date(invoice.period_start * 1000),
            periodEnd: new Date(invoice.period_end * 1000),
          },
          update: {
            status: invoice.status,
            amountPaid: invoice.amount_paid,
          },
        })
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const orgId =
          invoice.metadata?.orgId ||
          (invoice as any).subscription_details?.metadata?.orgId
        if (!orgId) break

        const graceDays = 7
        await prisma.orgSubscription.update({
          where: { orgId },
          data: {
            status: "PAST_DUE",
            pastDueSince: new Date(),
            graceEndsAt: new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000),
          },
        })
        break
      }
    }

    res.json({ received: true })
  } catch (e: any) {
    console.error("Webhook processing error:", e)
    res.status(500).send("Webhook processing error")
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): any {
  switch (status) {
    case "active":
      return "ACTIVE"
    case "past_due":
      return "PAST_DUE"
    case "canceled":
      return "CANCELED"
    case "unpaid":
      return "CANCELED"
    case "trialing":
      return "TRIALING"
    default:
      return "CANCELED"
  }
}
