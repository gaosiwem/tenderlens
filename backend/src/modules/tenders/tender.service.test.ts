import { describe, expect, it } from "vitest"
import { extractAwardedCompanyName } from "./tender.service"

describe("extractAwardedCompanyName", () => {
  it("uses the awarded company from eTenders award arrays and handles lists", () => {
    const companyName = extractAwardedCompanyName({
      awards: [{ company: " CIPS SOUTHERN AFRICA " }],
      company: [{ company: "WELLS FARGO, CHASE" }],
      bidders: "CIPS SOUTHERN AFRICA, LOSER CORP",
    } as any)

    // Should prioritize awards over bidders and split the comma list
    // Result should be unique and sorted: CHASE, CIPS SOUTHERN AFRICA, WELLS FARGO
    expect(companyName).toBe("CHASE, CIPS SOUTHERN AFRICA, WELLS FARGO")
  })

  it("falls back to bidders only if no award fields are present", () => {
    const companyName = extractAwardedCompanyName({
      bidders: "WINNER 1, WINNER 2",
    } as any)
    expect(companyName).toBe("WINNER 1, WINNER 2")
  })

  it("returns null if no award fields and no bidders are present", () => {
    const companyName = extractAwardedCompanyName({
      organ_of_State: "South African Weather Service",
      status: "Awarded",
    } as any)

    expect(companyName).toBeNull()
  })
})
