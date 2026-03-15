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

function safeJsonParse(s: string) {
  const t = s.trim()
  const a = t.indexOf("{")
  const b = t.lastIndexOf("}")
  if (a === -1 || b === -1) return null
  try {
    return JSON.parse(t.slice(a, b + 1))
  } catch {
    return null
  }
}

export type DeadlineExtraction = {
  closingAt: string | null
  briefingAt: string | null
  siteVisitAt: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  confidence: number
  citedChunkIds: string[]
}

export async function extractDeadlines(args: { questionContext: string }) {
  if (!env.DEADLINE_EXTRACTION_ENABLED) return null

  const system = [
    "You extract tender deadlines from text.",
    "Return STRICT JSON with keys:",
    "closingAt, briefingAt, siteVisitAt (ISO8601 or null), contactName, contactEmail, contactPhone, confidence (0..1), citedChunkIds (array).",
    "Use only the provided text. If unknown, null.",
    "citedChunkIds must refer to the chunk ids present in text markers [chunk:ID].",
  ].join("\n")

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
      "No AI provider credentials configured for deadline extraction",
      500,
    )
  }

  const extractWithGemini = async () => {
    if (!env.GEMINI_API_KEY) {
      throw new AppError("CONFIG_ERROR", "GEMINI_API_KEY missing", 500)
    }

    const model = env.GEMINI_CHAT_MODEL || "gemini-1.5-flash"
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          {
            role: "user",
            parts: [{ text: args.questionContext }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: env.DEADLINE_MAX_TOKENS || 400,
          responseMimeType: "application/json",
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new AppError(
        "DEADLINE_EXTRACTION_FAILED",
        `Gemini extraction failed (${res.status}): ${body}`,
        502,
      )
    }

    const out = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    return (
      out.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("") ?? ""
    )
  }

  const extractWithOpenAI = async () => {
    const out = await client().chat.completions.create({
      model: env.DEADLINE_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: args.questionContext },
      ],
      temperature: 0.1,
      max_tokens: env.DEADLINE_MAX_TOKENS || 400,
    })
    return out.choices[0]?.message?.content ?? ""
  }

  let raw = ""
  let lastError: unknown = null
  for (const provider of providers) {
    try {
      raw =
        provider === "gemini"
          ? await extractWithGemini()
          : await extractWithOpenAI()
      lastError = null
      break
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(
        `[deadlines] Provider ${provider} failed, trying fallback if available: ${message}`,
      )
    }
  }

  if (lastError) {
    throw lastError instanceof AppError
      ? lastError
      : new AppError(
          "DEADLINE_EXTRACTION_FAILED",
          lastError instanceof Error
            ? lastError.message
            : "Deadline extraction failed",
          502,
        )
  }

  const parsed = safeJsonParse(raw)
  if (!parsed) return null

  return parsed as DeadlineExtraction
}
