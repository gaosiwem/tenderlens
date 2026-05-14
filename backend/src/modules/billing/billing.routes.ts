import express, { Router } from "express"
import crypto from "crypto"
import { prisma } from "../../db/prisma"
import { requireAuth } from "../../middleware/auth.middleware"
import {
  requireOrgMembership,
  optionalOrgMembership,
} from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok, AppError } from "../../utils/responses"
import { auditLog } from "../audit/audit.service"
import { getUsageSummary } from "../../billing/usage.service"
import { requireBillingAdmin } from "../../billing/billing-permissions"
import { trackBillingEvent } from "../../billing/analytics.service"
import { PLAN_CONFIG } from "../../billing/plan"
import {
  buildPayFastCheckout,
  parsePayFastNotifyPayload,
  verifyPayFastPaymentWithGateway,
  verifyPayFastSignature,
} from "../../billing/payfast.service"
import { logger } from "../../utils/logger"
import { PlanType, SubscriptionStatus } from "@prisma/client"
import { env } from "../../config/env"

export const billingRouter = Router()

function toClientPlan(plan: string) {
  return plan === "ENTERPRISE" ? "BUSINESS" : plan
}

function mapClientPlanToSubscriptionPlan(plan: "PRO" | "BUSINESS"): PlanType {
  return plan === "BUSINESS" ? "ENTERPRISE" : "PRO"
}

function mapPayloadPlanToClientPlan(value: string | null | undefined) {
  return value === "BUSINESS" ? "BUSINESS" : "PRO"
}

function mapPayloadPlanToPlanType(value: string | null | undefined): PlanType {
  return mapClientPlanToSubscriptionPlan(mapPayloadPlanToClientPlan(value))
}

function splitName(name: string | null | undefined) {
  const cleaned = String(name ?? "").trim()
  if (!cleaned) return { firstName: "TenderLens", lastName: "Customer" }
  const parts = cleaned.split(/\s+/)
  return {
    firstName: parts[0] || "TenderLens",
    lastName: parts.slice(1).join(" ") || "Customer",
  }
}

function addOneMonth(value: Date) {
  const out = new Date(value)
  out.setMonth(out.getMonth() + 1)
  return out
}

function parsePayFastAmountToCents(value: string | null | undefined) {
  const amount = Number(String(value ?? "0").replace(/,/g, ""))
  if (!Number.isFinite(amount)) return null
  return Math.round(amount * 100)
}

function extractPayFastToken(payload: Record<string, string>) {
  return (
    payload.token ||
    payload.subscription_token ||
    payload.pf_token ||
    payload.custom_str5 ||
    null
  )
}

function normalizePayFastStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase()
}

function isCanceledPayFastStatus(status: string) {
  return ["CANCELLED", "CANCELED", "SUBSCRIPTION CANCELLED"].includes(status)
}

function isFailedPayFastStatus(status: string) {
  return ["FAILED", "DECLINED", "EXPIRED"].includes(status)
}

async function activatePayFastSubscription(args: {
  orgId: string
  userId?: string
  plan: "PRO" | "BUSINESS"
  reference: string | null
  paymentId: string | null
  amountCents: number | null
  paymentStatus: string
  rawStatus?: string | null
  payfastToken?: string | null
}) {
  const existing = await prisma.orgSubscription.findUnique({
    where: { orgId: args.orgId },
    select: { currentPeriodEnd: true, seatsPurchased: true },
  })
  const baseDate =
    existing?.currentPeriodEnd && existing.currentPeriodEnd > new Date()
      ? existing.currentPeriodEnd
      : new Date()

  await prisma.orgSubscription.upsert({
    where: { orgId: args.orgId },
    create: {
      orgId: args.orgId,
      plan: mapClientPlanToSubscriptionPlan(args.plan),
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: addOneMonth(baseDate),
      seatsPurchased: existing?.seatsPurchased ?? 1,
      seatsUsed: 0,
      paymentGateway: "PAYFAST",
      billingReference: args.payfastToken ?? args.paymentId ?? args.reference,
      payfastToken: args.payfastToken ?? undefined,
      lastPaymentAt: new Date(),
    },
    update: {
      plan: mapClientPlanToSubscriptionPlan(args.plan),
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: addOneMonth(baseDate),
      pastDueSince: null,
      graceEndsAt: null,
      trialEndsAt: null,
      paymentGateway: "PAYFAST",
      billingReference: args.payfastToken ?? args.paymentId ?? args.reference,
      payfastToken: args.payfastToken ?? undefined,
      lastPaymentAt: new Date(),
    },
  })

  await trackBillingEvent({
    orgId: args.orgId,
    userId: args.userId,
    name: "checkout_completed",
    meta: {
      gateway: "PAYFAST",
      plan: args.plan,
      reference: args.reference,
      payfastPaymentId: args.paymentId,
      paymentStatus: args.paymentStatus,
      amountCents: args.amountCents,
      rawStatus: args.rawStatus ?? null,
      payfastToken: args.payfastToken ?? null,
    },
  })
}

