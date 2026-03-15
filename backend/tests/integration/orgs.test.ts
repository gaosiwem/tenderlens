import "../setup"
import request from "supertest"
import { describe, it, expect } from "vitest"
import { createApp } from "../../src/app"
import { prisma } from "../../src/db/prisma"

const app = createApp()

async function registerAndLogin(email: string) {
  const password = "StrongPass123!"
  await request(app).post("/api/v1/auth/register").send({ email, password })
  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password })
  return { accessToken: login.body.data.accessToken as string }
}

describe("orgs tenant isolation and rbac", () => {
  it("prevents non-member from accessing org members", async () => {
    const a = await registerAndLogin(`a_${Date.now()}@ex.com`)
    const b = await registerAndLogin(`b_${Date.now()}@ex.com`)

    const orgRes = await request(app)
      .post("/api/v1/orgs")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ name: "Org A" })

    const orgId = orgRes.body.data.id as string

    const forbidden = await request(app)
      .get(`/api/v1/orgs/${orgId}/members`)
      .set("Authorization", `Bearer ${b.accessToken}`)

    expect(forbidden.status).toBe(403)
    expect(forbidden.body.ok).toBe(false)
  })

  it("viewer cannot list members while owner can", async () => {
    const owner = await registerAndLogin(`owner_${Date.now()}@ex.com`)
    const viewerEmail = `viewer_${Date.now()}@ex.com`
    const viewer = await registerAndLogin(viewerEmail)
    const orgRes = await request(app)
      .post("/api/v1/orgs")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Org RBAC" })
    const orgId = orgRes.body.data.id as string

    // Upgrade to PRO to allow members
    await prisma.orgSubscription.update({
      where: { orgId },
      data: { plan: "PRO", status: "ACTIVE", seatsPurchased: 5 },
    })

    const addViewer = await request(app)
      .post(`/api/v1/orgs/${orgId}/members`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ email: viewerEmail, role: "VIEWER" })

    expect(addViewer.status).toBe(200)

    const listMembersByOwner = await request(app)
      .get(`/api/v1/orgs/${orgId}/members`)
      .set("Authorization", `Bearer ${owner.accessToken}`)

    expect(listMembersByOwner.status).toBe(200)

    const viewerList = await request(app)
      .get(`/api/v1/orgs/${orgId}/members`)
      .set("Authorization", `Bearer ${viewer.accessToken}`)

    expect(viewerList.status).toBe(403)
    expect(viewerList.body.ok).toBe(false)
  })
})
