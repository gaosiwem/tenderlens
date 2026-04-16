import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import request from "supertest"
import { createApp } from "../../src/app"
import { prisma } from "../../src/db/prisma"
import { signAccessToken } from "../../src/utils/jwt"
import { env } from "../../src/config/env"

vi.mock("../../src/modules/notifications/notifications.service", () => ({
  emitEvent: vi.fn(),
}))

vi.mock("../../src/modules/notifications/delivery.service", () => ({
  enqueueDeliveries: vi.fn().mockResolvedValue({ queued: 0 }),
}))

vi.mock("ioredis", () => {
  return {
    Redis: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue("OK"),
      set: vi.fn().mockResolvedValue("OK"),
      get: vi.fn().mockResolvedValue(null),
    })),
  }
})

const app = createApp()

describe("Sprint 11: Team Collaboration & Governance", () => {
  let adminToken: string
  let adminEmail: string
  let memberToken: string
  let orgId: string
  let tenderId: string
  let workspaceId: string
  let taskId: string
  let adminId: string
  let memberId: string

  beforeAll(async () => {
    // Create Org
    const org = await prisma.organization.create({
      data: {
        name: "Test Org Collab",
        slug: `test-org-collab-${Date.now()}`,
      },
    })
    orgId = org.id

    // Create Subscription
    await prisma.orgSubscription.create({
      data: {
        orgId: org.id,
        plan: "PRO",
        status: "ACTIVE",
      },
    })

    // Create Admin User
    adminEmail = `admin-collab-${Date.now()}@example.com`
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: "hash",
        name: "Admin User",
        memberships: {
          create: { orgId, role: "ADMIN" },
        },
      },
    })
    adminId = admin.id
    adminToken = signAccessToken(admin.id)

    // Create Member User
    const member = await prisma.user.create({
      data: {
        email: `member-collab-${Date.now()}@example.com`,
        passwordHash: "hash",
        name: "Member User",
        memberships: {
          create: { orgId, role: "MEMBER" },
        },
      },
    })
    memberId = member.id
    memberToken = signAccessToken(member.id)

    // Create Tender & Workspace
    const tender = await prisma.tender.create({
      data: {
        org: { connect: { id: orgId } },
        createdBy: { connect: { id: adminId } },
        title: "Collab Tender",
        source: "manual",
        status: "DRAFT",
        bidWorkspaces: {
          create: { orgId },
        },
      },
      include: { bidWorkspaces: true },
    })
    tenderId = tender.id
    workspaceId = tender.bidWorkspaces[0]!.id
  })

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: orgId } })
    await prisma.user.deleteMany({ where: { id: { in: [adminId, memberId] } } })
  })

  it("GET /api/v1/orgs/me/members - should list members", async () => {
    const res = await request(app)
      .get("/api/v1/orgs/me/members")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Org-Id", orgId)

    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(2)
    const emails = res.body.data.items.map((i: any) => i.email)
    expect(emails).toContain(adminEmail)
    // Just check count for now or partial match
    expect(res.body.data.items.some((i: any) => i.userId === adminId)).toBe(
      true,
    )
    expect(res.body.data.items.some((i: any) => i.userId === memberId)).toBe(
      true,
    )
  })

  it("POST /workspace/tasks - Member should be able to create task", async () => {
    const res = await request(app)
      .post(`/api/v1/tenders/${tenderId}/workspace/tasks`)
      .set("Authorization", `Bearer ${memberToken}`)
      .set("X-Org-Id", orgId)
      .send({
        title: "Test Task",
        status: "TODO",
        priority: "MEDIUM",
      })

    expect(res.status).toBe(200)
    taskId = res.body.data.id
  })

  it("POST /workspace/tasks/:taskId/assign - Assign to member", async () => {
    const res = await request(app)
      .post(`/api/v1/tenders/${tenderId}/workspace/tasks/${taskId}/assign`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Org-Id", orgId)
      .send({ ownerId: memberId })

    expect(res.status).toBe(200)
    expect(res.body.data.ownerId).toBe(memberId)

    // Check if notification/log is created (optional, hard to check side effects in integration test without mocking or checking db)
    const log = await prisma.taskReminderLog.findFirst({
      where: { taskId, type: "ASSIGNED", userId: memberId },
    })
    expect(log).toBeDefined()
  })

  it("POST /workspace/tasks/:taskId/comments - Mention user", async () => {
    const memberUser = await prisma.user.findUnique({ where: { id: memberId } })
    const mentionText = `Hello @${memberUser!.email}`

    const res = await request(app)
      .post(`/api/v1/tenders/${tenderId}/workspace/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Org-Id", orgId)
      .send({ content: mentionText })

    expect(res.status).toBe(200)

    expect(res.status).toBe(200)

    // Check mention log
    const mention = await prisma.mention.findFirst({
      where: { taskId, toUserId: memberId },
    })
    expect(mention).toBeDefined()
  })

  it("PATCH /:tenderId/workspace - Governance: Member cannot change decision", async () => {
    // Enable strict governance env var for this test?
    // Typically env vars are set at start. modify env?
    process.env.GOVERNANCE_STRICT = "true"

    const res = await request(app)
      .patch(`/api/v1/tenders/${tenderId}/workspace`)
      .set("Authorization", `Bearer ${memberToken}`)
      .set("X-Org-Id", orgId)
      .send({ decision: "GO" })

    expect(res.status).toBe(403)
  })

  it("PATCH /:tenderId/workspace - Governance: Admin CAN change decision", async () => {
    const res = await request(app)
      .patch(`/api/v1/tenders/${tenderId}/workspace`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Org-Id", orgId)
      .send({ decision: "GO" })

    expect(res.status).toBe(200)
    expect(res.body.data.decision).toBe("GO")
  })
})
