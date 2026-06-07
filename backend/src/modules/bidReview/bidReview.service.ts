import OpenAI from "openai"
import { NotificationType } from "@prisma/client"
import mammoth from "mammoth"
import { prisma } from "../../db/prisma"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"
import { storage } from "../storage/storage"
import { bidReviewQueue } from "../../queues/bidReview.queue"
import { emitEvent } from "../notifications/notifications.service"
import {
  calculateBidReviewScore,
  normalizeBidReviewFindings,
  normalizeStringList,
  parseBidReviewAiResponse,
  type BidReviewEvidence,
  type NormalizedBidReviewFinding,
} from "./bidReview.scoring"

const { PDFParse } = require("pdf-parse")

type ContextChunk = {
  source: "tender" | "proposal" | "compliance_audit"
  chunkId?: string
  fileId?: string
  filename?: string
  text: string
}

const requirementTerms = [
  "must",
  "shall",
  "required",
  "methodology",
  "experience",
  "key personnel",
  "timeline",
  "capacity",
  "equipment",
  "local content",
  "subcontract",
]

function openaiClient() {
  if (!env.OPENAI_API_KEY) return null
  return new OpenAI({ apiKey: env.OPENAI_API_KEY })
}

function includesAny(text: string, terms: string[]) {
  const lower = text.toLowerCase()
  return terms.some((term) => lower.includes(term))
}

function compactText(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

function createEvidence(chunk: ContextChunk): BidReviewEvidence[] {
  return [
    {
      source: chunk.source,
      fileId: chunk.fileId,
      filename: chunk.filename,
      chunkId: chunk.chunkId,
      quote: compactText(chunk.text).slice(0, 700),
    },
  ]
}

function splitProposalText(text: string, file: { id: string; filename: string }) {
  const normalized = text.replace(/\r/g, "\n").trim()
  if (!normalized) return []

  const chunks: ContextChunk[] = []
  for (let offset = 0; offset < normalized.length; offset += 1800) {
    chunks.push({
      source: "proposal",
      fileId: file.id,
      filename: file.filename,
      chunkId: `${file.id}:${chunks.length + 1}`,
      text: normalized.slice(offset, offset + 2200),
    })
  }
  return chunks
}

async function extractAttachmentText(attachment: {
  storageKey: string
  mimeType: string
  filename: string
}) {
  const buffer = await storage().getObject({ key: attachment.storageKey })

  if (attachment.mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer })
    const out = await parser.getText()
    return out.text ?? ""
  }

  if (
    attachment.mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const out = await mammoth.extractRawText({ buffer })
    return out.value ?? ""
  }

  if (attachment.mimeType.startsWith("text/")) {
    return buffer.toString("utf-8")
  }

  return ""
}

function isProposalLike(file: { filename: string; mimeType: string }) {
  const name = file.filename.toLowerCase()
  const isDocument =
    file.mimeType === "application/pdf" ||
    file.mimeType.startsWith("text/") ||
    file.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

  return (
    isDocument &&
    (/proposal|bid|response|submission|technical|pricing|boq|quotation/.test(
      name,
    ) ||
      !/brief|tender|specification|terms|rfp|rfq|advert/.test(name))
  )
}

async function loadWorkspaceAndProposalFiles(args: {
  orgId: string
  tenderId: string
  proposalFileIds?: string[]
}) {
  const workspace = await prisma.bidWorkspace.findFirst({
    where: { orgId: args.orgId, tenderId: args.tenderId },
    include: { attachments: { orderBy: { createdAt: "desc" } } },
  })

  if (!workspace) {
    throw new AppError(
      "NO_PROPOSAL_FILES",
      "Upload a proposal document before running a bid review.",
      400,
    )
  }

  const requested = (args.proposalFileIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean)
  const files = requested.length
    ? workspace.attachments.filter((file) => requested.includes(file.id))
    : workspace.attachments.filter(isProposalLike)

  if (requested.length && files.length !== requested.length) {
    throw new AppError("BAD_REQUEST", "One or more proposal files were not found.", 400)
  }

  if (!files.length) {
    throw new AppError(
      "NO_PROPOSAL_FILES",
      "Upload a proposal document before running a bid review.",
      400,
    )
  }

  return { workspace, files }
}

