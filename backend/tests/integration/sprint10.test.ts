import { describe, test, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import { createApp } from "../../src/app"
import { prisma } from "../../src/db/prisma"
import { signAccessToken } from "../../src/utils/jwt"
import path from "path"
import fs from "fs"

const app = createApp()

describe("Sprint 10: Bid Workspace, Attachments, Risk, Exports", () => {
  let token: string
  let orgId: string
  let userId: string
  let tenderId: string
  let workspaceId: string

  beforeAll(async () => {
    // Clean up
    await prisma.bidAttachment.deleteMany()
    await prisma.bidTask.deleteMany()
    await prisma.bidWorkspace.deleteMany()
    await prisma.tender.deleteMany()

    // Create User
    const email = `sprint10-test-${Date.now()}@example.com`
    const user = await prisma.user.create({
      data: { email, passwordHash: "hash" },
    })
    userId = user.id

    // Create Org
    const org = await prisma.organization.create({
      data: { name: "Sprint 10 Corp", slug: `sprint10-corp-${Date.now()}` },
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

    // Create Membership
    await prisma.membership.create({
      data: { userId: user.id, orgId: org.id, role: "ADMIN" },
    })

    token = signAccessToken(user.id)

    // Create Tender
    const tender = await prisma.tender.create({
      data: {
        orgId,
        title: "Sprint 10 Test Tender",
        createdByUserId: userId,
        status: "DRAFT",
      },
    })
    tenderId = tender.id

    // Create Workspace via API (auto-create logic)
    const res = await request(app)
      .get(`/api/v1/tenders/${tenderId}/workspace`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-org-id", orgId)

    expect(res.status).toBe(200)
    workspaceId = res.body.data.id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test("POST /attachments - Upload an attachment", async () => {
    // Use .png extension to satisfy MIME type validation
    const filePath = path.join(__dirname, "testfile.png")
    fs.writeFileSync(filePath, "test content")

    const res = await request(app)
      .post(`/api/v1/attachments/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-org-id", orgId)
      .attach("file", filePath)

    try {
      fs.unlinkSync(filePath)
    } catch {}

    expect(res.status).toBe(200)
    expect(res.body.data.attachment.filename).toBe("testfile.png")

    // Verify DB
    const dbAtt = await prisma.bidAttachment.findFirst({
      where: { workspaceId },
    })
    expect(dbAtt).toBeTruthy()
    expect(dbAtt?.orgId).toBe(orgId)
  })

  test("POST /risk/:id/compute - Calculate Risk", async () => {
    const res = await request(app)
      .post(`/api/v1/risk/workspaces/${workspaceId}/compute`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-org-id", orgId)

    expect(res.status).toBe(200)
    expect(res.body.data.score).toBeDefined()
    expect(res.body.data.level).toBeDefined()
  })

  test("GET /export/workspace/:id/pdf - Export PDF", async () => {
    const res = await request(app)
      .get(`/api/v1/export/workspace/${tenderId}/pdf`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-org-id", orgId)

    expect(res.status).toBe(200)
    expect(res.header["content-type"]).toBe("application/pdf")
  })

  test("GET /export/workspace/:id/xlsx - Export XLSX", async () => {
    const res = await request(app)
      .get(`/api/v1/export/workspace/${tenderId}/xlsx`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-org-id", orgId)

    expect(res.status).toBe(200)
    expect(res.header["content-type"]).toContain("spreadsheetml")
  })
})
