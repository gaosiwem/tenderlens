import { Router } from "express"
import { prisma } from "../db/prisma"
import { requireAuth } from "../middleware/auth.middleware"
import { requireOrgMembership } from "../middleware/tenant.middleware"
import { requireRole } from "../middleware/rbac.middleware"
import { requireSystemAdmin } from "../middleware/admin.middleware"
import { ok } from "../utils/responses"

export const billingAnalyticsRouter = Router()

type SubscriptionSnapshot = {
  orgId: string
  orgName: string
  orgSlug: string
  plan: string | null
  status: string | null
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
}

type UserAnalyticsRecord = {
  userId: string
  fullName: string | null
  email: string | null
  phone: string | null
  createdAt: Date
  subscriptions: SubscriptionSnapshot[]
  trackedEventCount: number
  lastActivityAt: Date | null
  topClicks: Map<string, number>
}

function isExpiredTrialSubscription(
  sub: { plan: string | null; status: string | null; trialEndsAt: Date | null },
  now: Date,
) {
  if (sub.status === "EXPIRED") return true
  if (sub.plan !== "TRIAL") return false
  if (!sub.trialEndsAt) return false
  return sub.trialEndsAt.getTime() < now.getTime()
}

function classifyUserLifecycle(subscriptions: SubscriptionSnapshot[], now: Date) {
  if (
    subscriptions.some(
      (sub) => sub.status === "ACTIVE" && sub.plan && sub.plan !== "TRIAL",
    )
  ) {
    return "PAID"
  }
  if (subscriptions.some((sub) => sub.status === "TRIALING")) {
    return "TRIALING"
  }
  if (subscriptions.some((sub) => isExpiredTrialSubscription(sub, now))) {
    return "TRIAL_EXPIRED"
  }
  if (subscriptions.some((sub) => sub.status === "PAST_DUE")) {
    return "PAST_DUE"
  }
  if (subscriptions.some((sub) => sub.status === "CANCELED")) {
    return "CANCELED"
  }
  return "NO_SUBSCRIPTION"
}

function normalizeDisplayName(name: string | null, email: string | null) {
  if (name && name.trim()) return name.trim()
  return email?.trim() || "Unknown user"
}

billingAnalyticsRouter.post(
  "/",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const name = String(req.body?.name ?? "").trim()
      if (!name) {
        return res.json(ok({ ok: true }))
      }

      await prisma.billingEvent.create({
        data: {
          orgId: req.orgId!,
          userId: req.auth!.userId,
          name,
          meta: req.body?.meta ?? null,
        },
      })
      res.json(ok({ ok: true }))
    } catch (e) {
      next(e)
    }
  },
)

/**
 * Global billing event summary for the Command Center
 */
