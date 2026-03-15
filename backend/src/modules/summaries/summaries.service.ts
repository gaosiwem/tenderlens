import { prisma } from "../../db/prisma"
import OpenAI from "openai"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"
import { logger } from "../../utils/logger"

type AIProvider = "openai" | "gemini"

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

export async function getTenderSummary(orgId: string, tenderId: string) {
  const summary = await (prisma as any).tenderSummary.findFirst({
    where: { orgId, tenderId },
    orderBy: { createdAt: "desc" },
  })
  return summary
}

export async function generateTenderSummary(orgId: string, tenderId: string) {
  const tender = await prisma.tender.findFirst({
    where: { id: tenderId, OR: [{ orgId }, { orgId: null }] },
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

  const globalTender = tender.orgId == null

  const [extracts, insights] = await Promise.all([
    prisma.tenderExtract.findMany({
      where: globalTender ? { tenderId } : { orgId, tenderId },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    prisma.tenderInsight.findMany({
      where: globalTender ? { tenderId } : { orgId, tenderId },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const extractTexts = extracts.map((e) => e.text).join("\n\n").slice(0, 18000)
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
    "Use only provided data and explicitly mark missing data as 'Not explicitly stated'.",
    "Use markdown with clear H2/H3 sections and bullet points.",
    "Keep wording precise and action-oriented.",
    "Do not invent facts, contacts, deadlines, or monetary values.",
    "Prefer structured output over generic prose.",
  ].join("\n")

  const user = [
    `Tender: ${tender.title}`,
    "",
    "Tender Facts:",
    tenderFacts,
    "",
    "Tender Description:",
    tender.description || "Not explicitly stated",
    "",
    "Content Snippets:",
    extractTexts,
    "",
    "Extracted Insights:",
    insightsJson,
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
  ].join("\n")

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

  const saved = await (prisma as any).tenderSummary.create({
    data: {
      orgId,
      tenderId,
      content,
    },
  })

  return saved
}
