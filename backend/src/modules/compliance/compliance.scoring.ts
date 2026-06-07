export const COMPLIANCE_CATEGORIES = [
  "mandatory_documents",
  "cidb",
  "bbbee",
  "briefing_session",
  "tax_csd",
  "returnables",
  "submission_risk",
] as const

export const COMPLIANCE_SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const

export const COMPLIANCE_STATUSES = ["missing", "met", "risk", "unknown"] as const

export type ComplianceCategory = (typeof COMPLIANCE_CATEGORIES)[number]
export type ComplianceSeverity = (typeof COMPLIANCE_SEVERITIES)[number]
export type ComplianceFindingStatus = (typeof COMPLIANCE_STATUSES)[number]

export type ComplianceEvidence = {
  fileId?: string
  filename?: string
  page?: number
  chunkId?: string
  quote?: string
}

export type NormalizedComplianceFinding = {
  category: ComplianceCategory
  title: string
  severity: ComplianceSeverity
  status: ComplianceFindingStatus
  requirement: string | null
  evidence: ComplianceEvidence[]
  suggestion: string | null
}

type ScorableFinding = {
  severity: ComplianceSeverity | string
  status: ComplianceFindingStatus | string
}

const severityWeights: Record<ComplianceSeverity, number> = {
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

function normalizeCategory(value: unknown): ComplianceCategory {
  const normalized = normalizeString(value).toLowerCase()
  if ((COMPLIANCE_CATEGORIES as readonly string[]).includes(normalized)) {
    return normalized as ComplianceCategory
  }
  return "submission_risk"
}

function normalizeSeverity(value: unknown): ComplianceSeverity {
  const normalized = normalizeString(value).toUpperCase()
  if ((COMPLIANCE_SEVERITIES as readonly string[]).includes(normalized)) {
    return normalized as ComplianceSeverity
  }
  return "MEDIUM"
}

function normalizeStatus(value: unknown): ComplianceFindingStatus {
  const normalized = normalizeString(value).toLowerCase()
  if ((COMPLIANCE_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as ComplianceFindingStatus
  }
  return "unknown"
}

function normalizeEvidence(input: unknown): ComplianceEvidence[] {
  if (!Array.isArray(input)) return []

  return input.slice(0, 8).map((raw) => {
    const item = asRecord(raw)
    const pageValue = Number(item.page)
    return {
      fileId: normalizeString(item.fileId) || undefined,
      filename: normalizeString(item.filename) || undefined,
      page: Number.isFinite(pageValue) ? pageValue : undefined,
      chunkId: normalizeString(item.chunkId) || undefined,
      quote: normalizeString(item.quote).slice(0, 500) || undefined,
    }
  })
}

export function calculateComplianceScore(findings: ScorableFinding[]) {
  const deductions = findings.reduce((sum, finding) => {
    const status = normalizeStatus(finding.status)
    if (status === "met") return sum

    const severity = normalizeSeverity(finding.severity)
    const unknownPenalty = status === "unknown" ? 3 : 0
    return sum + severityWeights[severity] + unknownPenalty
  }, 0)

  return Math.max(0, Math.min(100, 100 - deductions))
}

export function normalizeComplianceFindings(
  input: unknown,
): NormalizedComplianceFinding[] {
  if (!Array.isArray(input)) return []

  return input.map((raw) => {
    const item = asRecord(raw)
    return {
      category: normalizeCategory(item.category),
      title: normalizeString(item.title, "Compliance finding").slice(0, 240),
      severity: normalizeSeverity(item.severity),
      status: normalizeStatus(item.status),
      requirement: normalizeString(item.requirement).slice(0, 1200) || null,
      evidence: normalizeEvidence(item.evidence),
      suggestion: normalizeString(item.suggestion).slice(0, 1200) || null,
    }
  })
}

export function summarizeMissingItems(findings: NormalizedComplianceFinding[]) {
  const missing = findings
    .filter((finding) => finding.status === "missing" || finding.status === "risk")
    .map((finding) => finding.title.trim())
    .filter(Boolean)

  return Array.from(new Set(missing)).slice(0, 12)
}
