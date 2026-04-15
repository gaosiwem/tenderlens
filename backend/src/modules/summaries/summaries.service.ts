import { prisma } from "../../db/prisma"
import OpenAI from "openai"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"
import { logger } from "../../utils/logger"
import { CacheService } from "../../utils/cache"
import { primeTenderExtractsForAi } from "../chat/chat.service"
import { getOrRefreshDeadlines } from "../deadlines/deadlines.service"
import { ORG_PROFILE_TENDER_SOURCE } from "../orgDocs/orgDocs.constants"

type AIProvider = "openai" | "gemini"
const SUMMARY_MAX_TOTAL_EXTRACT_CHARS = 32000
const SUMMARY_MAX_PER_FILE_CHARS = 5000
const SUMMARY_MIN_PER_FILE_CHARS = 120

type SummaryExtractSourceRow = {
  tenderFileId: string
  text: string
  createdAt: Date
}

export type SummaryLatestExtract = {
  tenderFileId: string
  fileName: string
  text: string
  createdAt: Date
}

type SummaryCoverageFile = {
  tenderFileId: string
  fileName: string
  extractCreatedAt: string
  availableChars: number
  usedChars: number
  truncated: boolean
}

type SummaryCoverage = {
  fileCountTotal: number
  fileCountIncluded: number
  truncatedFileCount: number
  totalCharsAvailable: number
  totalCharsUsed: number
  latestExtractCreatedAt: string | null
  files: SummaryCoverageFile[]
}

function normalizeSummaryMeta(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {}
  return { ...(meta as Record<string, unknown>) }
}

function buildExtractScope(args: { tenderId: string }) {
  return { tenderId: args.tenderId }
}

function buildSummaryScope(args: { tenderId: string }) {
  return { tenderId: args.tenderId }
}

function normalizeExtractText(text: string | null | undefined) {
  return (text ?? "").replace(/\r\n/g, "\n").trim()
}

export function selectLatestExtractsPerFile(args: {
  extracts: SummaryExtractSourceRow[]
  fileNameById: Map<string, string>
}) {
  const latestByFile = new Map<string, SummaryLatestExtract>()

  for (const row of args.extracts) {
    if (!row.tenderFileId) continue
    if (latestByFile.has(row.tenderFileId)) continue

    const text = normalizeExtractText(row.text)
    if (!text) continue

    latestByFile.set(row.tenderFileId, {
      tenderFileId: row.tenderFileId,
      fileName: args.fileNameById.get(row.tenderFileId) || row.tenderFileId,
      text,
      createdAt: row.createdAt,
    })
  }

  return Array.from(latestByFile.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )
}

export function buildSummaryExtractContext(
  extracts: SummaryLatestExtract[],
): { context: string; coverage: SummaryCoverage } {
  const totalCharsAvailable = extracts.reduce((sum, item) => sum + item.text.length, 0)
  const latestExtractCreatedAt = extracts[0]?.createdAt
    ? extracts[0].createdAt.toISOString()
    : null

  if (extracts.length === 0) {
    return {
      context: "",
      coverage: {
        fileCountTotal: 0,
        fileCountIncluded: 0,
        truncatedFileCount: 0,
        totalCharsAvailable: 0,
        totalCharsUsed: 0,
        latestExtractCreatedAt: null,
        files: [],
      },
    }
  }

  let remainingBudget = SUMMARY_MAX_TOTAL_EXTRACT_CHARS
  const blocks: string[] = []
  const files: SummaryCoverageFile[] = []

  for (let idx = 0; idx < extracts.length; idx++) {
    const item = extracts[idx]
    const remainingFiles = extracts.length - idx
    const minReserveForOthers = (remainingFiles - 1) * SUMMARY_MIN_PER_FILE_CHARS
    const fairShare = Math.floor(remainingBudget / remainingFiles)
    const maxAllowedForCurrent = Math.max(
      SUMMARY_MIN_PER_FILE_CHARS,
      remainingBudget - minReserveForOthers,
    )
    const targetChars = Math.max(
      SUMMARY_MIN_PER_FILE_CHARS,
      Math.min(SUMMARY_MAX_PER_FILE_CHARS, fairShare, maxAllowedForCurrent),
    )

    const usedChars = Math.min(item.text.length, Math.max(0, targetChars))
    const snippet = item.text.slice(0, usedChars)
    const truncated = usedChars < item.text.length
    remainingBudget = Math.max(0, remainingBudget - usedChars)

    blocks.push(`[Document ${idx + 1}: ${item.fileName}]\n${snippet}`)
    files.push({
      tenderFileId: item.tenderFileId,
      fileName: item.fileName,
      extractCreatedAt: item.createdAt.toISOString(),
      availableChars: item.text.length,
      usedChars,
      truncated,
    })
  }

  return {
    context: blocks.join("\n\n"),
    coverage: {
      fileCountTotal: extracts.length,
      fileCountIncluded: files.length,
      truncatedFileCount: files.filter((f) => f.truncated).length,
      totalCharsAvailable,
      totalCharsUsed: files.reduce((sum, f) => sum + f.usedChars, 0),
      latestExtractCreatedAt,
      files,
    },
  }
}

