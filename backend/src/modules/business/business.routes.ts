import { Router } from "express"
import { z } from "zod"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok, AppError } from "../../utils/responses"
import { prisma } from "../../db/prisma"
import { requireBusinessPlan } from "../../billing/plan.middleware"
import {
  applySupportTicketSlaEscalation,
  ensureBusinessProfile,
  getSupportTicketSlaMeta,
  getBusinessAnalytics,
  sanitizeWorkspaceTemplateTasks,
} from "./business.service"
import { emitSupportSlaEscalationEvents } from "./support-escalation.service"
import { ensureOrgBillingPolicy } from "../billing/policy.service"
import { getOrCreateWorkspace } from "../workspace/workspace.service"

export const businessRouter = Router()

function normalizeChannels(input: unknown) {
  const raw = Array.isArray(input) ? input : []
  const channels = raw
    .map((v) => String(v).trim().toLowerCase())
    .filter((v) => v === "email" || v === "whatsapp")
  return Array.from(new Set(channels))
}

businessRouter.use(requireAuth, requireOrgMembership, requireRole("VIEWER"))
businessRouter.use(async (req, _res, next) => {
  try {
    await requireBusinessPlan(req.orgId!)
    next()
  } catch (e) {
    next(e)
  }
})

businessRouter.get("/profile", async (req, res, next) => {
  try {
    const [profile, policy] = await Promise.all([
      ensureBusinessProfile(req.orgId!),
      ensureOrgBillingPolicy(req.orgId!),
    ])

    res.json(
      ok({
        profile,
        customLimits: {
          maxAiQueries: policy.customMaxAiQueries,
          maxWatchlist: policy.customMaxWatchlist,
          maxMembers: policy.customMaxMembers,
          exportsEnabled: policy.customExportsEnabled,
          workspaceEnabled: policy.customWorkspaceEnabled,
          compareEnabled: policy.customCompareEnabled,
          whatsappEnabled: policy.customWhatsappEnabled,
          riskEnabled: policy.customRiskEnabled,
        },
      }),
    )
  } catch (e) {
    next(e)
  }
})

const profilePatchSchema = z.object({
  alertAutomationEnabled: z.boolean().optional(),
  alertDefaultChannels: z.array(z.string()).optional(),
  alertEscalationEnabled: z.boolean().optional(),
  alertEscalationMinutes: z.number().int().min(1).max(1440).optional(),
  alertEscalationChannels: z.array(z.string()).optional(),
  taskGovernanceEnabled: z.boolean().optional(),
  requireTaskOwner: z.boolean().optional(),
  requireTaskDueDate: z.boolean().optional(),
  blockTaskCloseWithoutAssignee: z.boolean().optional(),
  blockTaskCloseWithoutDueDate: z.boolean().optional(),
})

