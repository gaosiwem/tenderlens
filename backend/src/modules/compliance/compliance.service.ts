import OpenAI from "openai"
import { NotificationType } from "@prisma/client"
import { prisma } from "../../db/prisma"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"
import { complianceQueue } from "../../queues/compliance.queue"
import { emitEvent } from "../notifications/notifications.service"
import { ORG_PROFILE_TENDER_SOURCE } from "../orgDocs/orgDocs.constants"
import {
  calculateComplianceScore,
  normalizeComplianceFindings,
  summarizeMissingItems,
  type NormalizedComplianceFinding,
} from "./compliance.scoring"

type ContextChunk = {
  chunkId?: string
  fileId?: string
  filename?: string
  text: string
}

function accessibleTenderWhere(args: { orgId: string; tenderId: string }) {
  return {
    id: args.tenderId,
    OR: [
      {
        orgId: null,
        source: { not: ORG_PROFILE_TENDER_SOURCE },
      },
      {
        orgId: args.orgId,
        source: ORG_PROFILE_TENDER_SOURCE,
      },
    ],
  }
}

const keywordGroups = {
  mandatory_documents: [
    "mandatory",
    "required document",
    "returnable",
    "shall submit",
    "must submit",
  ],
  cidb: ["cidb", "class of works", "contractor grading", "grading designation"],
  bbbee: ["b-bbee", "bbee", "preference points", "sbd 6.1"],
  briefing_session: ["briefing", "site inspection", "site meeting"],
  tax_csd: ["csd", "central supplier database", "tax compliance", "sars"],
  returnables: ["sbd 1", "sbd 4", "sbd 6", "sbd 8", "sbd 9", "returnable"],
  submission_risk: ["closing date", "submission", "late", "envelope", "portal"],
}

function openaiClient() {
  if (!env.OPENAI_API_KEY) return null
  return new OpenAI({ apiKey: env.OPENAI_API_KEY })
}

function includesAny(text: string, terms: string[]) {
  const lower = text.toLowerCase()
  return terms.some((term) => lower.includes(term))
}

function findCidbGrade(text: string) {
  const match = text.match(/\b([1-9][0-9]?\s*(?:CE|GB|EP|ME|EB|SO|SQ|SB|SC|SK|SM|SN|SO|SH|SI|SJ))\b/i)
  return match?.[1]?.replace(/\s+/g, "").toUpperCase() ?? null
}

function createEvidenceForTerm(
  chunks: ContextChunk[],
  terms: string[],
): NormalizedComplianceFinding["evidence"] {
  const lowerTerms = terms.map((term) => term.toLowerCase())
  const matched = chunks.find((chunk) => {
    const lower = chunk.text.toLowerCase()
    return lowerTerms.some((term) => lower.includes(term))
  })
  if (!matched) return []

  const quote = matched.text.replace(/\s+/g, " ").trim().slice(0, 500)
  return [
    {
      fileId: matched.fileId,
      filename: matched.filename,
      chunkId: matched.chunkId,
      quote,
    },
  ]
}

