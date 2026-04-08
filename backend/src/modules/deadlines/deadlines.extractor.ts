import OpenAI from "openai"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"
import { logger } from "../../utils/logger"

type AIProvider = "openai" | "gemini"
type UnknownRecord = Record<string, unknown>

export type DeadlineEnquiryContact = {
  role: string | null
  name: string | null
  email: string | null
  phone: string | null
}

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
  enquiryContacts: DeadlineEnquiryContact[]
  confidence: number
  citedChunkIds: string[]
}

const DEADLINE_PROVIDER_TIMEOUT_MS = 35000

function normalizeNullableString(value: unknown, maxLen = 200) {
  if (typeof value !== "string") return null
  const t = value.replace(/\s+/g, " ").trim()
  if (!t) return null
  return t.slice(0, maxLen)
}

function normalizeEmail(value: unknown) {
  const t = normalizeNullableString(value, 320)
  if (!t) return null
  const m = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return m ? m[0].toLowerCase() : null
}

function normalizePhone(value: unknown) {
  const t = normalizeNullableString(value, 80)
  if (!t) return null
  const m = t.match(/\+?[0-9][0-9\s().-]{6,}[0-9]/)
  if (!m) return null
  return m[0].replace(/\s+/g, " ").trim()
}

function inferRole(text: string | null) {
  const lower = (text ?? "").toLowerCase()
  if (!lower) return null
  if (lower.includes("technical")) return "Technical enquiries"
  if (lower.includes("scm") || lower.includes("supply chain")) return "SCM enquiries"
  if (lower.includes("bid")) return "Bid enquiries"
  if (lower.includes("finance")) return "Finance enquiries"
  if (lower.includes("enquir")) return "Enquiries"
  return null
}

function dedupeEnquiryContacts(contacts: DeadlineEnquiryContact[]) {
  const seen = new Set<string>()
  const out: DeadlineEnquiryContact[] = []
  for (const c of contacts) {
    const key = `${c.email ?? ""}|${c.phone ?? ""}|${c.name ?? ""}|${c.role ?? ""}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

function sanitizeEnquiryContacts(value: unknown) {
  if (!Array.isArray(value)) return []
  const out: DeadlineEnquiryContact[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue
    const rec = entry as UnknownRecord
    const email = normalizeEmail(rec.email)
    const phone = normalizePhone(rec.phone)
    const name = normalizeNullableString(rec.name, 120)
    const role = normalizeNullableString(rec.role, 120) ?? inferRole(name)
    if (!email && !phone && !name) continue
    out.push({ role, name, email, phone })
  }
  return dedupeEnquiryContacts(out).slice(0, 10)
}

function inferEnquiryContactsFromText(text: string) {
  const contacts: DeadlineEnquiryContact[] = []
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
  const phoneRegex = /\+?[0-9][0-9\s().-]{6,}[0-9]/g
  const contactNameRegex =
    /(Mr|Ms|Mrs|Dr)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}|Contact(?:\s*Person)?\s*[:\-]\s*([A-Za-z][A-Za-z .'-]{2,60})/i

  for (const match of text.matchAll(emailRegex)) {
    const email = match[0]?.toLowerCase() ?? null
    if (!email) continue
    const idx = match.index ?? 0
    const start = Math.max(0, idx - 180)
    const end = Math.min(text.length, idx + 220)
    const windowText = text.slice(start, end)

    const phoneMatch = windowText.match(phoneRegex)
    const nameMatch = windowText.match(contactNameRegex)
    const nameCandidate = nameMatch?.[2] || nameMatch?.[0] || null
    const role = inferRole(windowText)

    contacts.push({
      role,
      name: normalizeNullableString(nameCandidate, 120),
      email,
      phone: normalizePhone(phoneMatch?.[0] ?? null),
    })
  }

  return dedupeEnquiryContacts(contacts).slice(0, 10)
}

function inferCitedChunkIdsFromText(text: string) {
  const ids: string[] = []
  const seen = new Set<string>()
  const regex = /\[chunk:([^\]]+)\]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const id = (match[1] ?? "").trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    if (ids.length >= 50) break
  }
  return ids
}

function buildHeuristicFallback(questionContext: string): DeadlineExtraction {
  const enquiryContacts = inferEnquiryContactsFromText(questionContext)
  const primary = enquiryContacts.find((c) => c.email || c.phone || c.name)
  return {
    closingAt: null,
    briefingAt: null,
    siteVisitAt: null,
    contactName: primary?.name ?? null,
    contactEmail: primary?.email ?? null,
    contactPhone: primary?.phone ?? null,
    enquiryContacts,
    confidence: enquiryContacts.length > 0 ? 0.25 : 0.1,
    citedChunkIds: inferCitedChunkIdsFromText(questionContext),
  }
}

export async function extractDeadlines(args: { questionContext: string }) {
  if (!env.DEADLINE_EXTRACTION_ENABLED) return null

  const system = [
    "You extract tender deadlines from text.",
    "Return STRICT JSON with keys:",
    "closingAt, briefingAt, siteVisitAt (ISO8601 or null), contactName, contactEmail, contactPhone, enquiryContacts (array of objects: role,name,email,phone), confidence (0..1), citedChunkIds (array).",
    "Use only the provided text. If unknown, null.",
    "citedChunkIds must refer to the chunk ids present in text markers [chunk:ID].",
    "Capture all enquiry contacts you find, including technical/SCM/bid enquiries where available.",
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
      signal: AbortSignal.timeout(DEADLINE_PROVIDER_TIMEOUT_MS),
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
    }, {
      timeout: DEADLINE_PROVIDER_TIMEOUT_MS,
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
    const message = lastError instanceof Error ? lastError.message : String(lastError)
    logger.warn(
      `[deadlines] Falling back to heuristic extraction after provider failures: ${message}`,
    )
    return buildHeuristicFallback(args.questionContext)
  }

  const parsed = safeJsonParse(raw)
  if (!parsed) {
    logger.warn("[deadlines] Model output was not parseable JSON, using heuristic fallback")
    return buildHeuristicFallback(args.questionContext)
  }
  const obj = parsed as UnknownRecord

  const heuristicContacts = inferEnquiryContactsFromText(args.questionContext)
  const modelContacts = sanitizeEnquiryContacts(obj.enquiryContacts)
  const enquiryContacts = dedupeEnquiryContacts([
    ...modelContacts,
    ...heuristicContacts,
  ]).slice(0, 10)

  const fallbackPrimary = enquiryContacts.find(
    (c) => c.email || c.phone || c.name,
  )

  const citedChunkIds = Array.isArray(obj.citedChunkIds)
    ? obj.citedChunkIds
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 50)
    : []

  const confidenceNumber = Number(obj.confidence ?? 0)
  const confidence = Number.isFinite(confidenceNumber)
    ? Math.max(0, Math.min(1, confidenceNumber))
    : 0

  return {
    closingAt: normalizeNullableString(obj.closingAt, 40),
    briefingAt: normalizeNullableString(obj.briefingAt, 40),
    siteVisitAt: normalizeNullableString(obj.siteVisitAt, 40),
    contactName:
      normalizeNullableString(obj.contactName, 120) ??
      fallbackPrimary?.name ??
      null,
    contactEmail: normalizeEmail(obj.contactEmail) ?? fallbackPrimary?.email ?? null,
    contactPhone: normalizePhone(obj.contactPhone) ?? fallbackPrimary?.phone ?? null,
    enquiryContacts,
    confidence,
    citedChunkIds,
  } satisfies DeadlineExtraction
}