function client() {
  if (!env.OPENAI_API_KEY)
    throw new AppError("CONFIG_ERROR", "OPENAI_API_KEY missing", 500)
  return new OpenAI({ apiKey: env.OPENAI_API_KEY })
}

function primaryProvider(): AIProvider {
  return (env.AI_PROVIDER ?? "openai") === "gemini" ? "gemini" : "openai"
}

function providerOrder() {
  const primary = primaryProvider()
  return primary === "gemini"
    ? (["gemini", "openai"] as const)
    : (["openai", "gemini"] as const)
}

function hasCredentials(provider: AIProvider) {
  return provider === "gemini"
    ? Boolean(env.GEMINI_API_KEY)
    : Boolean(env.OPENAI_API_KEY)
}

async function loadTenderSummaryRecord(args: {
  tenderId: string
}) {
  return (prisma as any).tenderSummary.findFirst({
    where: buildSummaryScope(args),
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  })
}

function withSummaryMeta(args: {
  summary: any
  orgId: string
  latestExtractAt: Date | null
}) {
  const summaryGeneratedAt = new Date(
    args.summary.updatedAt ?? args.summary.createdAt,
  )
  const latestExtractAt = args.latestExtractAt
  const isStale = Boolean(
    latestExtractAt && latestExtractAt.getTime() > summaryGeneratedAt.getTime(),
  )
  const meta = normalizeSummaryMeta(args.summary.meta)

  return {
    ...args.summary,
    orgId: args.orgId,
    meta: {
      ...meta,
      latestExtractCreatedAt: latestExtractAt
        ? latestExtractAt.toISOString()
        : null,
      summaryCreatedAt: summaryGeneratedAt.toISOString(),
      isStale,
    },
  }
}

export async function getTenderSummary(orgId: string, tenderId: string) {
  const tender = await prisma.tender.findFirst({
    where: {
      id: tenderId,
      OR: [
        {
          orgId: null,
          source: { not: ORG_PROFILE_TENDER_SOURCE },
        },
        {
          orgId,
          source: ORG_PROFILE_TENDER_SOURCE,
        },
      ],
    },
    select: { orgId: true },
  })

  const summary = tender
    ? await loadTenderSummaryRecord({
        tenderId,
      })
    : null

  if (!summary) {
    const cached = await CacheService.get<any>(CacheService.getAiKey(tenderId, "summary"))
    if (cached) {
      return {
        ...cached,
        id: "cached-" + tenderId,
        orgId,
        isCached: true,
      }
    }
    return null
  }

  if (!tender) return summary

  const latestExtract = await prisma.tenderExtract.findFirst({
    where: buildExtractScope({ tenderId }),
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })

  return withSummaryMeta({
    summary,
    orgId,
    latestExtractAt: latestExtract?.createdAt ?? null,
  })
}