businessRouter.post(
  "/profile",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const body = profilePatchSchema.parse(req.body ?? {})
      const profile = await ensureBusinessProfile(req.orgId!)

      const data: Record<string, unknown> = {}
      if (body.alertAutomationEnabled !== undefined)
        data.alertAutomationEnabled = body.alertAutomationEnabled
      if (body.alertEscalationEnabled !== undefined)
        data.alertEscalationEnabled = body.alertEscalationEnabled
      if (body.alertEscalationMinutes !== undefined)
        data.alertEscalationMinutes = body.alertEscalationMinutes
      if (body.taskGovernanceEnabled !== undefined)
        data.taskGovernanceEnabled = body.taskGovernanceEnabled
      if (body.requireTaskOwner !== undefined)
        data.requireTaskOwner = body.requireTaskOwner
      if (body.requireTaskDueDate !== undefined)
        data.requireTaskDueDate = body.requireTaskDueDate
      if (body.blockTaskCloseWithoutAssignee !== undefined)
        data.blockTaskCloseWithoutAssignee = body.blockTaskCloseWithoutAssignee
      if (body.blockTaskCloseWithoutDueDate !== undefined)
        data.blockTaskCloseWithoutDueDate = body.blockTaskCloseWithoutDueDate
      if (body.alertDefaultChannels !== undefined) {
        const channels = normalizeChannels(body.alertDefaultChannels)
        data.alertDefaultChannels = channels.length ? channels : ["email"]
      }
      if (body.alertEscalationChannels !== undefined) {
        const channels = normalizeChannels(body.alertEscalationChannels)
        data.alertEscalationChannels = channels.length ? channels : ["whatsapp"]
      }

      const updated = await prisma.orgBusinessProfile.update({
        where: { id: profile.id },
        data,
      })

      res.json(ok(updated))
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

const customLimitsSchema = z.object({
  maxAiQueries: z.number().int().min(1).max(1_000_000).nullable().optional(),
  maxWatchlist: z.number().int().min(1).max(100_000).nullable().optional(),
  maxMembers: z.number().int().min(1).max(500).nullable().optional(),
  exportsEnabled: z.boolean().nullable().optional(),
  workspaceEnabled: z.boolean().nullable().optional(),
  compareEnabled: z.boolean().nullable().optional(),
  whatsappEnabled: z.boolean().nullable().optional(),
  riskEnabled: z.boolean().nullable().optional(),
})

businessRouter.post(
  "/custom-limits",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const body = customLimitsSchema.parse(req.body ?? {})
      const policy = await ensureOrgBillingPolicy(req.orgId!)
      const updated = await prisma.orgBillingPolicy.update({
        where: { id: policy.id },
        data: {
          customMaxAiQueries:
            body.maxAiQueries === undefined ? undefined : body.maxAiQueries,
          customMaxWatchlist:
            body.maxWatchlist === undefined ? undefined : body.maxWatchlist,
          customMaxMembers:
            body.maxMembers === undefined ? undefined : body.maxMembers,
          customExportsEnabled:
            body.exportsEnabled === undefined ? undefined : body.exportsEnabled,
          customWorkspaceEnabled:
            body.workspaceEnabled === undefined
              ? undefined
              : body.workspaceEnabled,
          customCompareEnabled:
            body.compareEnabled === undefined ? undefined : body.compareEnabled,
          customWhatsappEnabled:
            body.whatsappEnabled === undefined
              ? undefined
              : body.whatsappEnabled,
          customRiskEnabled:
            body.riskEnabled === undefined ? undefined : body.riskEnabled,
        },
      })

      res.json(
        ok({
          maxAiQueries: updated.customMaxAiQueries,
          maxWatchlist: updated.customMaxWatchlist,
          maxMembers: updated.customMaxMembers,
          exportsEnabled: updated.customExportsEnabled,
          workspaceEnabled: updated.customWorkspaceEnabled,
          compareEnabled: updated.customCompareEnabled,
          whatsappEnabled: updated.customWhatsappEnabled,
          riskEnabled: updated.customRiskEnabled,
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

businessRouter.get("/analytics", async (req, res, next) => {
  try {
    const analytics = await getBusinessAnalytics(req.orgId!)
    res.json(ok({ analytics }))
  } catch (e) {
    next(e)
  }
})

businessRouter.get("/templates", async (req, res, next) => {
  try {
    const items = await prisma.workspaceTemplate.findMany({
      where: { orgId: req.orgId!, isArchived: false },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      include: {
        tasks: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    })
    res.json(ok({ items }))
  } catch (e) {
    next(e)
  }
})

const templateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  tags: z.array(z.string().min(1).max(50)).max(12).optional(),
  dueInDays: z.number().int().min(0).max(365).nullable().optional(),
  sortOrder: z.number().int().min(0).max(500).optional(),
})

const upsertTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(600).nullable().optional(),
  isDefault: z.boolean().optional(),
  tasks: z.array(templateTaskSchema).max(80).optional(),
})

businessRouter.post(
  "/templates",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const body = upsertTemplateSchema.parse(req.body ?? {})
      const tasks = sanitizeWorkspaceTemplateTasks(body.tasks ?? [])

      const created = await prisma.workspaceTemplate.create({
        data: {
          orgId: req.orgId!,
          name: body.name,
          description: body.description ?? null,
          isDefault: body.isDefault ?? false,
          createdBy: req.auth!.userId,
          tasks: {
            create: tasks,
          },
        },
        include: {
          tasks: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      })

      if (created.isDefault) {
        await prisma.workspaceTemplate.updateMany({
          where: { orgId: req.orgId!, id: { not: created.id } },
          data: { isDefault: false },
        })
      }

      res.json(ok(created))
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

businessRouter.patch(
  "/templates/:id",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const body = upsertTemplateSchema.partial().parse(req.body ?? {})
      const id = String(req.params.id)
      const existing = await prisma.workspaceTemplate.findFirst({
        where: { id, orgId: req.orgId!, isArchived: false },
      })
      if (!existing) throw new AppError("NOT_FOUND", "Category not found", 404)

      const tasksProvided = body.tasks !== undefined
      const tasks = tasksProvided
        ? sanitizeWorkspaceTemplateTasks(body.tasks ?? [])
        : null

      const updated = await prisma.$transaction(async (tx) => {
        const item = await tx.workspaceTemplate.update({
          where: { id: existing.id },
          data: {
            name: body.name ?? undefined,
            description:
              body.description === undefined ? undefined : body.description,
            isDefault:
              body.isDefault === undefined ? undefined : body.isDefault,
          },
        })

        if (tasksProvided) {
          await tx.workspaceTemplateTask.deleteMany({
            where: { templateId: item.id },
          })
          if (tasks && tasks.length > 0) {
            await tx.workspaceTemplateTask.createMany({
              data: tasks.map((task) => ({
                templateId: item.id,
                ...task,
              })),
            })
          }
        }

        if (item.isDefault) {
          await tx.workspaceTemplate.updateMany({
            where: { orgId: req.orgId!, id: { not: item.id } },
            data: { isDefault: false },
          })
        }

        return tx.workspaceTemplate.findUniqueOrThrow({
          where: { id: item.id },
          include: {
            tasks: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
        })
      })

      res.json(ok(updated))
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

businessRouter.delete(
  "/templates/:id",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id)
      const existing = await prisma.workspaceTemplate.findFirst({
        where: { id, orgId: req.orgId!, isArchived: false },
      })
      if (!existing) throw new AppError("NOT_FOUND", "Category not found", 404)
      await prisma.workspaceTemplate.update({
        where: { id: existing.id },
        data: { isArchived: true, isDefault: false },
      })
      res.json(ok({ deleted: true }))
    } catch (e) {
      next(e)
    }
  },
)

businessRouter.post(
  "/templates/:id/apply/:tenderId",
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id)
      const tenderId = String(req.params.tenderId)
      const template = await prisma.workspaceTemplate.findFirst({
        where: { id, orgId: req.orgId!, isArchived: false },
        include: {
          tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      })
      if (!template) throw new AppError("NOT_FOUND", "Category not found", 404)

      const workspace = await getOrCreateWorkspace({
        orgId: req.orgId!,
        tenderId,
      })
      const existingTasks = await prisma.bidTask.findMany({
        where: { workspaceId: workspace.id },
        select: { title: true },
      })
      const existingTitles = new Set(
        existingTasks.map((task) => task.title.trim().toLowerCase()),
      )

      const now = Date.now()
      const itemsToCreate = template.tasks
        .filter((task) => !existingTitles.has(task.title.trim().toLowerCase()))
        .map((task) => ({
          workspaceId: workspace.id,
          orgId: req.orgId!,
          createdBy: req.auth!.userId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: "TODO",
          tags: task.tags,
          dueAt:
            task.dueInDays === null || task.dueInDays === undefined
              ? null
              : new Date(now + task.dueInDays * 24 * 60 * 60 * 1000),
        }))

      if (itemsToCreate.length > 0) {
        await prisma.bidTask.createMany({ data: itemsToCreate })
      }

      res.json(ok({ created: itemsToCreate.length, workspaceId: workspace.id }))
    } catch (e) {
      next(e)
    }
  },
)

const integrationSchema = z.object({
  name: z.string().min(1).max(120),
  endpointUrl: z.string().url(),
  authType: z.enum(["none", "bearer"]).optional(),
  authToken: z.string().max(2048).nullable().optional(),
  isEnabled: z.boolean().optional(),
  subscribedEvents: z.array(z.string().min(1).max(80)).max(32).optional(),
})

businessRouter.get("/integrations", async (req, res, next) => {
  try {
    const items = await prisma.orgIntegrationEndpoint.findMany({
      where: { orgId: req.orgId! },
      orderBy: { updatedAt: "desc" },
    })
    res.json(
      ok({
        items: items.map((item) => ({
          ...item,
          authToken: item.authToken ? "********" : null,
          hasAuthToken: Boolean(item.authToken),
        })),
      }),
    )
  } catch (e) {
    next(e)
  }
})

businessRouter.post(
  "/integrations",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const body = integrationSchema.parse(req.body ?? {})
      const created = await prisma.orgIntegrationEndpoint.create({
        data: {
          orgId: req.orgId!,
          name: body.name,
          endpointUrl: body.endpointUrl,
          authType: body.authType ?? "none",
          authToken: body.authToken ?? null,
          isEnabled: body.isEnabled ?? true,
          subscribedEvents: body.subscribedEvents ?? [],
        },
      })
      res.json(ok(created))
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

businessRouter.patch(
  "/integrations/:id",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id)
      const body = integrationSchema.partial().parse(req.body ?? {})
      const existing = await prisma.orgIntegrationEndpoint.findFirst({
        where: { id, orgId: req.orgId! },
      })
      if (!existing)
        throw new AppError("NOT_FOUND", "Integration not found", 404)

      const updated = await prisma.orgIntegrationEndpoint.update({
        where: { id: existing.id },
        data: {
          name: body.name,
          endpointUrl: body.endpointUrl,
          authType: body.authType,
          authToken:
            body.authToken === undefined ? undefined : (body.authToken ?? null),
          isEnabled: body.isEnabled,
          subscribedEvents: body.subscribedEvents,
        },
      })
      res.json(ok(updated))
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

businessRouter.delete(
  "/integrations/:id",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id)
      const existing = await prisma.orgIntegrationEndpoint.findFirst({
        where: { id, orgId: req.orgId! },
      })
      if (!existing)
        throw new AppError("NOT_FOUND", "Integration not found", 404)
      await prisma.orgIntegrationEndpoint.delete({ where: { id: existing.id } })
      res.json(ok({ deleted: true }))
    } catch (e) {
      next(e)
    }
  },
)