function resolveFrontendOrigin(req: express.Request) {
  const allowedOrigins = new Set(
    env.CORS_ORIGINS.map((origin: string) => origin.trim()),
  )
  const candidateHeaders = [req.get("origin"), req.get("referer")]

  for (const candidate of candidateHeaders) {
    if (!candidate) continue
    try {
      const parsed = new URL(candidate)
      if (allowedOrigins.has(parsed.origin)) {
        return parsed.origin
      }
    } catch {
      continue
    }
  }

  return env.FRONTEND_URL
}

billingRouter.get(
  "/subscription",
  requireAuth,
  optionalOrgMembership,
  async (req, res, next) => {
    try {
      if (!req.orgId) {
        return res.json(ok({ subscription: null }))
      }
      const sub = await prisma.orgSubscription.findUnique({
        where: { orgId: req.orgId },
      })
      if (!sub) {
        return res.json(ok({ subscription: null }))
      }
      res.json(ok({ subscription: { ...sub, plan: toClientPlan(sub.plan) } }))
    } catch (e) {
      next(e)
    }
  },
)

billingRouter.get(
  "/usage",
  requireAuth,
  optionalOrgMembership,
  async (req, res, next) => {
    try {
      if (!req.orgId) {
        return res.json(ok({ usage: null }))
      }
      const summary = await getUsageSummary(req.orgId)
      res.json(ok({ usage: summary }))
    } catch (e) {
      next(e)
    }
  },
)

