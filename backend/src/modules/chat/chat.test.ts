import { describe, it, expect } from "vitest"
import request from "supertest"
import { createApp } from "../../app"

const app = createApp()

async function registerAndLogin() {
  const email = `chat_${Date.now()}_${Math.random().toString(16).slice(2)}@example.com`
  const password = "StrongPass123!"

  const reg = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password, name: "Chat Tester" })
  expect(reg.status).toBe(200)
  expect(reg.body.ok).toBe(true)

  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password })
  expect(login.status).toBe(200)
  expect(login.body.ok).toBe(true)
  expect(login.body.data.accessToken).toBeTruthy()

  return { accessToken: login.body.data.accessToken as string }
}

describe("chat module", () => {
  it("creates, posts, lists, and loads a conversation", async () => {
    const { accessToken } = await registerAndLogin()

    const orgRes = await request(app)
      .post("/api/v1/orgs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: `Chat Org ${Date.now()}` })
    expect(orgRes.status).toBe(200)
    expect(orgRes.body.ok).toBe(true)
    const orgId = orgRes.body.data.id as string
    expect(orgId).toBeTruthy()

    const createRes = await request(app)
      .post("/api/v1/chat/conversations")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-org-id", orgId)
      .send({ title: "Test Conversation" })
    expect(createRes.status).toBe(200)
    expect(createRes.body.ok).toBe(true)
    const conversationId = createRes.body.data.id as string
    expect(conversationId).toBeTruthy()

    const postRes = await request(app)
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-org-id", orgId)
      .send({ question: "What is the summary?" })
    expect(postRes.status).toBe(200)
    expect(postRes.body.ok).toBe(true)
    expect(postRes.body.data.user.role).toBe("user")
    expect(postRes.body.data.assistant.role).toBe("assistant")

    const getRes = await request(app)
      .get(`/api/v1/chat/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-org-id", orgId)
    expect(getRes.status).toBe(200)
    expect(getRes.body.ok).toBe(true)
    expect(Array.isArray(getRes.body.data.messages)).toBe(true)
    expect(getRes.body.data.messages.length).toBeGreaterThanOrEqual(2)

    const listRes = await request(app)
      .get("/api/v1/chat/conversations")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-org-id", orgId)
    expect(listRes.status).toBe(200)
    expect(listRes.body.ok).toBe(true)
    expect(
      listRes.body.data.items.some((c: { id: string }) => c.id === conversationId),
    ).toBe(true)
  })

  it("returns idle context progress for non-tender conversations", async () => {
    const { accessToken } = await registerAndLogin()

    const orgRes = await request(app)
      .post("/api/v1/orgs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: `Chat Org ${Date.now()}` })
    const orgId = orgRes.body.data.id as string

    const createRes = await request(app)
      .post("/api/v1/chat/conversations")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-org-id", orgId)
      .send({ title: "No Tender Context" })
    const conversationId = createRes.body.data.id as string

    const progressRes = await request(app)
      .get(`/api/v1/chat/conversations/${conversationId}/context-progress`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-org-id", orgId)

    expect(progressRes.status).toBe(200)
    expect(progressRes.body.ok).toBe(true)
    expect(progressRes.body.data.phase).toBe("idle")
    expect(progressRes.body.data.progressPercent).toBe(100)
    expect(progressRes.body.data.tenderId).toBeNull()
  })
})