businessRouter.get("/integrations/exports/tenders", async (req, res, next) => {
  try {
    const take = Math.min(1000, Math.max(1, Number(req.query.take ?? "200")))
    const lifecycle = String(req.query.lifecycle ?? "all")
      .trim()
      .toLowerCase()
    const where: Record<string, unknown> = { orgId: req.orgId! }
    if (lifecycle === "awarded") {
      where.scrapedStatus = { contains: "award", mode: "insensitive" }
    } else if (lifecycle === "closed") {
      where.scrapedStatus = { contains: "closed", mode: "insensitive" }
    } else if (lifecycle === "cancelled") {
      where.scrapedStatus = { contains: "cancel", mode: "insensitive" }
    } else if (lifecycle === "open") {
      where.OR = [
        { scrapedStatus: null },
        { scrapedStatus: { contains: "publish", mode: "insensitive" } },
        { scrapedStatus: { contains: "open", mode: "insensitive" } },
      ]
    }

    const items = await prisma.tender.findMany({
      where,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        externalId: true,
        title: true,
        description: true,
        category: true,
        companyName: true,
        publishedDate: true,
        closingDate: true,
        amount: true,
        scrapedStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    res.json(ok({ items, count: items.length }))
  } catch (e) {
    next(e)
  }
})

businessRouter.get("/onboarding-assistance", async (req, res, next) => {
  try {
    const profile = await ensureBusinessProfile(req.orgId!)
    res.json(
      ok({
        status: profile.onboardingAssistanceStatus,
        requestedAt: profile.onboardingAssistanceRequestedAt,
        notes: profile.onboardingAssistanceNotes,
      }),
    )
  } catch (e) {
    next(e)
  }
})

const onboardingAssistanceSchema = z.object({
  notes: z.string().max(2000).optional(),
})

businessRouter.post(
  "/onboarding-assistance/request",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const body = onboardingAssistanceSchema.parse(req.body ?? {})
      const profile = await ensureBusinessProfile(req.orgId!)
      const updated = await prisma.orgBusinessProfile.update({
        where: { id: profile.id },
        data: {
          onboardingAssistanceStatus: "REQUESTED",
          onboardingAssistanceRequestedAt: new Date(),
          onboardingAssistanceNotes: body.notes ?? null,
        },
      })
      res.json(
        ok({
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

businessRouter.get("/support/tickets", async (req, res, next) => {
  try {
    const profile = await ensureBusinessProfile(req.orgId!)
    const escalation = await applySupportTicketSlaEscalation(
      req.orgId!,
      profile.supportSlaHours,
    )
    if (escalation.ticketIds.length > 0) {
      await emitSupportSlaEscalationEvents({
        orgId: req.orgId!,
        ticketIds: escalation.ticketIds,
        supportSlaHours: escalation.supportSlaHours,
      })
    }
    const items = await prisma.orgSupportTicket.findMany({
      where: { orgId: req.orgId! },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    res.json(
      ok({
        items: items.map((item) => ({
          ...item,
          ...getSupportTicketSlaMeta(item, profile.supportSlaHours),
        })),
      }),
    )
  } catch (e) {
    next(e)
  }
})

const supportCreateSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
})

businessRouter.post("/support/tickets", async (req, res, next) => {
  try {
    const body = supportCreateSchema.parse(req.body ?? {})
    const profile = await ensureBusinessProfile(req.orgId!)
    const created = await prisma.orgSupportTicket.create({
      data: {
        orgId: req.orgId!,
        createdBy: req.auth!.userId,
        subject: body.subject,
        description: body.description,
        priority: body.priority ?? "normal",
      },
    })
    res.json(ok({ ...created, ...getSupportTicketSlaMeta(created, profile.supportSlaHours) }))
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
      )
    }
    next(e)
  }
})

const supportUpdateSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  resolutionNotes: z.string().max(5000).nullable().optional(),
})

businessRouter.patch(
  "/support/tickets/:id",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id)
      const body = supportUpdateSchema.parse(req.body ?? {})
      const existing = await prisma.orgSupportTicket.findFirst({
        where: { id, orgId: req.orgId! },
      })
      if (!existing)
        throw new AppError("NOT_FOUND", "Support ticket not found", 404)

      const status = body.status ?? existing.status
      const requiresResolution =
        status === "resolved" || status === "closed"
      const nextResolutionNotes =
        body.resolutionNotes === undefined
          ? existing.resolutionNotes
          : body.resolutionNotes ?? null
      if (requiresResolution && !String(nextResolutionNotes ?? "").trim()) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Resolution notes are required when resolving or closing a support ticket.",
          400,
        )
      }

      const updated = await prisma.orgSupportTicket.update({
        where: { id: existing.id },
        data: {
          status,
          resolutionNotes: nextResolutionNotes ?? null,
          resolvedAt:
            status === "resolved" || status === "closed" ? new Date() : null,
        },
      })
      const profile = await ensureBusinessProfile(req.orgId!)
      res.json(
        ok({ ...updated, ...getSupportTicketSlaMeta(updated, profile.supportSlaHours) }),
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

businessRouter.get("/account-manager", async (req, res, next) => {
  try {
    const profile = await ensureBusinessProfile(req.orgId!)
    res.json(
      ok({
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
