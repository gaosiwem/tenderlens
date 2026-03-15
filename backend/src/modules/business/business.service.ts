import { prisma } from "../../db/prisma"
import { AppError } from "../../utils/responses"
import { isBusinessPlan } from "../../billing/effective-plan.service"
import { inferTenderLifecycle } from "../tenders/tender.service"

const ALERT_CHANNELS = ["email", "whatsapp"] as const
type AlertChannel = (typeof ALERT_CHANNELS)[number]

function normalizeAlertChannels(input: unknown, fallback: AlertChannel[]) {
  const raw = Array.isArray(input) ? input : []
  const cleaned = raw
    .map((v) => String(v).trim().toLowerCase())
    .filter((v): v is AlertChannel =>
      (ALERT_CHANNELS as readonly string[]).includes(v),
    )
  return cleaned.length ? cleaned : fallback
}

async function isOrgBusiness(orgId: string) {
  const sub = await prisma.orgSubscription.findUnique({
    where: { orgId },
    select: { plan: true },
  })
  return isBusinessPlan(sub?.plan)
}

const ACTIVE_SUPPORT_TICKET_STATUSES = ["open", "in_progress"] as const
const MS_PER_HOUR = 60 * 60 * 1000

export async function ensureBusinessProfile(orgId: string) {
  return prisma.orgBusinessProfile.upsert({
    where: { orgId },
    create: { orgId },
    update: {},
  })
}

export async function getBusinessProfileForOrg(orgId: string) {
  if (!(await isOrgBusiness(orgId))) return null
  return ensureBusinessProfile(orgId)
}

export async function getAlertAutomationForOrg(orgId: string) {
  const profile = await getBusinessProfileForOrg(orgId)
  if (!profile) return null

  return {
    alertAutomationEnabled: profile.alertAutomationEnabled,
    defaultChannels: normalizeAlertChannels(profile.alertDefaultChannels, [
      "email",
    ]),
    alertEscalationEnabled: profile.alertEscalationEnabled,
    alertEscalationMinutes: Math.max(1, profile.alertEscalationMinutes),
    escalationChannels: normalizeAlertChannels(profile.alertEscalationChannels, [
      "whatsapp",
    ]),
  }
}

export async function enforceTaskGovernanceOnCreate(args: {
  orgId: string
  ownerId?: string | null
  dueAt?: Date | null
}) {
  const profile = await getBusinessProfileForOrg(args.orgId)
  if (!profile || !profile.taskGovernanceEnabled) return

  if (profile.requireTaskOwner && !args.ownerId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Task governance requires an assignee for new tasks.",
      400,
      { limitType: "task_governance", field: "ownerId" },
    )
  }

  if (profile.requireTaskDueDate && !args.dueAt) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Task governance requires a due date for new tasks.",
      400,
      { limitType: "task_governance", field: "dueAt" },
    )
  }
}

export async function enforceTaskGovernanceOnStatusChange(args: {
  orgId: string
  nextStatus?: string | null
  ownerId?: string | null
  dueAt?: Date | null
}) {
  if (String(args.nextStatus ?? "").toUpperCase() !== "DONE") return

  const profile = await getBusinessProfileForOrg(args.orgId)
  if (!profile || !profile.taskGovernanceEnabled) return

  if (profile.blockTaskCloseWithoutAssignee && !args.ownerId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Task governance blocks closing tasks without an assignee.",
      400,
      { limitType: "task_governance", field: "ownerId" },
    )
  }

  if (profile.blockTaskCloseWithoutDueDate && !args.dueAt) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Task governance blocks closing tasks without a due date.",
      400,
      { limitType: "task_governance", field: "dueAt" },
    )
  }
}

