import { describe, expect, it } from "vitest"
import {
  calculateBidReviewScore,
  normalizeBidReviewFindings,
  parseBidReviewAiResponse,
} from "./bidReview.scoring"

describe("bid review scoring", () => {
  it("deducts severity, unanswered requirement, and unclear pricing penalties", () => {
    const score = calculateBidReviewScore([
      { category: "UNANSWERED_REQUIREMENT", severity: "HIGH" },
      { category: "UNCLEAR_PRICING", severity: "MEDIUM", title: "Total price is unclear" },
      { category: "MISSING_EVIDENCE", severity: "LOW" },
    ])

    expect(score).toBe(70)
  })

  it("normalizes malformed AI findings safely", () => {
    const findings = normalizeBidReviewFindings([
      {
        category: "missing_evidence",
        title: "x".repeat(500),
        severity: "critical",
        affectedSection: "Experience",
        evidence: [{ source: "tender", quote: "q".repeat(900) }],
      },
      {
        category: "surprise",
        severity: "urgent",
      },
    ])

    expect(findings).toHaveLength(2)
    expect(findings[0]).toMatchObject({
      category: "MISSING_EVIDENCE",
      severity: "CRITICAL",
      affectedSection: "Experience",
    })
    expect(findings[0].title.length).toBeLessThanOrEqual(240)
    expect(findings[0].evidence[0].quote?.length).toBeLessThanOrEqual(700)
    expect(findings[1]).toMatchObject({
      category: "EVALUATOR_RED_FLAG",
      severity: "MEDIUM",
      title: "Bid review finding",
    })
  })

  it("parses AI response JSON and falls back on malformed JSON", () => {
    const parsed = parseBidReviewAiResponse(
      JSON.stringify({
        summary: "Strong methodology but missing evidence.",
        strengths: ["Clear plan"],
        weaknesses: ["No references"],
        redFlags: ["Missing total price"],
        findings: [{ category: "UNCLEAR_PRICING", severity: "HIGH" }],
      }),
    )

    expect(parsed.summary).toContain("Strong methodology")
    expect(parsed.findings[0].category).toBe("UNCLEAR_PRICING")

    const malformed = parseBidReviewAiResponse("{not json")
    expect(malformed.redFlags).toEqual(["Review requires manual follow-up."])
  })
})
