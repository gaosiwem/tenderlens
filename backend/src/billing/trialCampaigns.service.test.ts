import { beforeEach, describe, expect, it, vi } from "vitest"
import { NotificationType } from "@prisma/client"
import { runTrialCampaigns } from "./trialCampaigns.service"
import { prisma } from "../db/prisma"
import { emitEvent } from "../modules/notifications/notifications.service"

vi.mock("../config/env", () => ({
  env: {
    TRIAL_CAMPAIGNS_ENABLED: true,
    TRIAL_POST_EXPIRY_DAY1: 1,
    TRIAL_POST_EXPIRY_DAY7: 7,
  },
}))

vi.mock("../db/prisma", () => ({
  prisma: {
    orgSubscription: {
      findMany: vi.fn(),
    },
    notificationEvent: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock("../modules/notifications/notifications.service", () => ({
  emitEvent: vi.fn(),
}))

const mockedFindMany = vi.mocked(prisma.orgSubscription.findMany)
const mockedFindFirst = vi.mocked(prisma.notificationEvent.findFirst)
const mockedEmitEvent = vi.mocked(emitEvent)

function trialSub(args: {
  orgId: string
  hoursToEnd: number
  now: Date
}) {
  return {
    orgId: args.orgId,
    status: "TRIALING",
    trialEndsAt: new Date(
      args.now.getTime() + args.hoursToEnd * 60 * 60 * 1000,
    ),
    updatedAt: args.now,
  }
}

describe("runTrialCampaigns", () => {
  const now = new Date("2026-05-06T08:00:00.000Z")

  beforeEach(() => {
    vi.clearAllMocks()
    mockedFindFirst.mockResolvedValue(null)
    mockedEmitEvent.mockResolvedValue({ id: "event-id" } as any)
  })

  it("sends one email-only reminder at 3, 2, and 1 days before trial expiry", async () => {
    mockedFindMany.mockResolvedValue([
      trialSub({ orgId: "org-3-days", hoursToEnd: 60, now }),
      trialSub({ orgId: "org-2-days", hoursToEnd: 36, now }),
      trialSub({ orgId: "org-1-day", hoursToEnd: 12, now }),
    ] as any)

    const result = await runTrialCampaigns(now)

    expect(result).toEqual({ queued: 3 })
    expect(mockedEmitEvent).toHaveBeenCalledTimes(3)
    expect(mockedEmitEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orgId: "org-3-days",
        type: NotificationType.ALERT_FIRED,
        entityType: "OrgSubscription",
        entityId: "org-3-days",
        targetChannels: ["email"],
        ignoreEventTypePrefs: true,
        ignoreChannelPrefs: true,
        meta: expect.objectContaining({
          kind: "TRIAL_CAMPAIGN",
          touch: "EXPIRY_72H",
          hoursToEnd: 60,
        }),
      }),
    )
    expect(mockedEmitEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orgId: "org-2-days",
        meta: expect.objectContaining({
          touch: "EXPIRY_48H",
          hoursToEnd: 36,
        }),
      }),
    )
    expect(mockedEmitEvent).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        orgId: "org-1-day",
        meta: expect.objectContaining({
          touch: "EXPIRY_24H",
          hoursToEnd: 12,
        }),
      }),
    )
  })

  it("does not resend a reminder touch that was already emitted", async () => {
    mockedFindMany.mockResolvedValue([
      trialSub({ orgId: "org-duplicate", hoursToEnd: 60, now }),
    ] as any)
    mockedFindFirst.mockResolvedValue({ id: "existing-event" } as any)

    const result = await runTrialCampaigns(now)

    expect(result).toEqual({ queued: 0 })
    expect(mockedEmitEvent).not.toHaveBeenCalled()
    expect(mockedFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-duplicate",
          meta: { path: ["touch"], equals: "EXPIRY_72H" },
        }),
      }),
    )
  })
})
