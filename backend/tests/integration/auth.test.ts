import "../setup"
import request from "supertest"
import { describe, it, expect } from "vitest"
import { createApp } from "../../src/app"
import { prisma } from "../../src/db/prisma"

const app = createApp()

describe("auth", () => {
  const email = `user_${Date.now()}@example.com`
  const password = "StrongPass123!"

  it("registers a user", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password, name: "Test" })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const sub = await prisma.orgSubscription.findFirst({
      where: {
        org: {
          memberships: {
            some: { user: { email }, role: "OWNER" },
          },
        },
      },
    })

    expect(sub).toBeTruthy()
    expect(sub?.status).toBe("ACTIVE")
    expect(sub?.trialEndsAt).toBeNull()
  })

  it("logs in and returns access token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password })
    if (res.status !== 200) {
      console.error("Login failed:", res.body, res.text)
    }
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.accessToken).toBeTruthy()
    expect(res.headers["set-cookie"]).toBeTruthy()

    const sub = await prisma.orgSubscription.findFirst({
      where: {
        org: {
          memberships: {
            some: { user: { email }, role: "OWNER" },
          },
        },
      },
    })

    expect(sub?.status).toBe("TRIALING")
    expect(sub?.trialEndsAt).toBeTruthy()
  })

  it("validates reset token flow", async () => {
    const reqReset = await request(app)
      .post("/api/v1/auth/request-password-reset")
      .send({ email })
    expect(reqReset.status).toBe(200)
    expect(reqReset.body.ok).toBe(true)
    expect(reqReset.body.data.devToken).toBeTruthy()

    const reset = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: reqReset.body.data.devToken, newPassword: "NewPass123!" })

    expect(reset.status).toBe(200)
    expect(reset.body.ok).toBe(true)
  })
})
