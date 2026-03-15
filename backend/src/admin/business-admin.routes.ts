import { Router } from "express"
import { z } from "zod"
import { prisma } from "../db/prisma"
import { requireAuth } from "../middleware/auth.middleware"
import { requireSystemAdmin } from "../middleware/admin.middleware"
import { ensureBusinessProfile } from "../modules/business/business.service"
import { AppError, ok } from "../utils/responses"

export const businessAdminRouter = Router()

businessAdminRouter.use(requireAuth, requireSystemAdmin)

const onboardingStatusSchema = z.enum([
  "NOT_REQUESTED",
  "REQUESTED",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
])

async function ensureBusinessOrg(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      subscription: {
        select: { plan: true, status: true },
      },
    },
  })
  if (!org) throw new AppError("NOT_FOUND", "Organization not found", 404)
  if (org.subscription?.plan !== "ENTERPRISE") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Organization is not on the BUSINESS plan.",
      400,
    )
  }
  return org
}

businessAdminRouter.get("/orgs", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "")
      .trim()
      .toLowerCase()
    const onboardingStatusQuery = String(req.query.onboardingStatus ?? "")
      .trim()
      .toUpperCase()
    const take = Math.min(200, Math.max(1, Number(req.query.take ?? "100")))

    const items = await prisma.organization.findMany({
      where: {
        subscription: { plan: "ENTERPRISE" },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { slug: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        subscription: {
          select: {
            plan: true,
            status: true,
            currentPeriodEnd: true,
            seatsUsed: true,
            seatsPurchased: true,
          },
        },
        businessProfile: {
          select: {
            onboardingAssistanceStatus: true,
            onboardingAssistanceRequestedAt: true,
            onboardingAssistanceNotes: true,
            accountManagerName: true,
            accountManagerEmail: true,
            supportSlaHours: true,
          },
        },
        _count: {
          select: {
            memberships: true,
            supportTickets: true,
          },
        },
      },
      take,
    })

    const normalized = items
      .map((item) => ({
        orgId: item.id,
        name: item.name,
        slug: item.slug,
        createdAt: item.createdAt,
        subscription: item.subscription,
        membersCount: item._count.memberships,
        supportTicketsCount: item._count.supportTickets,
        onboardingAssistanceStatus:
          item.businessProfile?.onboardingAssistanceStatus ?? "NOT_REQUESTED",
        onboardingAssistanceRequestedAt:
          item.businessProfile?.onboardingAssistanceRequestedAt ?? null,
        onboardingAssistanceNotes:
          item.businessProfile?.onboardingAssistanceNotes ?? null,
        accountManagerName: item.businessProfile?.accountManagerName ?? null,
        accountManagerEmail: item.businessProfile?.accountManagerEmail ?? null,
        supportSlaHours: item.businessProfile?.supportSlaHours ?? 4,
      }))
      .filter((item) =>
        onboardingStatusQuery
          ? item.onboardingAssistanceStatus === onboardingStatusQuery
          : true,
      )

    res.json(ok({ items: normalized }))
  } catch (e) {
    next(e)
  }
})

const accountManagerSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  email: z.string().email().max(320).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  supportSlaHours: z.number().int().min(1).max(168).optional(),
})

businessAdminRouter.get("/orgs/:orgId/account-manager", async (req, res, next) => {
  try {
    const orgId = String(req.params.orgId)
    await ensureBusinessOrg(orgId)

    const profile = await ensureBusinessProfile(orgId)
    res.json(
      ok({
        orgId,
        name: profile.accountManagerName,
        email: profile.accountManagerEmail,
        notes: profile.accountManagerNotes,
        supportSlaHours: profile.supportSlaHours,
      }),
    )
  } catch (e) {
    next(e)
  }
})

businessAdminRouter.post("/orgs/:orgId/account-manager", async (req, res, next) => {
  try {
    const orgId = String(req.params.orgId)
    const body = accountManagerSchema.parse(req.body ?? {})
    await ensureBusinessOrg(orgId)

    const profile = await ensureBusinessProfile(orgId)
    const updated = await prisma.orgBusinessProfile.update({
      where: { id: profile.id },
      data: {
        accountManagerName:
          body.name === undefined ? undefined : (body.name ?? null),
        accountManagerEmail:
          body.email === undefined ? undefined : (body.email ?? null),
        accountManagerNotes:
          body.notes === undefined ? undefined : (body.notes ?? null),
        supportSlaHours:
          body.supportSlaHours === undefined
            ? undefined
            : body.supportSlaHours,
      },
    })

    res.json(
      ok({
        orgId,
        name: updated.accountManagerName,
        email: updated.accountManagerEmail,
        notes: updated.accountManagerNotes,
        supportSlaHours: updated.supportSlaHours,
      }),
    )
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
      )
    }
    next(e)
  }
})

businessAdminRouter.get(
  "/orgs/:orgId/onboarding-assistance",
  async (req, res, next) => {
    try {
      const orgId = String(req.params.orgId)
      await ensureBusinessOrg(orgId)
      const profile = await ensureBusinessProfile(orgId)
      res.json(
        ok({
          orgId,
          status: profile.onboardingAssistanceStatus,
          requestedAt: profile.onboardingAssistanceRequestedAt,
          notes: profile.onboardingAssistanceNotes,
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)

const onboardingAssistancePatchSchema = z.object({
  status: onboardingStatusSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
})

businessAdminRouter.patch(
  "/orgs/:orgId/onboarding-assistance",
  async (req, res, next) => {
    try {
      const orgId = String(req.params.orgId)
      const body = onboardingAssistancePatchSchema.parse(req.body ?? {})
      await ensureBusinessOrg(orgId)
      const profile = await ensureBusinessProfile(orgId)

      const nextStatus = body.status ?? profile.onboardingAssistanceStatus
      const nextRequestedAt =
        nextStatus === "REQUESTED"
          ? profile.onboardingAssistanceRequestedAt ?? new Date()
          : nextStatus === "NOT_REQUESTED"
            ? null
            : profile.onboardingAssistanceRequestedAt

      const updated = await prisma.orgBusinessProfile.update({
        where: { id: profile.id },
        data: {
          onboardingAssistanceStatus: nextStatus,
          onboardingAssistanceRequestedAt: nextRequestedAt,
          onboardingAssistanceNotes:
            body.notes === undefined ? undefined : body.notes ?? null,
        },
      })

      res.json(
        ok({
          orgId,
          status: updated.onboardingAssistanceStatus,
          requestedAt: updated.onboardingAssistanceRequestedAt,
          notes: updated.onboardingAssistanceNotes,
        }),
      )
    } catch (e: any) {
      if (e?.name === "ZodError") {
        return next(
          new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
        )
      }
      next(e)
    }
  },
)
