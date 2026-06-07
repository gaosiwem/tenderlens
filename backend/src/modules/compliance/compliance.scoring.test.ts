import { describe, expect, it } from "vitest"
import {
  calculateComplianceScore,
  normalizeComplianceFindings,
  summarizeMissingItems,
} from "./compliance.scoring"

describe("compliance scoring", () => {
  it("deducts points by severity and clamps the score", () => {
    const score = calculateComplianceScore([
      { severity: "CRITICAL", status: "missing" },
      { severity: "HIGH", status: "missing" },
      { severity: "MEDIUM", status: "risk" },
      { severity: "LOW", status: "unknown" },
    ])

    expect(score).toBe(65)
  })

  it("does not deduct for met findings", () => {
    const score = calculateComplianceScore([
      { severity: "CRITICAL", status: "met" },
      { severity: "HIGH", status: "met" },
    ])

    expect(score).toBe(100)
  })

  it("normalizes AI findings to supported categories, severities, statuses, and short evidence", () => {
    const findings = normalizeComplianceFindings([
      {
        category: "CIDB",
        title: "Proof of CIDB 6CE is required",
        severity: "critical",
        status: "missing",
        requirement: "CIDB 6CE or higher",
        evidence: [{ filename: "terms.pdf", quote: "x".repeat(900) }],
        suggestion: "Upload current CIDB proof.",
      },
      {
        category: "nonsense",
        title: "",
        severity: "extreme",
        status: "done",
      },
    ])

    expect(findings).toHaveLength(2)
    expect(findings[0]).toMatchObject({
      category: "cidb",
      title: "Proof of CIDB 6CE is required",
      severity: "CRITICAL",
      status: "missing",
    })
    expect(findings[0].evidence[0].quote?.length).toBeLessThanOrEqual(500)
    expect(findings[1]).toMatchObject({
      category: "submission_risk",
      title: "Compliance finding",
      severity: "MEDIUM",
      status: "unknown",
    })
  })

  it("summarizes only missing and risk findings for the missing item list", () => {
    const missing = summarizeMissingItems([
      {
        category: "tax_csd",
        title: "CSD report",
        requirement: "Provide CSD report",
        severity: "HIGH",
        status: "missing",
        suggestion: "Attach the current CSD report.",
        evidence: [],
      },
      {
        category: "returnables",
        title: "signed SBD 4",
        requirement: "Submit signed SBD 4",
        severity: "HIGH",
        status: "risk",
        suggestion: "Sign and attach SBD 4.",
        evidence: [],
      },
      {
        category: "bbbee",
        title: "B-BBEE certificate",
        requirement: "Provide B-BBEE evidence",
        severity: "LOW",
        status: "met",
        suggestion: "No action needed.",
        evidence: [],
      },
    ])

    expect(missing).toEqual(["CSD report", "signed SBD 4"])
  })
})