export async function generateTenderSummary(orgId: string, tenderId: string) {
  const tender = await prisma.tender.findFirst({
    where: {
      id: tenderId,
      OR: [
        {
          orgId: null,
          source: { not: ORG_PROFILE_TENDER_SOURCE },
        },
        {
          orgId,
          source: ORG_PROFILE_TENDER_SOURCE,
        },
      ],
    },
    select: {
      id: true,
      orgId: true,
      title: true,
      tenderNumber: true,
      description: true,
      category: true,
      companyName: true,
      province: true,
      scrapedStatus: true,
      publishedDate: true,
      closingDate: true,
      amount: true,
    },
  })

  if (!tender) throw new AppError("NOT_FOUND", "Tender not found", 404)

  await primeTenderExtractsForAi({
    orgId,
    tenderId,
    includeExternalDocs: true,
    question: tender.title ?? undefined,
  })

  try {
    await getOrRefreshDeadlines({ orgId, tenderId })
  } catch (error) {
    logger.warn(
      { err: error, tenderId, orgId },
      "summary_deadline_refresh_failed",
    )
  }

  const extractScope = buildExtractScope({ tenderId })

  const latestExtract = await prisma.tenderExtract.findFirst({
    where: extractScope,
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })

  const existingSummary = await loadTenderSummaryRecord({
    tenderId,
  })

  if (existingSummary) {
    const latestExtractAt = latestExtract?.createdAt ?? null
    const existingGeneratedAt = new Date(
      existingSummary.updatedAt ?? existingSummary.createdAt,
    )
    if (
      !latestExtractAt ||
      existingGeneratedAt.getTime() >= latestExtractAt.getTime()
    ) {
      return withSummaryMeta({
        summary: existingSummary,
        orgId,
        latestExtractAt,
      })
    }
  }

  const [extractRows, insights] = await Promise.all([
    prisma.tenderExtract.findMany({
      where: extractScope,
      orderBy: { createdAt: "desc" },
      select: {
        tenderFileId: true,
        text: true,
        createdAt: true,
      },
    }),
    prisma.tenderInsight.findMany({
      where: extractScope,
      orderBy: { createdAt: "desc" },
    }),
  ])

  const tenderFileIds = Array.from(
    new Set(
      extractRows
        .map((row) => row.tenderFileId)
        .filter((id): id is string => Boolean(id)),
    ),
  )

  const tenderFiles =
    tenderFileIds.length > 0
      ? await prisma.tenderFile.findMany({
          where: { id: { in: tenderFileIds } },
          select: { id: true, originalFilename: true },
        })
      : []

  const fileNameById = new Map(
    tenderFiles.map((file) => [file.id, file.originalFilename]),
  )

  const latestExtracts = selectLatestExtractsPerFile({
    extracts: extractRows,
    fileNameById,
  })
  const extractBundle = buildSummaryExtractContext(latestExtracts)
  const extractTexts = extractBundle.context
  const insightsJson = JSON.stringify(insights, null, 2).slice(0, 8000)
  const tenderFacts = [
    `Title: ${tender.title}`,
    `Tender Number: ${tender.tenderNumber || "-"}`,
    `Entity: ${tender.companyName || "-"}`,
    `Category: ${tender.category || "-"}`,
    `Province: ${tender.province || "-"}`,
    `Published Date: ${tender.publishedDate || "-"}`,
    `Closing Date: ${tender.closingDate || "-"}`,
    `Status: ${tender.scrapedStatus || "-"}`,
    `Amount/Budget: ${tender.amount || "-"}`,
  ].join("\n")

  const system = [
    "You are TenderLens Tender Analyst.",
    "Produce a detailed, practical tender briefing for business users.",
    "Use only provided data and clearly avoid unsupported claims.",
    "Do not use placeholder phrases for missing data.",
    "When information is unavailable, omit it or say it is unavailable in plain language.",
    "Use markdown with clear H2/H3 sections and bullet points.",
    "Keep wording precise and action-oriented.",
    "Do not invent facts, contacts, deadlines, or monetary values.",
    "Prefer structured output over generic prose.",
  ].join("\n")

  const userParts = [
    `Tender: ${tender.title}`,
    "",
    "Tender Facts:",
    tenderFacts,
  ]

  const trimmedDescription = (tender.description ?? "").trim()
  if (trimmedDescription) {
    userParts.push("", "Tender Description:", trimmedDescription)
  }

  if (extractTexts) {
    userParts.push("", "Document Extracts:", extractTexts)
  } else {
    userParts.push(
      "",
      "Document Extracts:",
      "No extracted document content was available at generation time.",
    )
  }

  if (insights.length > 0) {
    userParts.push("", "Extracted Insights:", insightsJson)
  }

  userParts.push(
    "",
    "Output format (mandatory):",
    "## Executive Overview",
    "## Scope and Deliverables",
    "## Eligibility and Compliance Requirements",
    "## Key Dates and Milestones",
    "## Pricing, Budget, and Commercial Terms",
    "## Submission Requirements Checklist",
    "## Risks and Clarifications Needed",
    "## Quick Bid/No-Bid Signal (with 3 short reasons)",
  )

  const user = userParts.join("\n")

  const generateWithGemini = async () => {
    if (!env.GEMINI_API_KEY) {
      throw new AppError("CONFIG_ERROR", "GEMINI_API_KEY missing", 500)
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      env.GEMINI_CHAT_MODEL || "gemini-1.5-flash",
    )}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2200,
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new AppError(
        "SUMMARY_GENERATION_FAILED",
        `Gemini summary failed (${res.status}): ${body}`,
        502,
      )
    }

    const out = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    return (
      out.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim() || "Failed to generate summary."
    )
  }

  const generateWithOpenAI = async () => {
    const out = await client().chat.completions.create({
      model: env.OPENAI_CHAT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 2200,
    })
    return out.choices[0]?.message?.content ?? "Failed to generate summary."
  }

  const providers = providerOrder().filter(hasCredentials)
  if (providers.length === 0) {
    throw new AppError(
      "CONFIG_ERROR",
      "No AI provider credentials configured for summary generation",
      500,
    )
  }

  let content = "Failed to generate summary."
  let lastError: unknown = null
  for (const provider of providers) {
    try {
      content =
        provider === "gemini"
          ? await generateWithGemini()
          : await generateWithOpenAI()
      lastError = null
      break
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(
        `[summary] Provider ${provider} failed, trying fallback if available: ${message}`,
      )
    }
  }

  if (lastError) {
    throw lastError instanceof AppError
      ? lastError
      : new AppError(
          "SUMMARY_GENERATION_FAILED",
          lastError instanceof Error ? lastError.message : "Summary generation failed",
          502,
        )
  }

  const saved = existingSummary
    ? await (prisma as any).tenderSummary.update({
        where: { id: existingSummary.id },
        data: {
          content,
          meta: {
            coverage: extractBundle.coverage,
            latestExtractCreatedAt: extractBundle.coverage.latestExtractCreatedAt,
            summaryCreatedAt: new Date().toISOString(),
            isStale: false,
          },
        },
      })
    : await (prisma as any).tenderSummary.create({
        data: {
          orgId,
          tenderId,
          content,
          meta: {
            coverage: extractBundle.coverage,
            latestExtractCreatedAt: extractBundle.coverage.latestExtractCreatedAt,
            summaryCreatedAt: new Date().toISOString(),
            isStale: false,
          },
        },
      })

  // Cache globally for other organizations
  await CacheService.set(CacheService.getAiKey(tenderId, "summary"), saved)

  return withSummaryMeta({
    summary: saved,
    orgId,
    latestExtractAt: latestExtract?.createdAt ?? null,
  })
}