function deterministicFindings(chunks: ContextChunk[]) {
  const context = chunks.map((chunk) => chunk.text).join("\n\n")
  const findings: NormalizedComplianceFinding[] = []
  const push = (finding: Omit<NormalizedComplianceFinding, "evidence"> & {
    evidenceTerms: string[]
  }) => {
    findings.push({
      ...finding,
      evidence: createEvidenceForTerm(chunks, finding.evidenceTerms),
    })
  }

  if (includesAny(context, keywordGroups.tax_csd)) {
    push({
      category: "tax_csd",
      title: "CSD report",
      severity: "HIGH",
      status: "missing",
      requirement: "Tender references CSD or tax compliance requirements.",
      suggestion: "Add a current CSD report or SARS tax compliance proof to the submission pack.",
      evidenceTerms: keywordGroups.tax_csd,
    })
  }

  if (includesAny(context, ["sbd 4", "standard bidding document 4"])) {
    push({
      category: "returnables",
      title: "signed SBD 4",
      severity: "HIGH",
      status: "missing",
      requirement: "SBD 4 declaration appears to be required.",
      suggestion: "Include a completed and signed SBD 4 declaration.",
      evidenceTerms: ["sbd 4", "standard bidding document 4"],
    })
  }

  const cidbGrade = findCidbGrade(context)
  if (includesAny(context, keywordGroups.cidb)) {
    push({
      category: "cidb",
      title: cidbGrade ? `proof of CIDB ${cidbGrade}` : "proof of CIDB registration",
      severity: cidbGrade ? "CRITICAL" : "HIGH",
      status: "missing",
      requirement: cidbGrade
        ? `Tender appears to require CIDB ${cidbGrade} or higher.`
        : "Tender references CIDB eligibility.",
      suggestion: cidbGrade
        ? `Attach current CIDB registration proof showing at least ${cidbGrade}.`
        : "Attach current CIDB registration proof matching the tender requirement.",
      evidenceTerms: keywordGroups.cidb,
    })
  }

  if (includesAny(context, keywordGroups.bbbee)) {
    push({
      category: "bbbee",
      title: "B-BBEE certificate or affidavit",
      severity: "MEDIUM",
      status: "missing",
      requirement: "Tender references B-BBEE or preference points requirements.",
      suggestion: "Include a valid B-BBEE certificate or applicable sworn affidavit.",
      evidenceTerms: keywordGroups.bbbee,
    })
  }

  if (includesAny(context, keywordGroups.briefing_session)) {
    push({
      category: "briefing_session",
      title: "briefing session attendance proof",
      severity: "MEDIUM",
      status: "risk",
      requirement: "Tender references a briefing or site inspection requirement.",
      suggestion: "Confirm whether attendance is compulsory and keep attendance proof with the submission pack.",
      evidenceTerms: keywordGroups.briefing_session,
    })
  }

  if (includesAny(context, keywordGroups.mandatory_documents)) {
    push({
      category: "mandatory_documents",
      title: "mandatory document checklist",
      severity: "MEDIUM",
      status: "risk",
      requirement: "Tender uses mandatory/returnable document language.",
      suggestion: "Prepare a returnables checklist and verify every required attachment before submission.",
      evidenceTerms: keywordGroups.mandatory_documents,
    })
  }

  if (includesAny(context, keywordGroups.submission_risk)) {
    push({
      category: "submission_risk",
      title: "submission instruction risk",
      severity: "MEDIUM",
      status: "risk",
      requirement: "Tender contains submission instructions or late-submission warnings.",
      suggestion: "Check closing time, delivery method, portal limits, and envelope marking instructions.",
      evidenceTerms: keywordGroups.submission_risk,
    })
  }

  return findings
}

function buildSummary(score: number, missing: string[]) {
  const prefix = `Compliance Score: ${score}%`
  if (!missing.length) return `${prefix}. No major missing returnables detected.`
  return `${prefix}. Missing: ${missing.slice(0, 6).join(", ")}.`
}

function buildRisks(findings: NormalizedComplianceFinding[]) {
  return findings
    .filter((finding) => finding.status === "risk" || finding.severity === "CRITICAL")
    .map((finding) => finding.title)
    .filter(Boolean)
    .slice(0, 12)
}

function dedupeFindings(findings: NormalizedComplianceFinding[]) {
  const seen = new Set<string>()
  const out: NormalizedComplianceFinding[] = []
  for (const finding of findings) {
    const key = `${finding.category}:${finding.title.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(finding)
  }
  return out
}

async function loadContext(args: { orgId: string; tenderId: string }) {
  const [tender, files, chunks, extracts] = await Promise.all([
    prisma.tender.findFirst({
      where: accessibleTenderWhere(args),
      select: {
        id: true,
        title: true,
        tenderNumber: true,
        description: true,
        category: true,
        companyName: true,
        procuringEntityName: true,
        briefingSession: true,
        briefingCompulsory: true,
        briefingDateTime: true,
        briefingVenue: true,
        closingDate: true,
        documents: true,
      },
    }),
    prisma.tenderFile.findMany({
      where: { tenderId: args.tenderId, orgId: args.orgId },
      select: { id: true, originalFilename: true },
    }),
    prisma.tenderChunk.findMany({
      where: { tenderId: args.tenderId, orgId: args.orgId },
      orderBy: [{ tenderFileId: "asc" }, { index: "asc" }],
      take: Math.max(1, env.COMPLIANCE_AUDITOR_MAX_CHUNKS),
    }),
    prisma.tenderExtract.findMany({
      where: { tenderId: args.tenderId, orgId: args.orgId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ])

  if (!tender) {
    throw new AppError("NOT_FOUND", "Tender not found", 404)
  }

  const fileNameById = new Map(files.map((file) => [file.id, file.originalFilename]))
  const contextChunks: ContextChunk[] = chunks.map((chunk) => ({
    chunkId: chunk.id,
    fileId: chunk.tenderFileId,
    filename: fileNameById.get(chunk.tenderFileId),
    text: chunk.content,
  }))

  if (contextChunks.length === 0) {
    for (const extract of extracts) {
      contextChunks.push({
        fileId: extract.tenderFileId,
        filename: fileNameById.get(extract.tenderFileId) ?? undefined,
        text: extract.text.slice(0, 6000),
      })
    }
  }

  contextChunks.unshift({
    filename: "Tender metadata",
    text: [
      tender.title,
      tender.tenderNumber ? `Tender number: ${tender.tenderNumber}` : "",
      tender.description,
      tender.category ? `Category: ${tender.category}` : "",
      tender.procuringEntityName
        ? `Procuring entity: ${tender.procuringEntityName}`
        : "",
      tender.companyName ? `Organ of state: ${tender.companyName}` : "",
      tender.briefingSession ? "Briefing session required or referenced." : "",
      tender.briefingCompulsory ? "Briefing session is compulsory." : "",
      tender.briefingDateTime ? `Briefing: ${tender.briefingDateTime}` : "",
      tender.briefingVenue ? `Venue: ${tender.briefingVenue}` : "",
      tender.closingDate ? `Closing date: ${tender.closingDate}` : "",
      tender.documents
        ? `Referenced documents: ${JSON.stringify(tender.documents).slice(0, 2000)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  })

  return { tender, chunks: contextChunks.filter((chunk) => chunk.text.trim()) }
}

