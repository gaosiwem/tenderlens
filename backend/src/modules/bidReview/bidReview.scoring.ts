export const BID_REVIEW_CATEGORIES = [
  "UNANSWERED_REQUIREMENT",
  "WEAK_RESPONSE",
  "MISSING_EVIDENCE",
  "POOR_STRUCTURE",
  "COMPLIANCE_GAP",
  "UNCLEAR_PRICING",
  "EVALUATOR_RED_FLAG",
] as const

export const BID_REVIEW_SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const

export type BidReviewCategory = (typeof BID_REVIEW_CATEGORIES)[number]
export type BidReviewSeverity = (typeof BID_REVIEW_SEVERITIES)[number]

export type BidReviewEvidence = {
  source: "tender" | "proposal" | "compliance_audit"
  fileId?: string
  filename?: string
  page?: number
  chunkId?: string
  quote?: string
}

export type NormalizedBidReviewFinding = {
  category: BidReviewCategory
  title: string
  severity: BidReviewSeverity
  affectedSection: string | null
  requirement: string | null
  proposalExcerpt: string | null
  evidence: BidReviewEvidence[]
  recommendation: string | null
}

type ScorableFinding = {
  category: BidReviewCategory | string
  severity: BidReviewSeverity | string
  title?: string | null
}

const severityWeights: Record<BidReviewSeverity, number> = {
  CRITICAL: 15,
  HIGH: 10,
  MEDIUM: 5,
  LOW: 2,
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeString(value: unknown, fallback = "") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function normalizeCategory(value: unknown): BidReviewCategory {
  const normalized = normalizeString(value).toUpperCase()
  if ((BID_REVIEW_CATEGORIES as readonly string[]).includes(normalized)) {
    return normalized as BidReviewCategory
  }
  return "EVALUATOR_RED_FLAG"
}

function normalizeSeverity(value: unknown): BidReviewSeverity {
  const normalized = normalizeString(value).toUpperCase()
  if ((BID_REVIEW_SEVERITIES as readonly string[]).includes(normalized)) {
    return normalized as BidReviewSeverity
  }
  return "MEDIUM"
}

function normalizeEvidence(input: unknown): BidReviewEvidence[] {
  if (!Array.isArray(input)) return []

  return input.slice(0, 10).map((raw) => {
    const item = asRecord(raw)
    const rawSource = normalizeString(item.source).toLowerCase()
    const source =
      rawSource === "tender" ||
      rawSource === "proposal" ||
      rawSource === "compliance_audit"
        ? rawSource
        : "proposal"
    const pageValue = Number(item.page)
    return {
      source,
      fileId: normalizeString(item.fileId) || undefined,
      filename: normalizeString(item.filename) || undefined,
      page: Number.isFinite(pageValue) ? pageValue : undefined,
      chunkId: normalizeString(item.chunkId) || undefined,
      quote: normalizeString(item.quote).slice(0, 700) || undefined,
    }
  })
}

export function calculateBidReviewScore(findings: ScorableFinding[]) {
  const deductions = findings.reduce((sum, finding) => {
    const severity = normalizeSeverity(finding.severity)
    let next = sum + severityWeights[severity]

    if (normalizeCategory(finding.category) === "UNANSWERED_REQUIREMENT") {
      next += 5
    }

    if (
      normalizeCategory(finding.category) === "UNCLEAR_PRICING" &&
      /total|price|vat|boq/i.test(finding.title ?? "")
    ) {
      next += 8
    }

    return next
  }, 0)

  return Math.max(0, Math.min(100, 100 - deductions))
}

export function normalizeBidReviewFindings(
  input: unknown,
): NormalizedBidReviewFinding[] {
  if (!Array.isArray(input)) return []

  return input.map((raw) => {
    const item = asRecord(raw)
    return {
      category: normalizeCategory(item.category),
      title: normalizeString(item.title, "Bid review finding").slice(0, 240),
      severity: normalizeSeverity(item.severity),
      affectedSection:
        normalizeString(item.affectedSection).slice(0, 240) || null,
      requirement: normalizeString(item.requirement).slice(0, 1200) || null,
      proposalExcerpt:
        normalizeString(item.proposalExcerpt).slice(0, 1200) || null,
      evidence: normalizeEvidence(item.evidence),
      recommendation:
        normalizeString(item.recommendation).slice(0, 1200) || null,
    }
  })
}

export function parseBidReviewAiResponse(content: string) {
  try {
    const parsed = JSON.parse(content || "{}")
    const record = asRecord(parsed)
    return {
      summary:
        normalizeString(record.summary).slice(0, 600) ||
        "Review completed. Check the findings before submission.",
      strengths: normalizeStringList(record.strengths, 8),
      weaknesses: normalizeStringList(record.weaknesses, 8),
      redFlags: normalizeStringList(record.redFlags, 10),
      findings: normalizeBidReviewFindings(record.findings),
    }
  } catch {
    return {
      summary: "AI review response could not be parsed.",
      strengths: [],
      weaknesses: ["AI reviewer returned malformed JSON."],
      redFlags: ["Review requires manual follow-up."],
      findings: [],
    }
  }
}

export function normalizeStringList(input: unknown, max: number) {
  if (!Array.isArray(input)) return []
  return Array.from(
    new Set(
      input
        .map((item) => normalizeString(item).slice(0, 240))
        .filter(Boolean),
    ),
  ).slice(0, max)
}