async function loadTenderContext(args: { orgId: string; tenderId: string }) {
  const [tender, files, chunks, extracts] = await Promise.all([
    prisma.tender.findFirst({
      where: { id: args.tenderId, orgId: args.orgId },
      select: {
        id: true,
        title: true,
        description: true,
        closingDate: true,
        briefingSession: true,
        briefingCompulsory: true,
        amount: true,
      },
    }),
    prisma.tenderFile.findMany({
      where: { tenderId: args.tenderId, orgId: args.orgId },
      select: { id: true, originalFilename: true },
    }),
    prisma.tenderChunk.findMany({
      where: { tenderId: args.tenderId, orgId: args.orgId },
      orderBy: [{ tenderFileId: "asc" }, { index: "asc" }],
      take: Math.max(1, env.BID_REVIEWER_MAX_TENDER_CHUNKS),
    }),
    prisma.tenderExtract.findMany({
      where: { tenderId: args.tenderId, orgId: args.orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ])

  if (!tender) throw new AppError("NOT_FOUND", "Tender not found", 404)

  const fileNameById = new Map(files.map((file) => [file.id, file.originalFilename]))
  const context: ContextChunk[] = chunks.map((chunk) => ({
    source: "tender",
    chunkId: chunk.id,
    fileId: chunk.tenderFileId,
    filename: fileNameById.get(chunk.tenderFileId),
    text: chunk.content,
  }))

  if (!context.length) {
    for (const extract of extracts) {
      context.push({
        source: "tender",
        fileId: extract.tenderFileId,
        filename: fileNameById.get(extract.tenderFileId),
        text: extract.text.slice(0, 6000),
      })
    }
  }

  context.unshift({
    source: "tender",
    filename: "Tender metadata",
    text: [
      tender.title,
      tender.description,
      tender.amount ? `Tender amount: ${tender.amount}` : "",
      tender.closingDate ? `Closing date: ${tender.closingDate}` : "",
      tender.briefingSession ? "Briefing session referenced." : "",
      tender.briefingCompulsory ? "Briefing session appears compulsory." : "",
    ]
      .filter(Boolean)
      .join("\n"),
  })

  return { tender, chunks: context.filter((chunk) => chunk.text.trim()) }
}

async function loadProposalContext(files: any[]) {
  const chunks: ContextChunk[] = []

  for (const file of files.slice(0, env.BID_REVIEWER_MAX_PROPOSAL_CHUNKS)) {
    let text = ""
    try {
      text = await extractAttachmentText(file)
    } catch {
      text = ""
    }

    const extracted = splitProposalText(text, {
      id: file.id,
      filename: file.filename,
    })

    if (extracted.length) {
      chunks.push(...extracted)
    } else {
      chunks.push({
        source: "proposal",
        fileId: file.id,
        filename: file.filename,
        chunkId: `${file.id}:metadata`,
        text: `Uploaded proposal attachment: ${file.filename} (${file.mimeType}). Text extraction was not available for this file.`,
      })
    }
  }

  return chunks.slice(0, Math.max(1, env.BID_REVIEWER_MAX_PROPOSAL_CHUNKS))
}

async function loadLatestComplianceContext(args: {
  orgId: string
  tenderId: string
}) {
  const audit = await (prisma as any).complianceAudit.findFirst({
    where: { orgId: args.orgId, tenderId: args.tenderId, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    include: { findings: true },
  })

  if (!audit) return { audit: null, chunks: [] as ContextChunk[] }

  const chunks: ContextChunk[] = [
    {
      source: "compliance_audit",
      chunkId: audit.id,
      text: [
        audit.summary,
        ...(audit.missing ?? []).map((item: string) => `Missing: ${item}`),
        ...(audit.risks ?? []).map((item: string) => `Risk: ${item}`),
      ]
        .filter(Boolean)
        .join("\n"),
    },
    ...(audit.findings ?? []).slice(0, 12).map((finding: any) => ({
      source: "compliance_audit" as const,
      chunkId: finding.id,
      text: `${finding.severity} ${finding.category}: ${finding.title}. ${finding.requirement ?? ""} ${finding.suggestion ?? ""}`,
    })),
  ]

  return { audit, chunks }
}

function deterministicFindings(args: {
  tenderChunks: ContextChunk[]
  proposalChunks: ContextChunk[]
  complianceChunks: ContextChunk[]
}) {
  const tenderText = args.tenderChunks.map((chunk) => chunk.text).join("\n\n")
  const proposalText = args.proposalChunks.map((chunk) => chunk.text).join("\n\n")
  const lowerProposal = proposalText.toLowerCase()
  const findings: NormalizedBidReviewFinding[] = []

  const add = (
    finding: Omit<NormalizedBidReviewFinding, "evidence"> & {
      evidenceChunk?: ContextChunk
    },
  ) => {
    findings.push({
      ...finding,
      evidence: finding.evidenceChunk ? createEvidence(finding.evidenceChunk) : [],
    })
  }

  const requirementChunk = args.tenderChunks.find((chunk) =>
    includesAny(chunk.text, requirementTerms),
  )
  if (requirementChunk && !includesAny(proposalText, ["methodology", "timeline", "experience", "personnel"])) {
    add({
      category: "UNANSWERED_REQUIREMENT",
      title: "Tender requirements may not be answered directly",
      severity: "HIGH",
      affectedSection: "Requirement response",
      requirement: compactText(requirementChunk.text).slice(0, 500),
      proposalExcerpt: null,
      recommendation:
        "Add a requirement-by-requirement response matrix that maps each tender requirement to a proposal section.",
      evidenceChunk: requirementChunk,
    })
  }

  if (!/executive summary|introduction|overview/i.test(proposalText)) {
    add({
      category: "POOR_STRUCTURE",
      title: "Executive summary was not found",
      severity: "MEDIUM",
      affectedSection: "Proposal structure",
      requirement: null,
      proposalExcerpt: null,
      recommendation:
        "Add a concise executive summary that states the offer, delivery approach, differentiators, and readiness.",
    })
  }

  if (
    includesAny(proposalText, ["extensive experience", "proven track record", "highly experienced"]) &&
    !includesAny(proposalText, ["reference", "completion certificate", "client contact", "project value"])
  ) {
    const chunk = args.proposalChunks.find((item) =>
      includesAny(item.text, ["extensive experience", "proven track record"]),
    )
    add({
      category: "MISSING_EVIDENCE",
      title: "Experience claims may lack supporting evidence",
      severity: "HIGH",
      affectedSection: "Company experience",
      requirement: "Evaluator may expect evidence for previous experience claims.",
      proposalExcerpt: chunk ? compactText(chunk.text).slice(0, 500) : null,
      recommendation:
        "Add project names, dates, values, client contacts, completion certificates, or reference letters.",
      evidenceChunk: chunk,
    })
  }

  if (!/total|vat|price|pricing|boq|quotation|amount/i.test(proposalText)) {
    add({
      category: "UNCLEAR_PRICING",
      title: "Total price or pricing basis was not found",
      severity: "HIGH",
      affectedSection: "Pricing",
      requirement: "Proposal should make pricing, VAT treatment, and assumptions easy to evaluate.",
      proposalExcerpt: null,
      recommendation:
        "Add a clear pricing summary with total price, VAT treatment, validity period, assumptions, and BOQ alignment.",
    })
  } else if (/excluding vat|excludes vat|vat exclusive/i.test(lowerProposal) && !/including vat|vat inclusive|total incl/i.test(lowerProposal)) {
    add({
      category: "UNCLEAR_PRICING",
      title: "VAT treatment may be ambiguous",
      severity: "MEDIUM",
      affectedSection: "Pricing",
      requirement: "Pricing should clearly state whether totals include or exclude VAT.",
      proposalExcerpt: "VAT-exclusive pricing language found without a clear inclusive total.",
      recommendation:
        "Show both VAT-exclusive and VAT-inclusive totals, or state the evaluator-facing total explicitly.",
    })
  }

  for (const chunk of args.complianceChunks.slice(0, 6)) {
    if (!chunk.text.trim()) continue
    add({
      category: "COMPLIANCE_GAP",
      title: compactText(chunk.text).slice(0, 120),
      severity: /critical|missing/i.test(chunk.text) ? "HIGH" : "MEDIUM",
      affectedSection: "Compliance returnables",
      requirement: chunk.text.slice(0, 700),
      proposalExcerpt: null,
      recommendation:
        "Resolve this compliance item or cross-reference the required returnable in the proposal pack.",
      evidenceChunk: chunk,
    })
  }

  if (/guarantee|guaranteed|100%|all risks|no delay/i.test(proposalText)) {
    const chunk = args.proposalChunks.find((item) =>
      /guarantee|guaranteed|100%|all risks|no delay/i.test(item.text),
    )
    add({
      category: "EVALUATOR_RED_FLAG",
      title: "Proposal may overpromise without a delivery plan",
      severity: "MEDIUM",
      affectedSection: "Methodology",
      requirement: "Evaluator confidence depends on credible commitments and practical controls.",
      proposalExcerpt: chunk ? compactText(chunk.text).slice(0, 500) : null,
      recommendation:
        "Replace absolute claims with measurable commitments, assumptions, and delivery controls.",
      evidenceChunk: chunk,
    })
  }

  return findings
}

function dedupeFindings(findings: NormalizedBidReviewFinding[]) {
  const seen = new Set<string>()
  const out: NormalizedBidReviewFinding[] = []
  for (const finding of findings) {
    const key = `${finding.category}:${finding.title.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(finding)
  }
  return out
}

function buildFallbackSummary(score: number, findings: NormalizedBidReviewFinding[]) {
  const high = findings.find((finding) => finding.severity === "HIGH" || finding.severity === "CRITICAL")
  if (!high) return `Your proposal readiness score is ${score}%. No major bid review issues were detected.`
  return `Your proposal needs attention on ${high.title.toLowerCase()} before submission.`
}

function deriveLists(findings: NormalizedBidReviewFinding[]) {
  const strengths =
    findings.length === 0
      ? ["No major review findings were detected in the supplied proposal files."]
      : []
  const weaknesses = findings
    .filter((finding) => finding.severity === "HIGH" || finding.severity === "CRITICAL")
    .map((finding) => finding.title)
    .slice(0, 8)
  const redFlags = findings
    .filter(
      (finding) =>
        finding.category === "EVALUATOR_RED_FLAG" ||
        finding.category === "UNCLEAR_PRICING" ||
        finding.severity === "CRITICAL",
    )
    .map((finding) => finding.title)
    .slice(0, 10)
  return { strengths, weaknesses, redFlags }
}

async function generateAiReview(args: {
  tenderTitle: string
  tenderChunks: ContextChunk[]
  proposalChunks: ContextChunk[]
  complianceChunks: ContextChunk[]
}) {
  const client = openaiClient()
  if (!client) return null

  const formatChunks = (label: string, chunks: ContextChunk[], maxChars: number) =>
    chunks
      .map((chunk, index) => {
        const source = chunk.filename ? `${chunk.filename}` : `${label} ${index + 1}`
        return `[${label} ${index + 1}] ${source}\n${chunk.text.slice(0, maxChars)}`
      })
      .join("\n\n")

  const prompt = `You are TenderLens' AI Bid Reviewer for South African tenders.

Review the proposal against only the supplied tender, proposal, and compliance context. Return JSON only.
Avoid legal certainty and award prediction. Distinguish missing, weak, and unknown evidence.

Tender: ${args.tenderTitle}

Categories:
- UNANSWERED_REQUIREMENT
- WEAK_RESPONSE
- MISSING_EVIDENCE
- POOR_STRUCTURE
- COMPLIANCE_GAP
- UNCLEAR_PRICING
- EVALUATOR_RED_FLAG

Return:
{
  "summary": "Your proposal is strong technically but weak on evidence for previous experience.",
  "strengths": ["Clear technical methodology"],
  "weaknesses": ["Previous experience claims are not supported"],
  "redFlags": ["No signed reference letters found"],
  "findings": [
    {
      "category": "MISSING_EVIDENCE",
      "title": "Previous experience lacks supporting evidence",
      "severity": "HIGH",
      "affectedSection": "Company experience",
      "requirement": "Tender asks for similar completed projects",
      "proposalExcerpt": "We have extensive experience in similar projects.",
      "evidence": [{"source":"proposal","filename":"proposal.pdf","quote":"short quote"}],
      "recommendation": "Add project names, values, completion dates, client contacts, and reference letters."
    }
  ]
}

Tender context:
${formatChunks("tender", args.tenderChunks, 1500)}

Proposal context:
${formatChunks("proposal", args.proposalChunks, 1800)}

Latest compliance context:
${formatChunks("compliance", args.complianceChunks, 1000)}`

  const response = await client.chat.completions.create({
    model: env.BID_REVIEWER_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: env.BID_REVIEWER_MAX_TOKENS,
    response_format: { type: "json_object" },
  })

  return parseBidReviewAiResponse(response.choices[0]?.message?.content || "{}")
}

function toDto(review: any) {
  return {
    id: review.id,
    tenderId: review.tenderId,
    workspaceId: review.workspaceId ?? null,
    status: review.status,
    score: review.score ?? null,
    summary: review.summary ?? null,
    strengths: review.strengths ?? [],
    weaknesses: review.weaknesses ?? [],
    redFlags: review.redFlags ?? [],
    proposalFileIds: review.proposalFileIds ?? [],
    findings: (review.findings ?? []).map((finding: any) => ({
      id: finding.id,
      category: finding.category,
      title: finding.title,
      severity: finding.severity,
      affectedSection: finding.affectedSection ?? null,
      requirement: finding.requirement ?? null,
      proposalExcerpt: finding.proposalExcerpt ?? null,
      evidence: Array.isArray(finding.evidence) ? finding.evidence : [],
      recommendation: finding.recommendation ?? null,
    })),
    createdAt: review.createdAt,
    completedAt: review.completedAt ?? null,
  }
}

export async function startBidReview(args: {
  orgId: string
  tenderId: string
  userId: string
  proposalFileIds?: string[]
}) {
  if (!env.BID_REVIEWER_ENABLED) {
    throw new AppError("DISABLED", "Bid reviewer disabled", 400)
  }

  const tender = await prisma.tender.findFirst({
    where: { id: args.tenderId, orgId: args.orgId },
    select: { id: true },
  })
  if (!tender) throw new AppError("NOT_FOUND", "Tender not found", 404)

  const { workspace, files } = await loadWorkspaceAndProposalFiles(args)

  const review = await (prisma as any).bidReview.create({
    data: {
      orgId: args.orgId,
      tenderId: args.tenderId,
      workspaceId: workspace.id,
      createdById: args.userId,
      proposalFileIds: files.map((file: any) => file.id),
      status: "PENDING",
    },
    include: { findings: true },
  })

  if (env.BID_REVIEWER_QUEUE_ENABLED) {
    await bidReviewQueue.add("review", { reviewId: review.id })
  } else {
    await runBidReview(review.id)
  }

  return toDto(review)
}

export async function runBidReview(reviewId: string) {
  const review = await (prisma as any).bidReview.findUnique({
    where: { id: reviewId },
  })
  if (!review) return { processed: 0, reason: "not_found" as const }
  if (review.status === "COMPLETED") {
    return { processed: 0, reason: "completed" as const }
  }

  await (prisma as any).bidReview.update({
    where: { id: reviewId },
    data: { status: "PROCESSING", startedAt: new Date(), error: null },
  })

  try {
    const [tenderContext, complianceContext, attachments] = await Promise.all([
      loadTenderContext({ orgId: review.orgId, tenderId: review.tenderId }),
      loadLatestComplianceContext({ orgId: review.orgId, tenderId: review.tenderId }),
      prisma.bidAttachment.findMany({
        where: {
          id: { in: review.proposalFileIds ?? [] },
          orgId: review.orgId,
          workspaceId: review.workspaceId ?? undefined,
        },
      }),
    ])

    if (!attachments.length) {
      throw new AppError("NO_PROPOSAL_FILES", "No proposal files are available for review.", 400)
    }

    const proposalChunks = await loadProposalContext(attachments)
    if (!proposalChunks.length) {
      throw new AppError("NO_PROPOSAL_TEXT", "No proposal text is available for bid review.", 400)
    }

    const deterministic = deterministicFindings({
      tenderChunks: tenderContext.chunks,
      proposalChunks,
      complianceChunks: complianceContext.chunks,
    })
    const ai = await generateAiReview({
      tenderTitle: tenderContext.tender.title,
      tenderChunks: tenderContext.chunks,
      proposalChunks,
      complianceChunks: complianceContext.chunks,
    })

    const aiFindings = ai ? normalizeBidReviewFindings(ai.findings) : []
    const findings = dedupeFindings([...deterministic, ...aiFindings])
    const score = calculateBidReviewScore(findings)
    const derived = deriveLists(findings)
    const summary = ai?.summary || buildFallbackSummary(score, findings)
    const strengths = normalizeStringList(ai?.strengths, 8).length
      ? normalizeStringList(ai?.strengths, 8)
      : derived.strengths
    const weaknesses = normalizeStringList(ai?.weaknesses, 8).length
      ? normalizeStringList(ai?.weaknesses, 8)
      : derived.weaknesses
    const redFlags = normalizeStringList(ai?.redFlags, 10).length
      ? normalizeStringList(ai?.redFlags, 10)
      : derived.redFlags

    await (prisma as any).$transaction([
      (prisma as any).bidReviewFinding.deleteMany({ where: { reviewId } }),
      (prisma as any).bidReview.update({
        where: { id: reviewId },
        data: {
          status: "COMPLETED",
          score,
          summary,
          strengths,
          weaknesses,
          redFlags,
          model: env.OPENAI_API_KEY ? env.BID_REVIEWER_MODEL : "deterministic",
          error: null,
          completedAt: new Date(),
        },
      }),
      ...(findings.length
        ? [
            (prisma as any).bidReviewFinding.createMany({
              data: findings.map((finding) => ({
                orgId: review.orgId,
                reviewId,
                category: finding.category,
                title: finding.title,
                severity: finding.severity,
                affectedSection: finding.affectedSection,
                requirement: finding.requirement,
                proposalExcerpt: finding.proposalExcerpt,
                evidence: finding.evidence as any,
                recommendation: finding.recommendation,
              })),
            }),
          ]
        : []),
    ])

    if (
      score < env.BID_REVIEWER_SCORE_PASS ||
      findings.some((finding) => finding.severity === "CRITICAL" || finding.severity === "HIGH")
    ) {
      await emitEvent({
        orgId: review.orgId,
        type: NotificationType.ALERT_FIRED,
        entityType: "Tender",
        entityId: review.tenderId,
        targetUserId: review.createdById ?? undefined,
        meta: {
          kind: "BID_REVIEW_COMPLETED",
          score,
          summary,
          redFlags,
          tenderId: review.tenderId,
        },
      })
    }

    return { processed: 1 as const }
  } catch (error: any) {
    await (prisma as any).bidReview.update({
      where: { id: reviewId },
      data: {
        status: "FAILED",
        error: error?.message ?? "Bid review failed",
        completedAt: new Date(),
      },
    })
    throw error
  }
}

export async function listBidReviews(args: { orgId: string; tenderId: string }) {
  const reviews = await (prisma as any).bidReview.findMany({
    where: { orgId: args.orgId, tenderId: args.tenderId },
    orderBy: { createdAt: "desc" },
    include: { findings: true },
  })
  return reviews.map(toDto)
}

export async function getBidReview(args: { orgId: string; reviewId: string }) {
  const review = await (prisma as any).bidReview.findFirst({
    where: { id: args.reviewId, orgId: args.orgId },
    include: { findings: true },
  })
  if (!review) throw new AppError("NOT_FOUND", "Bid review not found", 404)
  return toDto(review)
}

export async function rerunBidReview(args: {
  orgId: string
  reviewId: string
  userId: string
}) {
  const review = await (prisma as any).bidReview.findFirst({
    where: { id: args.reviewId, orgId: args.orgId },
    select: { tenderId: true, proposalFileIds: true },
  })
  if (!review) throw new AppError("NOT_FOUND", "Bid review not found", 404)

  return startBidReview({
    orgId: args.orgId,
    tenderId: review.tenderId,
    userId: args.userId,
    proposalFileIds: review.proposalFileIds,
  })
}