async function generateAiFindings(args: {
  tenderTitle: string
  chunks: ContextChunk[]
}) {
  const client = openaiClient()
  if (!client) return []

  const context = args.chunks
    .slice(0, Math.max(1, env.COMPLIANCE_AUDITOR_MAX_CHUNKS))
    .map((chunk, index) => {
      const source = chunk.filename ? `${chunk.filename}` : `source ${index + 1}`
      return `[${index + 1}] ${source}\n${chunk.text.slice(0, 1800)}`
    })
    .join("\n\n")

  const prompt = `You are TenderLens' AI Compliance Auditor for South African tenders.

Review the tender text and return JSON only. Do not give legal advice. Only use the supplied context.

Tender: ${args.tenderTitle}

Check these categories:
- mandatory_documents
- cidb
- bbbee
- briefing_session
- tax_csd
- returnables
- submission_risk

Return:
{
  "findings": [
    {
      "category": "tax_csd",
      "title": "CSD report",
      "severity": "HIGH",
      "status": "missing",
      "requirement": "Valid CSD report required with submission",
      "evidence": [{"filename":"document.pdf","quote":"short quote"}],
      "suggestion": "Upload a current CSD report."
    }
  ]
}

Tender context:
${context}`

  const response = await client.chat.completions.create({
    model: env.COMPLIANCE_AUDITOR_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: env.COMPLIANCE_AUDITOR_MAX_TOKENS,
    response_format: { type: "json_object" },
  })

  const parsed = JSON.parse(response.choices[0]?.message?.content || "{}") as {
    findings?: unknown
  }
  return normalizeComplianceFindings(parsed.findings)
}

async function persistCompletedAudit(args: {
  auditId: string
  orgId: string
  findings: NormalizedComplianceFinding[]
  score: number
  summary: string
  missing: string[]
  risks: string[]
}) {
  await (prisma as any).$transaction([
    (prisma as any).complianceFinding.deleteMany({
      where: { auditId: args.auditId },
    }),
    (prisma as any).complianceAudit.update({
      where: { id: args.auditId },
      data: {
        status: "COMPLETED",
        score: args.score,
        summary: args.summary,
        missing: args.missing,
        risks: args.risks,
        model: env.OPENAI_API_KEY ? env.COMPLIANCE_AUDITOR_MODEL : "deterministic",
        error: null,
        completedAt: new Date(),
      },
    }),
    ...(args.findings.length
      ? [
          (prisma as any).complianceFinding.createMany({
            data: args.findings.map((finding) => ({
              orgId: args.orgId,
              auditId: args.auditId,
              category: finding.category,
              title: finding.title,
              severity: finding.severity,
              status: finding.status,
              requirement: finding.requirement,
              evidence: finding.evidence as any,
              suggestion: finding.suggestion,
            })),
          }),
        ]
      : []),
  ])
}

function toDto(audit: any) {
  return {
    id: audit.id,
    tenderId: audit.tenderId,
    status: audit.status,
    score: audit.score ?? null,
    summary: audit.summary ?? null,
    error: audit.error ?? null,
    missing: audit.missing ?? [],
    risks: audit.risks ?? [],
    findings: (audit.findings ?? []).map((finding: any) => ({
      id: finding.id,
      category: finding.category,
      title: finding.title,
      severity: finding.severity,
      status: finding.status,
      requirement: finding.requirement ?? null,
      evidence: Array.isArray(finding.evidence) ? finding.evidence : [],
      suggestion: finding.suggestion ?? null,
    })),
    createdAt: audit.createdAt,
    completedAt: audit.completedAt ?? null,
  }
}

