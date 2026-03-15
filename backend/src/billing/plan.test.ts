import { describe, expect, it } from "vitest"
import { PLAN_CONFIG } from "./plan"

describe("PLAN_CONFIG", () => {
  it("gives TRIAL full access during the trial period", () => {
    expect(PLAN_CONFIG.TRIAL.maxMembers).toBe("unlimited")
    expect(PLAN_CONFIG.TRIAL.maxWatchlist).toBe("unlimited")
    expect(PLAN_CONFIG.TRIAL.maxAiQueries).toBe("unlimited")
    expect(PLAN_CONFIG.TRIAL.workspace).toBe(true)
    expect(PLAN_CONFIG.TRIAL.compare).toBe(true)
    expect(PLAN_CONFIG.TRIAL.exports).toBe(true)
    expect(PLAN_CONFIG.TRIAL.whatsapp).toBe(true)
    expect(PLAN_CONFIG.TRIAL.risk).toBe(true)
    expect(PLAN_CONFIG.TRIAL.emailAlerts).toBe("advanced")
    expect(PLAN_CONFIG.TRIAL.customAlertRules).toBe(true)
    expect(PLAN_CONFIG.TRIAL.tenderLifecycleAccess).toEqual([
      "open",
      "awarded",
      "closed",
      "cancelled",
    ])
  })

  it("keeps PRO and BUSINESS-tier capabilities enabled", () => {
    expect(PLAN_CONFIG.PRO.maxMembers).toBe(5)
    expect(PLAN_CONFIG.PRO.maxAiQueries).toBe("unlimited")
    expect(PLAN_CONFIG.PRO.customAlertRules).toBe(true)
    expect(PLAN_CONFIG.PRO.emailAlerts).toBe("advanced")
    expect(PLAN_CONFIG.ENTERPRISE.maxMembers).toBe(15)
    expect(PLAN_CONFIG.ENTERPRISE.customAlertRules).toBe(true)
    expect(PLAN_CONFIG.ENTERPRISE.emailAlerts).toBe("advanced")
  })
})