billingRouter.post(
  "/plan-checkout",
  requireAuth,
  requireOrgMembership,
  requireBillingAdmin,
  async (req, res, next) => {
    try {
      const { plan } = req.body
      if (plan !== "PRO" && plan !== "BUSINESS") {
        throw new AppError("VALIDATION_ERROR", "Invalid plan", 400)
      }

      const requestedQuantity = Number(req.body?.quantity ?? 1)
      if (
        !Number.isFinite(requestedQuantity) ||
        !Number.isInteger(requestedQuantity) ||
        requestedQuantity < 1
      ) {
        throw new AppError("VALIDATION_ERROR", "Invalid quantity", 400)
      }
      if (requestedQuantity !== 1) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Plan checkout quantity must be 1 for PRO and BUSINESS.",
          400,
        )
      }
      const quantity = 1

      const user = await prisma.user.findUnique({
        where: { id: req.auth!.userId },
        select: { id: true, email: true, name: true },
      })
      if (!user?.email) {
        throw new AppError(
          "VALIDATION_ERROR",
          "A verified email is required before checkout.",
          400,
        )
      }

      const org = await prisma.organization.findUnique({
        where: { id: req.orgId! },
        select: { id: true, name: true },
      })
      if (!org) {
        throw new AppError("NOT_FOUND", "Organization not found", 404)
      }

      const reference = crypto.randomUUID()
      const { firstName, lastName } = splitName(user.name)
      const amountCents =
        plan === "PRO"
          ? PLAN_CONFIG.PRO.monthlyPriceCents
          : PLAN_CONFIG.ENTERPRISE.monthlyPriceCents
      const frontendOrigin = resolveFrontendOrigin(req)
      const returnUrlParams = new URLSearchParams({
        checkout: reference,
        plan,
      })

      const checkout = buildPayFastCheckout({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        plan,
        amountCents,
        email: user.email,
        firstName,
        lastName,
        reference,
        orgName: org.name,
        returnUrl: `${frontendOrigin}/billing/success?${returnUrlParams.toString()}`,
        cancelUrl: `${frontendOrigin}/billing/cancel`,
      })

      await prisma.payFastCheckout.create({
        data: {
          orgId: req.orgId!,
          userId: req.auth!.userId,
          reference,
          plan: mapClientPlanToSubscriptionPlan(plan),
          amountCents,
          mode: env.PAYFAST_SANDBOX ? "SANDBOX" : "PRODUCTION",
          paymentUrl: checkout.paymentUrl,
        },
      })

      await trackBillingEvent({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        name: "checkout_started",
        meta: {
          plan,
          quantity,
          gateway: "PAYFAST",
          reference,
          amountCents,
        },
      })

      await auditLog({
        req,
        action: "BILLING_CHECKOUT_STARTED",
        orgId: req.orgId!,
        userId: req.auth!.userId,
        entityType: "OrgSubscription",
        entityId: req.orgId!,
        meta: { plan, gateway: "PAYFAST", reference, amountCents },
      })

      res.json(
        ok({
          gateway: "PAYFAST",
          paymentUrl: checkout.paymentUrl,
          fields: checkout.fields,
          reference,
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)

billingRouter.post(
  "/portal",
  requireAuth,
  requireOrgMembership,
  requireBillingAdmin,
  async (req, res, next) => {
    try {
      res.status(400).json(
        ok({
          portalUrl: "",
          message:
            "Self-service portal is not available for PayFast billing yet. Use the pricing page to change plans.",
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)

billingRouter.post(
  "/payfast/notify",
  express.urlencoded({ extended: false }),
  async (req, res) => {
    const payload = parsePayFastNotifyPayload(req.body)
    const reference = payload.m_payment_id ?? null
    const paymentId = payload.pf_payment_id ?? null
    const plan = mapPayloadPlanToClientPlan(payload.custom_str1)
    const orgId = payload.custom_str2 ?? null
    const userId = payload.custom_str3 ?? undefined
    const status = normalizePayFastStatus(payload.payment_status)
    const payfastToken = extractPayFastToken(payload)
    const notificationOrg = orgId
      ? await prisma.organization.findUnique({
          where: { id: orgId },
          select: { id: true },
        })
      : null
    const notification = await prisma.payFastNotification.create({
      data: {
        orgId: notificationOrg?.id ?? null,
        reference,
        payfastPaymentId: paymentId,
        paymentStatus: status || null,
        rawPayload: payload,
      },
    })

    try {
      if (!verifyPayFastSignature(payload)) {
        logger.warn({ reference, paymentId }, "payfast_invalid_signature")
        await prisma.payFastNotification.update({
          where: { id: notification.id },
          data: {
            validationStatus: "INVALID_SIGNATURE",
            error: "PayFast signature did not match.",
            processedAt: new Date(),
          },
        })
        if (notificationOrg) {
          await trackBillingEvent({
            orgId: notificationOrg.id,
            userId,
            name: "checkout_failed",
            meta: {
              gateway: "PAYFAST",
              reason: "INVALID_SIGNATURE",
              reference,
              payfastPaymentId: paymentId,
            },
          })
        }
        return res.status(400).send("INVALID")
      }

      const validWithGateway = await verifyPayFastPaymentWithGateway(payload)
      if (!validWithGateway) {
        logger.warn({ reference, paymentId }, "payfast_gateway_validation_failed")
        await prisma.payFastNotification.update({
          where: { id: notification.id },
          data: {
            validationStatus: "GATEWAY_INVALID",
            error: "PayFast gateway validation returned invalid.",
            processedAt: new Date(),
          },
        })
        if (notificationOrg) {
          await trackBillingEvent({
            orgId: notificationOrg.id,
            userId,
            name: "checkout_failed",
            meta: {
              gateway: "PAYFAST",
              reason: "GATEWAY_VALIDATION_FAILED",
              reference,
              payfastPaymentId: paymentId,
            },
          })
        }
        return res.status(400).send("INVALID")
      }

      if (!orgId || !notificationOrg) {
        await prisma.payFastNotification.update({
          where: { id: notification.id },
          data: {
            validationStatus: "INVALID_PAYLOAD",
            error: !orgId
              ? "Missing organization id."
              : "Organization id was not found.",
            processedAt: new Date(),
          },
        })
        return res.status(400).send("INVALID")
      }

      const checkout = reference
        ? await prisma.payFastCheckout.findUnique({
            where: { reference },
          })
        : null

      const isInitialCheckout = Boolean(checkout)
      const existingPayFastSubscription = await prisma.orgSubscription.findUnique({
        where: { orgId },
        select: { paymentGateway: true, payfastToken: true },
      })
      const knownRecurringSubscription =
        existingPayFastSubscription?.paymentGateway === "PAYFAST" &&
        (!payfastToken || existingPayFastSubscription.payfastToken === payfastToken)

      if (!checkout && !knownRecurringSubscription) {
        await prisma.payFastNotification.update({
          where: { id: notification.id },
          data: {
            validationStatus: "UNKNOWN_REFERENCE",
            error: "No matching checkout or PayFast subscription was found.",
            processedAt: new Date(),
          },
        })
        logger.warn({ reference, paymentId, orgId }, "payfast_unknown_reference")
        return res.status(400).send("INVALID")
      }

      if (checkout && checkout.orgId !== orgId) {
        await prisma.payFastNotification.update({
          where: { id: notification.id },
          data: {
            validationStatus: "REFERENCE_MISMATCH",
            error: "PayFast reference does not belong to callback organization.",
            processedAt: new Date(),
          },
        })
        logger.warn({ reference, paymentId, orgId }, "payfast_reference_mismatch")
        return res.status(400).send("INVALID")
      }

      if (checkout && checkout.plan !== mapPayloadPlanToPlanType(payload.custom_str1)) {
        await prisma.payFastNotification.update({
          where: { id: notification.id },
          data: {
            validationStatus: "PLAN_MISMATCH",
            error: "PayFast plan did not match pending checkout.",
            processedAt: new Date(),
          },
        })
        logger.warn({ reference, paymentId, orgId }, "payfast_plan_mismatch")
        return res.status(400).send("INVALID")
      }

      const alreadyProcessed = paymentId
        ? await prisma.billingEvent.findFirst({
            where: {
              orgId,
              name: "checkout_completed",
              meta: { path: ["payfastPaymentId"], equals: paymentId },
            },
            select: { id: true },
          })
        : null

      if (alreadyProcessed) {
        await prisma.payFastNotification.update({
          where: { id: notification.id },
          data: {
            validationStatus: "DUPLICATE",
            processedAt: new Date(),
          },
        })
        return res.status(200).send("OK")
      }

      const amountCents = parsePayFastAmountToCents(payload.amount_gross)
      const expectedCents =
        plan === "PRO"
          ? PLAN_CONFIG.PRO.monthlyPriceCents
          : PLAN_CONFIG.ENTERPRISE.monthlyPriceCents

      if (amountCents !== expectedCents) {
        logger.warn(
          { reference, paymentId, amountCents, expectedCents, orgId, plan },
          "payfast_amount_mismatch",
        )
        await trackBillingEvent({
          orgId,
          userId,
          name: "checkout_failed",
          meta: {
            gateway: "PAYFAST",
            reason: "AMOUNT_MISMATCH",
            reference,
            payfastPaymentId: paymentId,
            amountCents,
            expectedCents,
          },
        })
        await prisma.payFastNotification.update({
          where: { id: notification.id },
          data: {
            validationStatus: "AMOUNT_MISMATCH",
            error: `Expected ${expectedCents}, received ${amountCents ?? "null"}.`,
            processedAt: new Date(),
          },
        })
        if (checkout) {
          await prisma.payFastCheckout.update({
            where: { reference: checkout.reference },
            data: {
              status: "INVALID",
              payfastPaymentId: paymentId,
              rawPayload: payload,
            },
          })
        }
        return res.status(400).send("INVALID")
      }

      if (status === "COMPLETE") {
        await activatePayFastSubscription({
          orgId,
          userId,
          plan,
          reference,
          paymentId,
          amountCents,
          paymentStatus: status,
          rawStatus: payload.payment_status ?? null,
          payfastToken,
        })

        if (isInitialCheckout && checkout) {
          await prisma.payFastCheckout.update({
            where: { reference: checkout.reference },
            data: {
              status: "COMPLETE",
              payfastPaymentId: paymentId,
              payfastToken,
              rawPayload: payload,
              completedAt: new Date(),
            },
          })
        }

        await prisma.payFastNotification.update({
          where: { id: notification.id },
          data: {
            validationStatus: "PROCESSED",
            processedAt: new Date(),
          },
        })

        return res.status(200).send("OK")
      }

      if (isCanceledPayFastStatus(status)) {
        await prisma.orgSubscription.updateMany({
          where: {
            orgId,
            paymentGateway: "PAYFAST",
          },
          data: {
            status: SubscriptionStatus.CANCELED,
          },
        })
      } else if (isFailedPayFastStatus(status)) {
        const now = new Date()
        const graceEndsAt = new Date(now)
        graceEndsAt.setDate(graceEndsAt.getDate() + 7)
        await prisma.orgSubscription.updateMany({
          where: {
            orgId,
            paymentGateway: "PAYFAST",
            status: SubscriptionStatus.ACTIVE,
          },
          data: {
            status: SubscriptionStatus.PAST_DUE,
            pastDueSince: now,
            graceEndsAt,
          },
        })
      }

      await trackBillingEvent({
        orgId,
        userId,
        name: "checkout_failed",
        meta: {
          gateway: "PAYFAST",
          plan,
          reference,
          payfastPaymentId: paymentId,
          paymentStatus: status,
          amountCents,
        },
      })

      if (checkout) {
        await prisma.payFastCheckout.update({
          where: { reference: checkout.reference },
          data: {
            status: isCanceledPayFastStatus(status)
              ? "CANCELED"
              : isFailedPayFastStatus(status)
                ? "FAILED"
                : "PENDING",
            payfastPaymentId: paymentId,
            payfastToken,
            rawPayload: payload,
          },
        })
      }

      await prisma.payFastNotification.update({
        where: { id: notification.id },
        data: {
          validationStatus: "PROCESSED",
          processedAt: new Date(),
        },
      })

      return res.status(200).send("OK")
    } catch (error) {
      await prisma.payFastNotification.update({
        where: { id: notification.id },
        data: {
          validationStatus: "ERROR",
          error: error instanceof Error ? error.message : String(error),
          processedAt: new Date(),
        },
      })
      logger.error(
        { err: error, reference, paymentId, orgId },
        "payfast_notify_processing_failed",
      )
      return res.status(500).send("ERROR")
    }
  },
)

billingRouter.post(
  "/payfast/dev-complete-latest",
  requireAuth,
  requireOrgMembership,
  requireBillingAdmin,
  async (req, res, next) => {
    try {
      if (!env.PAYFAST_SANDBOX || env.NODE_ENV === "production") {
        throw new AppError(
          "FORBIDDEN",
          "This development PayFast fallback is only available in sandbox mode.",
          403,
        )
      }
      if (!env.DEV_TEST_ROUTES_ENABLED) {
        throw new AppError(
          "FORBIDDEN",
          "Development billing helpers are disabled in this environment.",
          403,
        )
      }

      const latestCheckout = await prisma.billingEvent.findFirst({
        where: {
          orgId: req.orgId!,
          name: "checkout_started",
          meta: { path: ["gateway"], equals: "PAYFAST" },
        },
        orderBy: { createdAt: "desc" },
      })

      if (!latestCheckout) {
        throw new AppError(
          "NOT_FOUND",
          "No pending PayFast checkout was found for this organization.",
          404,
        )
      }

      const plan =
        latestCheckout.meta &&
        typeof latestCheckout.meta === "object" &&
        !Array.isArray(latestCheckout.meta) &&
        (latestCheckout.meta as Record<string, unknown>).plan === "BUSINESS"
          ? "BUSINESS"
          : "PRO"

      const reference =
        latestCheckout.meta &&
        typeof latestCheckout.meta === "object" &&
        !Array.isArray(latestCheckout.meta)
          ? String(
              (latestCheckout.meta as Record<string, unknown>).reference ?? "",
            ) || null
          : null

      const existingCompleted = reference
        ? await prisma.billingEvent.findFirst({
            where: {
              orgId: req.orgId!,
              name: "checkout_completed",
              meta: { path: ["reference"], equals: reference },
            },
            select: { id: true },
          })
        : null

      if (!existingCompleted) {
        const amountCents =
          plan === "PRO"
            ? PLAN_CONFIG.PRO.monthlyPriceCents
            : PLAN_CONFIG.ENTERPRISE.monthlyPriceCents

        await activatePayFastSubscription({
          orgId: req.orgId!,
          userId: req.auth!.userId,
          plan,
          reference,
          paymentId: null,
          amountCents,
          paymentStatus: "COMPLETE",
          rawStatus: "DEV_SANDBOX_FALLBACK",
        })

        if (reference) {
          await prisma.payFastCheckout.updateMany({
            where: {
              orgId: req.orgId!,
              reference,
            },
            data: {
              status: "COMPLETE",
              completedAt: new Date(),
            },
          })
        }
      }

      res.json(ok({ completed: true }))
    } catch (e) {
      next(e)
    }
  },
)

billingRouter.post(
  "/events",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      const { name, meta } = req.body
      await trackBillingEvent({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        name,
        meta,
      })
      res.json(ok({}))
    } catch (e) {
      next(e)
    }
  },
)

billingRouter.get(
  "/invoices",
  requireAuth,
  requireOrgMembership,
  requireBillingAdmin,
  async (req, res, next) => {
    try {
      const invoices = await prisma.orgInvoice.findMany({
        where: { orgId: req.orgId! },
        orderBy: { createdAt: "desc" },
      })
      res.json(ok({ items: invoices }))
    } catch (e) {
      next(e)
    }
  },
)