export async function startComplianceAudit(args: {
  orgId: string
  tenderId: string
  userId: string
}) {
  if (!env.COMPLIANCE_AUDITOR_ENABLED) {
    throw new AppError("DISABLED", "Compliance auditor disabled", 400)
  }

  const tender = await prisma.tender.findFirst({
    where: accessibleTenderWhere(args),
    select: { id: true },
  })
  if (!tender) throw new AppError("NOT_FOUND", "Tender not found", 404)

  const audit = await (prisma as any).complianceAudit.create({
    data: {
      orgId: args.orgId,
      tenderId: args.tenderId,
      createdById: args.userId,
      status: "PENDING",
    },
    include: { findings: true },
  })

  if (env.COMPLIANCE_AUDITOR_QUEUE_ENABLED) {
    await complianceQueue.add("audit", { auditId: audit.id })
  } else {
    await runComplianceAudit(audit.id)
  }

  return toDto(audit)
}

export async function runComplianceAudit(auditId: string) {
  const audit = await (prisma as any).complianceAudit.findUnique({
    where: { id: auditId },
  })
  if (!audit) return { processed: 0, reason: "not_found" as const }
  if (audit.status === "COMPLETED") return { processed: 0, reason: "completed" as const }

  await (prisma as any).complianceAudit.update({
    where: { id: auditId },
    data: { status: "PROCESSING", startedAt: new Date(), error: null },
  })

  try {
    const { tender, chunks } = await loadContext({
      orgId: audit.orgId,
      tenderId: audit.tenderId,
    })

    if (chunks.length === 0) {
      throw new AppError(
        "NOT_READY",
        "No tender text is available for compliance auditing.",
        400,
      )
    }

    const deterministic = deterministicFindings(chunks)
    let ai: NormalizedComplianceFinding[] = []
    try {
      ai = await generateAiFindings({ tenderTitle: tender.title, chunks })
    } catch {
      ai = []
    }
    const findings = dedupeFindings([...deterministic, ...ai])
    const score = calculateComplianceScore(findings)
    const missing = summarizeMissingItems(findings)
    const risks = buildRisks(findings)
    const summary = buildSummary(score, missing)

    await persistCompletedAudit({
      auditId,
      orgId: audit.orgId,
      findings,
      score,
      summary,
      missing,
      risks,
    })

    if (score < env.COMPLIANCE_AUDITOR_SCORE_PASS || findings.some((f) => f.severity === "CRITICAL")) {
      await emitEvent({
        orgId: audit.orgId,
        type: NotificationType.ALERT_FIRED,
        entityType: "Tender",
        entityId: audit.tenderId,
        targetUserId: audit.createdById ?? undefined,
        meta: {
          kind: "COMPLIANCE_AUDIT_COMPLETED",
          score,
          missing,
          tenderId: audit.tenderId,
        },
      })
    }

    return { processed: 1 as const }
  } catch (error: any) {
    await (prisma as any).complianceAudit.update({
      where: { id: auditId },
      data: {
        status: "FAILED",
        error: error?.message ?? "Compliance audit failed",
        completedAt: new Date(),
      },
    })
    throw error
  }
}

export async function listComplianceAudits(args: {
  orgId: string
  tenderId: string
}) {
  const audits = await (prisma as any).complianceAudit.findMany({
    where: { orgId: args.orgId, tenderId: args.tenderId },
    orderBy: { createdAt: "desc" },
    include: { findings: true },
  })
  return audits.map(toDto)
}

export async function getComplianceAudit(args: {
  orgId: string
  auditId: string
}) {
  const audit = await (prisma as any).complianceAudit.findFirst({
    where: { id: args.auditId, orgId: args.orgId },
    include: { findings: true },
  })
  if (!audit) throw new AppError("NOT_FOUND", "Compliance audit not found", 404)
  return toDto(audit)
}

export async function rerunComplianceAudit(args: {
  orgId: string
  auditId: string
  userId: string
}) {
  const audit = await (prisma as any).complianceAudit.findFirst({
    where: { id: args.auditId, orgId: args.orgId },
    select: { tenderId: true },
  })
  if (!audit) throw new AppError("NOT_FOUND", "Compliance audit not found", 404)

  return startComplianceAudit({
    orgId: args.orgId,
    tenderId: audit.tenderId,
    userId: args.userId,
  })
}
