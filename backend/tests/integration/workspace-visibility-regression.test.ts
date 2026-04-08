import { afterAll, beforeAll, describe, expect, it } from "vitest"
import request from "supertest"
import { createApp } from "../../src/app"
import { prisma } from "../../src/db/prisma"
import { signAccessToken } from "../../src/utils/jwt"

const app = createApp()

describe("workspace visibility regression", () => {
  let orgId = ""
  let adminId = ""
  let viewerId = ""
  let memberId = ""
  let adminToken = ""
  let viewerToken = ""
  let memberToken = ""
  let tenderId = ""

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: {
        name: `Workspace Visibility Org ${Date.now()}`,
        slug: `workspace-visibility-org-${Date.now()}`,
      },
    })
    orgId = org.id

    await prisma.orgSubscription.create({
      data: {
        orgId,
        plan: "TRIAL",
        status: "TRIALING",
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const [admin, viewer, member] = await Promise.all([
      prisma.user.create({
        data: {
          email: `workspace-admin-${Date.now()}@example.com`,
          passwordHash: "hash",
        },
      }),
      prisma.user.create({
        data: {
          email: `workspace-viewer-${Date.now()}@example.com`,
          passwordHash: "hash",
        },
      }),
      prisma.user.create({
        data: {
          email: `workspace-member-${Date.now()}@example.com`,
          passwordHash: "hash",
        },
      }),
    ])

    adminId = admin.id
    viewerId = viewer.id
    memberId = member.id
    adminToken = signAccessToken(adminId)
    viewerToken = signAccessToken(viewerId)
    memberToken = signAccessToken(memberId)

    await prisma.membership.createMany({
      data: [
        { orgId, userId: adminId, role: "ADMIN" },
        { orgId, userId: viewerId, role: "VIEWER" },
        { orgId, userId: memberId, role: "MEMBER" },
      ],
    })

    const tender = await prisma.tender.create({
      data: {
        orgId,
        title: "Workspace Visibility Tender",
        createdByUserId: adminId,
        status: "DRAFT",
      },
    })
    tenderId = tender.id
  })

  afterAll(async () => {
    if (orgId) {
      await prisma.organization.deleteMany({ where: { id: orgId } })
    }
    if (adminId || viewerId || memberId) {
      await prisma.user.deleteMany({
        where: {
          id: { in: [adminId, viewerId, memberId].filter(Boolean) as string[] },
        },
      })
    }
    await prisma.$disconnect()
  })

  it("allows viewer to load workspace/full", async () => {
    const res = await request(app)
      .get(`/api/v1/tenders/${tenderId}/workspace/full`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .set("x-org-id", orgId)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.tenderId).toBe(tenderId)
  })

  it("blocks viewer from creating task", async () => {
    const res = await request(app)
      .post(`/api/v1/tenders/${tenderId}/workspace/tasks`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .set("x-org-id", orgId)
      .send({
        title: "Viewer should not create",
      })

    expect(res.status).toBe(403)
    expect(res.body?.error?.code).toBe("FORBIDDEN")
  })

  it("allows member to create first task in an empty workspace", async () => {
    const res = await request(app)
      .post(`/api/v1/tenders/${tenderId}/workspace/tasks`)
      .set("Authorization", `Bearer ${memberToken}`)
      .set("x-org-id", orgId)
      .send({
        title: "First workspace task",
        status: "TODO",
        priority: "MEDIUM",
      })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.title).toBe("First workspace task")
  })

  it("blocks member from deleting workspace", async () => {
    const res = await request(app)
      .delete(`/api/v1/workspace/${tenderId}/workspace`)
      .set("Authorization", `Bearer ${memberToken}`)
      .set("x-org-id", orgId)

    expect(res.status).toBe(403)
    expect(res.body?.error?.code).toBe("FORBIDDEN")
  })

  it("allows admin to delete workspace", async () => {
    const existingWorkspace = await prisma.bidWorkspace.findFirst({
      where: { orgId, tenderId },
      select: { id: true },
    })
    expect(existingWorkspace?.id).toBeTruthy()

    const res = await request(app)
      .delete(`/api/v1/workspace/${tenderId}/workspace`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-org-id", orgId)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.deleted).toBe(true)
    expect(res.body.data.workspaceId).toBe(existingWorkspace?.id ?? null)

    const deletedWorkspace = await prisma.bidWorkspace.findFirst({
      where: { orgId, tenderId },
    })
    expect(deletedWorkspace).toBeNull()
  })

  it("returns explicit plan-gate denial when workspace is force-disabled", async () => {
    await prisma.orgBillingPolicy.upsert({
      where: { orgId },
      create: {
        orgId,
        customWorkspaceEnabled: false,
      },
      update: {
        customWorkspaceEnabled: false,
      },
    })

    const res = await request(app)
      .get(`/api/v1/tenders/${tenderId}/workspace/full`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-org-id", orgId)

    expect(res.status).toBe(403)
    expect(res.body?.error?.code).toBe("PLAN_UPGRADE_REQUIRED")
  })
})