billingAnalyticsRouter.get(
  "/summary",
  requireAuth,
  requireSystemAdmin,
  async (req, res, next) => {
    try {
      const days = Number(req.query.days) || 14
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      // Get count of events per day and name
      // This is a bit complex in Prisma grouping, but let's do a simplified version
      // or raw query if needed. Let's try grouping first.

      const events = await prisma.billingEvent.findMany({
        where: {
          createdAt: { gte: since },
        },
        select: {
          name: true,
          createdAt: true,
        },
      })

      // Aggregate in memory for simplicity in MVP
      const dayMap: Record<string, Record<string, number>> = {}

      events.forEach((e) => {
        const day = e.createdAt.toISOString().split("T")[0]
        if (!dayMap[day]) dayMap[day] = {}
        dayMap[day][e.name] = (dayMap[day][e.name] || 0) + 1
      })

      const items: Array<{ day: string; name: string; count: number }> = []
      Object.keys(dayMap)
        .sort()
        .forEach((day) => {
          Object.keys(dayMap[day]).forEach((name) => {
            items.push({
              day,
              name,
              count: dayMap[day][name],
            })
          })
        })

      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)

billingAnalyticsRouter.get(
  "/advanced",
  requireAuth,
  requireSystemAdmin,
  async (req, res, next) => {
    try {
      const days = Number(req.query.days) || 30
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      const now = new Date()

      const [orgs, events] = await Promise.all([
        prisma.organization.findMany({
          where: {
            name: { not: "Admin Organization" },
          },
          select: {
            id: true,
            name: true,
            slug: true,
            subscription: {
              select: {
                plan: true,
                status: true,
                trialEndsAt: true,
                currentPeriodEnd: true,
              },
            },
            memberships: {
              select: {
                userId: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    createdAt: true,
                  },
                },
              },
            },
            userNotificationPrefs: {
              select: {
                userId: true,
                whatsappNumber: true,
                whatsappVerifiedAt: true,
              },
            },
          },
        }),
        prisma.billingEvent.findMany({
          where: {
            createdAt: { gte: since },
            org: {
              name: { not: "Admin Organization" },
            },
          },
          select: {
            id: true,
            orgId: true,
            userId: true,
            name: true,
            meta: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ])

      const users = new Map<string, UserAnalyticsRecord>()
      const orgNames = new Map<string, { name: string; slug: string }>()

      for (const org of orgs) {
        orgNames.set(org.id, { name: org.name, slug: org.slug })
        const phonePrefs = new Map(
          org.userNotificationPrefs.map((pref) => [pref.userId, pref]),
        )

        for (const membership of org.memberships) {
          const current =
            users.get(membership.userId) ??
            ({
              userId: membership.user.id,
              fullName: membership.user.name,
              email: membership.user.email,
              phone: null,
              createdAt: membership.user.createdAt,
              subscriptions: [],
              trackedEventCount: 0,
              lastActivityAt: null,
              topClicks: new Map<string, number>(),
            } satisfies UserAnalyticsRecord)

          const pref = phonePrefs.get(membership.userId)
          if (
            pref?.whatsappNumber &&
            (pref.whatsappVerifiedAt || !current.phone)
          ) {
            current.phone = pref.whatsappNumber
          }

          if (!current.subscriptions.some((sub) => sub.orgId === org.id)) {
            current.subscriptions.push({
              orgId: org.id,
              orgName: org.name,
              orgSlug: org.slug,
              plan: org.subscription?.plan ?? null,
              status: org.subscription?.status ?? null,
              trialEndsAt: org.subscription?.trialEndsAt ?? null,
              currentPeriodEnd: org.subscription?.currentPeriodEnd ?? null,
            })
          }

          users.set(membership.userId, current)
        }
      }

      const missingEventUserIds = Array.from(
        new Set(
          events
            .map((event) => event.userId)
            .filter(
              (userId): userId is string =>
                typeof userId === "string" && !users.has(userId),
            ),
        ),
      )

      if (missingEventUserIds.length) {
        const missingUsers = await prisma.user.findMany({
          where: { id: { in: missingEventUserIds } },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        })

        for (const user of missingUsers) {
          users.set(user.id, {
            userId: user.id,
            fullName: user.name,
            email: user.email,
            phone: null,
            createdAt: user.createdAt,
            subscriptions: [],
            trackedEventCount: 0,
            lastActivityAt: null,
            topClicks: new Map<string, number>(),
          })
        }
      }

      const eventSummaryMap = new Map<
        string,
        { name: string; count: number; lastSeenAt: Date; userIds: Set<string> }
      >()

      for (const event of events) {
        const summary = eventSummaryMap.get(event.name) ?? {
          name: event.name,
          count: 0,
          lastSeenAt: event.createdAt,
          userIds: new Set<string>(),
        }
        summary.count += 1
        if (event.createdAt.getTime() > summary.lastSeenAt.getTime()) {
          summary.lastSeenAt = event.createdAt
        }
        if (event.userId) summary.userIds.add(event.userId)
        eventSummaryMap.set(event.name, summary)

        if (!event.userId) continue
        const user = users.get(event.userId)
        if (!user) continue

        user.trackedEventCount += 1
        if (
          !user.lastActivityAt ||
          event.createdAt.getTime() > user.lastActivityAt.getTime()
        ) {
          user.lastActivityAt = event.createdAt
        }
        user.topClicks.set(
          event.name,
          (user.topClicks.get(event.name) ?? 0) + 1,
        )
      }

      const userItems = Array.from(users.values())
        .map((user) => {
          const lifecycle = classifyUserLifecycle(user.subscriptions, now)
          return {
            userId: user.userId,
            fullName: normalizeDisplayName(user.fullName, user.email),
            email: user.email,
            phone: user.phone,
            createdAt: user.createdAt,
            lifecycle,
            orgCount: user.subscriptions.length,
            subscriptions: user.subscriptions.sort((a, b) =>
              a.orgName.localeCompare(b.orgName),
            ),
            trackedEventCount: user.trackedEventCount,
            lastActivityAt: user.lastActivityAt,
            topClicks: Array.from(user.topClicks.entries())
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
              .slice(0, 5),
          }
        })
        .sort((a, b) => {
          const activityDelta = b.trackedEventCount - a.trackedEventCount
          if (activityDelta !== 0) return activityDelta
          return a.fullName.localeCompare(b.fullName)
        })

      const summary = {
        totalUsers: userItems.length,
        activeUsers: userItems.filter((user) => user.trackedEventCount > 0).length,
        paidUsers: userItems.filter((user) => user.lifecycle === "PAID").length,
        trialingUsers: userItems.filter((user) => user.lifecycle === "TRIALING")
          .length,
        trialExpiredUsers: userItems.filter(
          (user) => user.lifecycle === "TRIAL_EXPIRED",
        ).length,
        totalTrackedEvents: events.length,
      }

      const eventSummary = Array.from(eventSummaryMap.values())
        .map((item) => ({
          name: item.name,
          count: item.count,
          uniqueUsers: item.userIds.size,
          lastSeenAt: item.lastSeenAt,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

      const recentActivity = events.slice(0, 100).map((event) => {
        const user = event.userId ? users.get(event.userId) : null
        const org = orgNames.get(event.orgId)

        return {
          id: event.id,
          name: event.name,
          createdAt: event.createdAt,
          orgId: event.orgId,
          orgName: org?.name ?? "Unknown organization",
          orgSlug: org?.slug ?? "",
          userId: event.userId ?? null,
          fullName: user
            ? normalizeDisplayName(user.fullName, user.email)
            : "System / unknown user",
          email: user?.email ?? null,
          phone: user?.phone ?? null,
          meta: event.meta ?? null,
        }
      })

      res.json(
        ok({
          summary,
          eventSummary,
          users: userItems,
          recentActivity,
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)