export async function getBusinessAnalytics(orgId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    workspaces,
    taskTotal,
    taskDone,
    watchlistCount,
    alertsFired30d,
    comparisons30d,
    openSupportTickets,
    templatesCount,
    integrationsCount,
    tenders,
  ] = await Promise.all([
    prisma.bidWorkspace.count({ where: { orgId } }),
    prisma.bidTask.count({ where: { orgId } }),
    prisma.bidTask.count({ where: { orgId, status: "DONE" } }),
    prisma.watchlistItem.count({ where: { orgId } }),
    prisma.notificationEvent.count({
      where: {
        orgId,
        type: "ALERT_FIRED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.tenderComparison.count({
      where: { orgId, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.orgSupportTicket.count({
      where: { orgId, status: { in: ["open", "in_progress"] } },
    }),
    prisma.workspaceTemplate.count({
      where: { orgId, isArchived: false },
    }),
    prisma.orgIntegrationEndpoint.count({
      where: { orgId, isEnabled: true },
    }),
    prisma.tender.findMany({
      where: { orgId },
      select: { scrapedStatus: true, closingDate: true, createdAt: true },
      take: 2000,
      orderBy: { createdAt: "desc" },
    }),
  ])

  const riskAgg = await prisma.bidWorkspace.aggregate({
    where: { orgId },
    _avg: { riskScore: true },
  })

  const tendersByLifecycle = {
    open: 0,
    awarded: 0,
    closed: 0,
    cancelled: 0,
    other: 0,
  }

  for (const row of tenders) {
    const lifecycle = inferTenderLifecycle({
      scrapedStatus: row.scrapedStatus,
      closingDate: row.closingDate,
    })
    if (lifecycle === "open") tendersByLifecycle.open++
    else if (lifecycle === "awarded") tendersByLifecycle.awarded++
    else if (lifecycle === "closed") tendersByLifecycle.closed++
    else if (lifecycle === "cancelled") tendersByLifecycle.cancelled++
    else tendersByLifecycle.other++
  }

  const completionRate = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0

  return {
    workspaces,
    tasks: {
      total: taskTotal,
      completed: taskDone,
      completionRate,
    },
    watchlistCount,
    alertsFired30d,
    comparisons30d,
    openSupportTickets,
    templatesCount,
    integrationsCount,
    avgRiskScore: Number((riskAgg._avg.riskScore ?? 0).toFixed(2)),
    tendersByLifecycle,
  }
}

type SlaTicketLike = {
  status: string
  priority: string
  createdAt: Date
}

export function getSupportTicketSlaMeta(
  ticket: SlaTicketLike,
  supportSlaHours: number,
) {
  const safeHours = Math.max(1, Number(supportSlaHours || 1))
  const dueAt = new Date(ticket.createdAt.getTime() + safeHours * MS_PER_HOUR)
  const remainingMs = dueAt.getTime() - Date.now()
  const remainingMinutes = Math.ceil(remainingMs / (60 * 1000))
  const status = String(ticket.status ?? "").toLowerCase()
  const isActive = ACTIVE_SUPPORT_TICKET_STATUSES.includes(
    status as (typeof ACTIVE_SUPPORT_TICKET_STATUSES)[number],
  )
  const slaBreached = isActive && remainingMs < 0
  const escalated =
    slaBreached && String(ticket.priority ?? "").toLowerCase() === "urgent"

  return {
    slaDueAt: dueAt.toISOString(),
    slaRemainingMinutes: remainingMinutes,
    slaBreached,
    escalated,
  }
}

export async function applySupportTicketSlaEscalation(
  orgId: string,
  supportSlaHours: number,
) {
  const safeHours = Math.max(1, Number(supportSlaHours || 1))
  const breachedBefore = new Date(Date.now() - safeHours * MS_PER_HOUR)
  const targets = await prisma.orgSupportTicket.findMany({
    where: {
      orgId,
      status: { in: [...ACTIVE_SUPPORT_TICKET_STATUSES] },
      resolvedAt: null,
      createdAt: { lte: breachedBefore },
      priority: { not: "urgent" },
    },
    select: { id: true },
    take: 500,
  })

  if (targets.length === 0) {
    return { escalated: 0, ticketIds: [] as string[], supportSlaHours: safeHours }
  }

  const escalatedIds: string[] = []
  await prisma.$transaction(async (tx) => {
    for (const target of targets) {
      const updated = await tx.orgSupportTicket.updateMany({
        where: {
          id: target.id,
          orgId,
          status: { in: [...ACTIVE_SUPPORT_TICKET_STATUSES] },
          resolvedAt: null,
          createdAt: { lte: breachedBefore },
          priority: { not: "urgent" },
        },
        data: { priority: "urgent" },
      })
      if (updated.count === 1) {
        escalatedIds.push(target.id)
      }
    }
  })

  return {
    escalated: escalatedIds.length,
    ticketIds: escalatedIds,
    supportSlaHours: safeHours,
  }
}

export function sanitizeWorkspaceTemplateTasks(tasks: unknown) {
  const raw = Array.isArray(tasks) ? tasks : []
  return raw
    .map((item: any, idx) => {
      const title = String(item?.title ?? "")
        .trim()
        .slice(0, 200)
      if (!title) return null
      const description =
        item?.description === undefined || item?.description === null
          ? null
          : String(item.description).slice(0, 2000)
      const priority = String(item?.priority ?? "MEDIUM")
        .trim()
        .toUpperCase()
      const dueInDays =
        item?.dueInDays === undefined || item?.dueInDays === null
          ? null
          : Number(item.dueInDays)
      const tags = Array.isArray(item?.tags)
        ? item.tags.map((t: unknown) => String(t).trim()).filter(Boolean)
        : []
      return {
        title,
        description,
        priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)
          ? priority
          : "MEDIUM",
        dueInDays:
          Number.isFinite(dueInDays) && Number(dueInDays) >= 0
            ? Number(dueInDays)
            : null,
        tags,
        sortOrder:
          Number.isFinite(Number(item?.sortOrder)) &&
          Number(item?.sortOrder) >= 0
            ? Number(item.sortOrder)
            : idx,
      }
    })
    .filter(Boolean) as Array<{
    title: string
    description: string | null
    priority: string
    dueInDays: number | null
    tags: string[]
    sortOrder: number
  }>
}
