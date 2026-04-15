import { OpenAI } from "openai"
import { prisma } from "../../db/prisma"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"
import { ORG_PROFILE_TENDER_SOURCE } from "../orgDocs/orgDocs.constants"
import { logger } from "../../utils/logger"
import { CacheService } from "../../utils/cache"

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })
type AIProvider = "openai" | "gemini"

type TenderMetadataRow = {
  description: string | null
  tenderNumber: string | null
  category: string | null
  companyName: string | null
  closingDate: string | null
}

type ChecklistItemValue = {
  task: string
  category: string
  mandatory: boolean
  checked: boolean
  notes: string
}

function sanitizeChecklistTitle(rawTitle: string | undefined, tenderTitle: string) {
  const fallback = `Bid Submission Checklist for ${tenderTitle}`
  const title = (rawTitle ?? "").trim()
  if (!title) return fallback

  const cleaned = title
    .replace(/\bfor\s+(?:the\s+)?(?:tender\s+)?title\b\s*[:\-]?\s*/gi, "for ")
    .replace(/^title\s*[:\-]?\s*/i, "")
    .replace(/\btitle\s*[:\-]\s*/gi, "")
    .replace(/\bfor\s*[:\-]\s*/gi, "for ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()

  if (!cleaned) return fallback
  if (/^bid submission checklist for$/i.test(cleaned)) return fallback
  if (/\bfor$/i.test(cleaned)) return `${cleaned} ${tenderTitle}`.trim()
  return cleaned
}

function normalizeChecklistItems(input: unknown): ChecklistItemValue[] {
  if (!Array.isArray(input)) return []

  const out: ChecklistItemValue[] = []
  for (const row of input) {
    if (!row || typeof row !== "object") continue
    const item = row as Record<string, unknown>
    const task = String(item.task ?? "").trim()
    if (!task) continue

    const category = String(item.category ?? "").trim()
    const mandatory = Boolean(item.mandatory)
    const checked = Boolean(item.checked)
    const notes = String(item.notes ?? "").slice(0, 4000)

    out.push({
      task,
      category,
      mandatory,
      checked,
      notes,
    })
  }

  return out
}

function safeJsonParse(raw: string) {
  const t = (raw ?? "").trim()
  const a = t.indexOf("{")
  const b = t.lastIndexOf("}")
  if (a === -1 || b === -1) return null
  try {
    return JSON.parse(t.slice(a, b + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

async function generateJsonWithProvider(args: {
  prompt: string
  model: string
  maxTokens: number
}) {
  const primary: AIProvider =
    (env.AI_PROVIDER ?? "openai") === "gemini" ? "gemini" : "openai"
  const order: AIProvider[] =
    primary === "gemini" ? ["gemini", "openai"] : ["openai", "gemini"]

  const hasCreds = (provider: AIProvider) =>
    provider === "gemini" ? Boolean(env.GEMINI_API_KEY) : Boolean(env.OPENAI_API_KEY)
  const providers = order.filter(hasCreds)
  if (providers.length === 0) {
    throw new AppError(
      "CONFIG_ERROR",
      "No AI provider credentials configured for tender AI generation",
      500,
    )
  }

  const callGemini = async () => {
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
        contents: [{ role: "user", parts: [{ text: args.prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: args.maxTokens,
          responseMimeType: "application/json",
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new AppError(
        "AI_GENERATION_FAILED",
        `Gemini generation failed (${res.status}): ${body}`,
        502,
      )
    }

    const out = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const raw =
      out.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("") ?? "{}"
    return safeJsonParse(raw) ?? {}
  }

  const callOpenAI = async () => {
    const response = await openai.chat.completions.create({
      model: args.model,
      messages: [{ role: "user", content: args.prompt }],
      max_tokens: args.maxTokens,
      response_format: { type: "json_object" },
    })

    return JSON.parse(response.choices[0].message.content || "{}") as Record<
      string,
      unknown
    >
  }

  let lastError: unknown = null
  for (const provider of providers) {
    try {
      return provider === "gemini" ? await callGemini() : await callOpenAI()
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(
        `[tenders:ai] Provider ${provider} failed, trying fallback if available: ${message}`,
      )
    }
  }

  throw lastError instanceof AppError
    ? lastError
    : new AppError(
        "AI_GENERATION_FAILED",
        lastError instanceof Error ? lastError.message : "Tender AI generation failed",
        502,
      )
}

async function loadTenderMetadata(tenderId: string) {
  try {
    const rows = await prisma.$queryRaw<TenderMetadataRow[]>`
      SELECT
        "description",
        "tenderNumber",
        "category",
        "companyName",
        "closingDate"
      FROM "Tender"
      WHERE "id" = ${tenderId}
      LIMIT 1
    `
    return rows[0] ?? null
  } catch {
    return null
  }
}

async function loadOrgBusinessContext(orgId: string) {
  const profileTender = await prisma.tender.findFirst({
    where: { orgId, source: ORG_PROFILE_TENDER_SOURCE },
    select: { id: true },
  })
  if (!profileTender) return ""

  const extracts = await prisma.tenderExtract.findMany({
    where: { orgId, tenderId: profileTender.id },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { text: true },
  })

  const merged = extracts
    .map((e) => e.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 8000)

  return merged
}

async function loadTenderContext(args: {
  orgId: string
  tenderId: string
  fallbackTitle: string
}) {
  void args.orgId
  const extract = await prisma.tenderExtract.findFirst({
    where: { tenderId: args.tenderId },
    orderBy: { createdAt: "desc" },
    select: { text: true },
  })
  if (extract?.text?.trim()) return extract.text

  const chunks = await prisma.tenderChunk.findMany({
    where: { tenderId: args.tenderId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { content: true },
  })
  if (chunks.length > 0) {
    return chunks.map((c) => c.content).join("\n\n")
  }

  const scraped = await loadTenderMetadata(args.tenderId)
  if (!scraped) return ""

  return [
    `Tender: ${args.fallbackTitle}`,
    `Description: ${scraped.description ?? "-"}`,
    `Tender Number: ${scraped.tenderNumber ?? "-"}`,
    `Category: ${scraped.category ?? "-"}`,
    `Company: ${scraped.companyName ?? "-"}`,
    `Closing Date: ${scraped.closingDate ?? "-"}`,
  ].join("\n")
}

export async function compareTenders(args: {
  orgId: string
  tenderAId: string
  tenderBId: string
}) {
  if (!env.TENDER_COMPARE_ENABLED)
    throw new AppError("DISABLED", "Comparison disabled", 400)

  const [tA, tB] = await Promise.all([
    prisma.tender.findFirst({
      where: {
        id: args.tenderAId,
        orgId: null,
        source: { not: ORG_PROFILE_TENDER_SOURCE },
      },
      include: { deadlines: true },
    }),
    prisma.tender.findFirst({
      where: {
        id: args.tenderBId,
        orgId: null,
        source: { not: ORG_PROFILE_TENDER_SOURCE },
      },
      include: { deadlines: true },
    }),
  ])

  if (!tA || !tB) throw new AppError("NOT_FOUND", "Tender not found", 404)

  const [textA, textB, businessContext] = await Promise.all([
    loadTenderContext({
      orgId: args.orgId,
      tenderId: tA.id,
      fallbackTitle: tA.title,
    }),
    loadTenderContext({
      orgId: args.orgId,
      tenderId: tB.id,
      fallbackTitle: tB.title,
    }),
    loadOrgBusinessContext(args.orgId),
  ])

  const prompt = `Compare the following two tenders and evaluate eligibility match against the organization's business profile.

Organization Business Profile (uploaded internal documents):
${businessContext.slice(0, 6000) || "No organization business document context provided yet."}

Provide a structured comparison highlighting differences in:
1. Deadlines (Closing date, briefing session)
2. Eligibility requirements (CIDB grade, B-BBEE, local content)
3. Documents required for submission
4. Scope of work summary
5. Eligibility match for Tender A and Tender B based on the organization profile
6. Critical missing requirements or gaps the organization must close

Tender A (${tA.title}):
${textA.slice(0, 6000)}

Tender B (${tB.title}):
${textB.slice(0, 6000)}

Return JSON format: {
  "deadlines": "...",
  "eligibility": "...",
  "documents": "...",
  "scope": "...",
  "qualification_fit_tender_a": "...",
  "qualification_fit_tender_b": "...",
  "qualification_gaps": "...",
  "summary": "..."
}`

  const result = await generateJsonWithProvider({
    prompt,
    model: env.COMPARE_MODEL,
    maxTokens: env.COMPARE_MAX_TOKENS,
  })

  const comparison = await prisma.tenderComparison.create({
    data: {
      orgId: args.orgId,
      tenderAId: args.tenderAId,
      tenderBId: args.tenderBId,
      result: result as any,
    },
  })

  return comparison
}

export async function getBidChecklist(args: {
  orgId: string
  tenderId: string
}) {
  const existing = await prisma.bidChecklist.findFirst({
    where: { orgId: args.orgId, tenderId: args.tenderId },
  })

  if (!existing) {
    const cached = await CacheService.get<any>(CacheService.getAiKey(args.tenderId, "checklist"))
    if (cached) {
      return {
        ...cached,
        id: "cached-" + args.tenderId,
        orgId: args.orgId,
        isCached: true,
      }
    }
  }

  return existing
}

export async function generateBidChecklist(args: {
  orgId: string
  tenderId: string
  force?: boolean
}) {
  if (!env.CHECKLIST_ENABLED)
    throw new AppError("DISABLED", "Checklist disabled", 400)

  const shouldForceRegenerate = args.force === true

  // Return cached checklist unless caller explicitly requests regeneration.
  const existing = await prisma.bidChecklist.findFirst({
    where: { orgId: args.orgId, tenderId: args.tenderId },
  })
  if (existing && !shouldForceRegenerate) return existing

  const tender = await prisma.tender.findFirst({
    where: {
      id: args.tenderId,
      orgId: null,
      source: { not: ORG_PROFILE_TENDER_SOURCE },
    },
    include: { deadlines: true },
  })
  if (!tender) throw new AppError("NOT_FOUND", "Tender not found", 404)

  const [text, businessContext] = await Promise.all([
    loadTenderContext({
      orgId: args.orgId,
      tenderId: tender.id,
      fallbackTitle: tender.title,
    }),
    loadOrgBusinessContext(args.orgId),
  ])

  const prompt = `Generate a comprehensive bid submission checklist for this tender. Focus on mandatory documents, compliance requirements, deadlines, and eligibility match against the organization's business profile.

Tender: ${tender.title}
Text: ${text.slice(0, 8000)}

Organization Business Profile (uploaded internal documents):
${businessContext.slice(0, 6000) || "No organization business document context provided yet."}

Include at least 3 eligibility checks that explicitly state whether the organization appears eligible to apply or what evidence is missing.

Return JSON format: {
  "title": "...",
  "items": [ { "task": "...", "category": "...", "mandatory": true, "checked": false, "notes": "" } ]
}`

  let rawResult: { title?: string; items?: unknown } = {}
  try {
    const content = await generateJsonWithProvider({
      prompt,
      model: env.CHECKLIST_MODEL,
      maxTokens: env.CHECKLIST_MAX_TOKENS,
    })
    rawResult = content as { title?: string; items?: unknown }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Checklist generation failed"
    throw new AppError("CHECKLIST_GENERATION_FAILED", message, 502)
  }

  const checklistData = {
    orgId: args.orgId,
    tenderId: args.tenderId,
    title: sanitizeChecklistTitle(rawResult.title, tender.title),
    checklist: normalizeChecklistItems(rawResult.items),
  }

  if (existing) {
    return prisma.bidChecklist.update({
      where: { id: existing.id },
      data: checklistData,
    })
  }

  const saved = await prisma.bidChecklist.create({
    data: checklistData,
  })

  // Cache globally for other organizations
  await CacheService.set(CacheService.getAiKey(args.tenderId, "checklist"), saved)

  return saved
}

export async function updateBidChecklist(args: {
  orgId: string
  tenderId: string
  items: unknown
}) {
  const existing = await prisma.bidChecklist.findFirst({
    where: { orgId: args.orgId, tenderId: args.tenderId },
  })

  if (!existing) {
    throw new AppError("NOT_FOUND", "Checklist not found", 404)
  }

  const checklist = normalizeChecklistItems(args.items)

  return prisma.bidChecklist.update({
    where: { id: existing.id },
    data: { checklist },
  })
}
