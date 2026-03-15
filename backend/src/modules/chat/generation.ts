import OpenAI from "openai"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"
import type { RetrievedChunk } from "./retrieval"
import { logger } from "../../utils/logger"

type AIProvider = "openai" | "gemini"

function client() {
  if (!env.OPENAI_API_KEY)
    throw new AppError("CONFIG_ERROR", "OPENAI_API_KEY missing", 500)
  return new OpenAI({ apiKey: env.OPENAI_API_KEY })
}

function aiProvider() {
  return env.AI_PROVIDER === "gemini" ? "gemini" : "openai"
}

function providerFallbackOrder(): AIProvider[] {
  const primary = aiProvider()
  return primary === "gemini"
    ? ["gemini", "openai"]
    : ["openai", "gemini"]
}

function hasProviderCredentials(provider: AIProvider) {
  return provider === "gemini"
    ? Boolean(env.GEMINI_API_KEY)
    : Boolean(env.OPENAI_API_KEY)
}

function geminiModel() {
  return env.GEMINI_CHAT_MODEL || "gemini-1.5-flash"
}

function openAiModel() {
  return env.OPENAI_CHAT_MODEL
}

function trimContext(chunks: RetrievedChunk[], maxChars: number) {
  const parts: string[] = []
  let used = 0
  for (const c of chunks) {
    const block = `\n\n[chunk:${c.id} tender:${c.tenderId} file:${c.tenderFileId} idx:${c.index}]\n${c.content}\n`
    if (used + block.length > maxChars) break
    parts.push(block)
    used += block.length
  }
  return parts.join("")
}

export type ChatAnswer = {
  answer: string
  citations: Array<{
    chunkId: string
    tenderId: string
    tenderFileId: string
    index: number
    score: number
  }>
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

function buildSystemPrompt() {
  return [
    "You are TenderLens Assistant.",
    "Answer ONLY using the provided chunks.",
    "If the exact answer is not explicit, do NOT stop at 'cannot find it'.",
    "Instead, explain what the tender documents do say that is closest to the question.",
    "If an exact value is missing, say that it is not explicitly stated and share the closest relevant information.",
    "Return a concise, direct answer to the question. Do NOT include a document summary unless the user explicitly asks for one.",
    "Use complete sentences and complete bullet points.",
    "Do not end the answer with a trailing comma or colon.",
    "Do not include citations, chunk IDs, source lists, or raw retrieval metadata in the response.",
    "Never invent deadlines, prices, or requirements.",
    "Stay professional and concise.",
  ].join("\n")
}

function buildUserPrompt(args: { question: string; ctx: string }) {
  const base = `Question:\n${args.question}\n\nTender chunks:\n${args.ctx}\n`
  if (!isRequirementsQuestion(args.question)) return base

  return [
    base,
    "Additional instructions for this question:",
    "- The user is asking for requirements.",
    "- Return a complete requirements checklist with clear bullet points.",
    "- Cover: mandatory documents/forms, eligibility/compliance, submission method/deadline, and core deliverables.",
    "- If a category is not explicit in the chunks, state: Not explicitly stated in the provided chunks.",
    "- Do not stop after one bullet when more requirement details exist in the chunks.",
    "- Ensure every bullet is a complete sentence.",
  ].join("\n")
}

function isRequirementsQuestion(question: string) {
  const q = (question ?? "").toLowerCase()
  return (
    q.includes("requirement") ||
    q.includes("mandatory") ||
    q.includes("eligib") ||
    q.includes("qualif") ||
    q.includes("compliance") ||
    q.includes("submission")
  )
}

function countListItems(text: string) {
  return (text.match(/^\s*(?:[-*]|\d+\.)\s+/gm) ?? []).length
}

function needsRequirementsExpansion(question: string, raw: string) {
  if (!isRequirementsQuestion(question)) return false
  const text = (raw ?? "").trim()
  if (!text) return true
  if (text.length < 220) return true
  if (countListItems(text) < 2) return true
  return false
}

function buildRequirementsExpansionPrompt(args: {
  question: string
  ctx: string
  draftAnswer: string
}) {
  return [
    `Question:\n${args.question}`,
    "",
    `Tender chunks:\n${args.ctx}`,
    "",
    "Current draft answer:",
    args.draftAnswer || "(empty)",
    "",
    "Rewrite the answer as a complete requirement checklist.",
    "Use 4-8 bullet points if the chunks support that many.",
    "Each bullet must be a full sentence, not a fragment.",
    "Include mandatory documents/forms, eligibility/compliance, submission method/deadline, and deliverables when present.",
    "If specific data is absent, explicitly say it is not stated in the provided chunks.",
    "Do not end mid-sentence.",
  ].join("\n")
}

function normalizeRequirementSentence(input: string) {
  const cleaned = input
    .replace(/\s+/g, " ")
    .replace(/^[\-*•\u2022]+\s*/, "")
    .trim()
  if (!cleaned) return ""
  if (cleaned.length < 28) return ""
  if (cleaned.length > 320) return ""
  const tailSafe = cleaned.replace(/[,:;\-\u2013\u2014]+$/g, "").trim()
  if (!tailSafe) return ""
  if (/[.!?)]$/.test(tailSafe)) return tailSafe
  return `${tailSafe}.`
}

function buildRequirementsFallbackFromChunks(chunks: RetrievedChunk[]) {
  const keywords = [
    "required",
    "must",
    "shall",
    "submission",
    "submit",
    "tenderer is required",
    "form of offer",
    "returnable",
    "certificate",
    "tax",
    "pin",
    "b-bbee",
    "closing time",
    "deadline",
    "validity period",
  ]

  const out: string[] = []
  const seen = new Set<string>()

  for (const chunk of chunks) {
    const parts = chunk.content.split(/(?<=[.!?])\s+|\n+/)
    for (const part of parts) {
      const lower = part.toLowerCase()
      if (!keywords.some((k) => lower.includes(k))) continue
      const sentence = normalizeRequirementSentence(part)
      if (!sentence) continue
      const key = sentence.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(sentence)
      if (out.length >= 8) break
    }
    if (out.length >= 8) break
  }

  if (out.length < 2) return ""
  return [
    "The requirements stated in the provided tender chunks include:",
    "",
    ...out.map((line) => `- ${line}`),
  ].join("\n")
}

function cleanAnswerText(raw: string) {
  const text = (raw ?? "").trim()
  if (!text) return text

  const withoutTrailing = text.replace(/[,:;\-\u2013\u2014]+\s*$/g, "").trim()
  if (!withoutTrailing) return text

  const end = withoutTrailing.slice(-1)
  if (/[.!?)]/.test(end)) return withoutTrailing
  return `${withoutTrailing}.`
}

function looksIncomplete(raw: string) {
  const text = (raw ?? "").trim()
  if (!text) return true
  if (/[,:;\-\u2013\u2014]\s*$/.test(text)) return true
  const withoutTerminalPunctuation = text.replace(/[.!?]+$/g, "").trim()
  if (
    /\b(of|and|for|to|with|including|the|a|an)\s*$/i.test(
      withoutTerminalPunctuation,
    )
  ) {
    return true
  }
  const boldMarkerCount = (text.match(/\*\*/g) ?? []).length
  if (boldMarkerCount % 2 !== 0) return true
  return false
}

function buildRepairPrompt(args: {
  question: string
  ctx: string
  draftAnswer: string
}) {
  return [
    `Question:\n${args.question}`,
    "",
    `Tender chunks:\n${args.ctx}`,
    "",
    "Draft answer (incomplete):",
    args.draftAnswer || "(empty)",
    "",
    "Rewrite a complete final answer using full sentences.",
    "If data is partial, explicitly say it is not fully stated.",
    "Do not end mid-sentence, and do not end with trailing connectors.",
  ].join("\n")
}

async function generateWithOpenAI(args: {
  question: string
  chunks: RetrievedChunk[]
}): Promise<ChatAnswer> {
  const ctx = trimContext(args.chunks, env.CHAT_MAX_CONTEXT_CHARS)
  const system = buildSystemPrompt()
  const user = buildUserPrompt({ question: args.question, ctx })
  const runOpenAI = async (userPrompt: string) =>
    client().chat.completions.create({
      model: openAiModel(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      max_tokens: env.CHAT_MAX_OUTPUT_TOKENS,
      temperature: 0.2,
    })

  let out = await runOpenAI(user)
  let rawText = out.choices[0]?.message?.content ?? ""
  if (looksIncomplete(rawText)) {
    const completionHint =
      `${user}\n\nIMPORTANT: Your previous response was cut off. ` +
      "Rewrite the full final answer completely and do not end mid-sentence."
    out = await runOpenAI(completionHint)
    rawText = out.choices[0]?.message?.content ?? rawText
  }
  if (looksIncomplete(rawText)) {
    const repairPrompt = buildRepairPrompt({
      question: args.question,
      ctx,
      draftAnswer: rawText,
    })
    out = await runOpenAI(repairPrompt)
    rawText = out.choices[0]?.message?.content ?? rawText
  }
  if (needsRequirementsExpansion(args.question, rawText)) {
    const expansionPrompt = buildRequirementsExpansionPrompt({
      question: args.question,
      ctx,
      draftAnswer: rawText,
    })
    out = await runOpenAI(expansionPrompt)
    rawText = out.choices[0]?.message?.content ?? rawText
  }
  if (looksIncomplete(rawText)) {
    const repairPrompt = buildRepairPrompt({
      question: args.question,
      ctx,
      draftAnswer: rawText,
    })
    out = await runOpenAI(repairPrompt)
    rawText = out.choices[0]?.message?.content ?? rawText
  }
  if (
    isRequirementsQuestion(args.question) &&
    (looksIncomplete(rawText) || needsRequirementsExpansion(args.question, rawText))
  ) {
    const deterministic = buildRequirementsFallbackFromChunks(args.chunks)
    if (deterministic) rawText = deterministic
  }
  const text = cleanAnswerText(rawText)
  const citations = args.chunks.map((c) => ({
    chunkId: c.id,
    tenderId: c.tenderId,
    tenderFileId: c.tenderFileId,
    index: c.index,
    score: c.score,
  }))

  const usage = out.usage
    ? {
        inputTokens: out.usage.prompt_tokens,
        outputTokens: out.usage.completion_tokens,
      }
    : undefined

  return { answer: text, citations, usage }
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

function readGeminiText(out: GeminiGenerateResponse) {
  return (
    out.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("") ?? ""
  )
}

async function generateWithGemini(args: {
  question: string
  chunks: RetrievedChunk[]
}): Promise<ChatAnswer> {
  if (!env.GEMINI_API_KEY) {
    throw new AppError("CONFIG_ERROR", "GEMINI_API_KEY missing", 500)
  }

  const ctx = trimContext(args.chunks, env.CHAT_MAX_CONTEXT_CHARS)
  const system = buildSystemPrompt()
  const user = buildUserPrompt({ question: args.question, ctx })
  const runGemini = async (userPrompt: string) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      geminiModel(),
    )}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: system }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: env.CHAT_MAX_OUTPUT_TOKENS,
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${body}`)
    }
    return (await res.json()) as GeminiGenerateResponse
  }

  let out = await runGemini(user)
  let rawText = readGeminiText(out)
  if (looksIncomplete(rawText)) {
    const completionHint =
      `${user}\n\nIMPORTANT: Your previous response was cut off. ` +
      "Rewrite the full final answer completely and do not end mid-sentence."
    out = await runGemini(completionHint)
    rawText = readGeminiText(out) || rawText
  }
  if (looksIncomplete(rawText)) {
    const repairPrompt = buildRepairPrompt({
      question: args.question,
      ctx,
      draftAnswer: rawText,
    })
    out = await runGemini(repairPrompt)
    rawText = readGeminiText(out) || rawText
  }
  if (needsRequirementsExpansion(args.question, rawText)) {
    const expansionPrompt = buildRequirementsExpansionPrompt({
      question: args.question,
      ctx,
      draftAnswer: rawText,
    })
    out = await runGemini(expansionPrompt)
    rawText = readGeminiText(out) || rawText
  }
  if (looksIncomplete(rawText)) {
    const repairPrompt = buildRepairPrompt({
      question: args.question,
      ctx,
      draftAnswer: rawText,
    })
    out = await runGemini(repairPrompt)
    rawText = readGeminiText(out) || rawText
  }
  if (
    isRequirementsQuestion(args.question) &&
    (looksIncomplete(rawText) || needsRequirementsExpansion(args.question, rawText))
  ) {
    const deterministic = buildRequirementsFallbackFromChunks(args.chunks)
    if (deterministic) rawText = deterministic
  }
  const text = cleanAnswerText(rawText)

  const citations = args.chunks.map((c) => ({
    chunkId: c.id,
    tenderId: c.tenderId,
    tenderFileId: c.tenderFileId,
    index: c.index,
    score: c.score,
  }))

  const usage = out.usageMetadata
    ? {
        inputTokens: out.usageMetadata.promptTokenCount ?? 0,
        outputTokens:
          out.usageMetadata.candidatesTokenCount ??
          Math.max(
            0,
            (out.usageMetadata.totalTokenCount ?? 0) -
              (out.usageMetadata.promptTokenCount ?? 0),
          ),
      }
    : undefined

  return { answer: text, citations, usage }
}

async function generateWithProvider(
  provider: AIProvider,
  args: { question: string; chunks: RetrievedChunk[] },
) {
  if (provider === "gemini") return generateWithGemini(args)
  return generateWithOpenAI(args)
}

async function* generateAnswerStreamWithGemini(args: {
  question: string
  chunks: RetrievedChunk[]
}) {
  if (!env.GEMINI_API_KEY) {
    throw new AppError("CONFIG_ERROR", "GEMINI_API_KEY missing", 500)
  }

  const ctx = trimContext(args.chunks, env.CHAT_MAX_CONTEXT_CHARS)
  const system = buildSystemPrompt()
  const user = buildUserPrompt({ question: args.question, ctx })

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    geminiModel(),
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(env.GEMINI_API_KEY)}`

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: user }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: env.CHAT_MAX_OUTPUT_TOKENS,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gemini API stream error ${res.status}: ${body}`)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    const out = await generateWithGemini(args)
    if (out.answer) yield { type: "token" as const, content: out.answer }
    if (out.usage) yield { type: "usage" as const, usage: out.usage }
    return
  }

  const decoder = new TextDecoder()
  let buffer = ""
  let emittedText = ""

  while (true) {
    const next = await reader.read()
    if (next.done) break
    buffer += decoder.decode(next.value, { stream: true })

    let split = buffer.indexOf("\n\n")
    while (split !== -1) {
      const eventBlock = buffer.slice(0, split)
      buffer = buffer.slice(split + 2)
      split = buffer.indexOf("\n\n")

      const line = eventBlock
        .split("\n")
        .map((x) => x.trim())
        .find((x) => x.startsWith("data:"))
      if (!line) continue

      const payload = line.slice(5).trim()
      if (!payload || payload === "[DONE]") continue

      let parsed: GeminiGenerateResponse
      try {
        parsed = JSON.parse(payload) as GeminiGenerateResponse
      } catch {
        continue
      }

      const currentText = readGeminiText(parsed)
      if (!currentText) continue

      if (currentText.startsWith(emittedText)) {
        const delta = currentText.slice(emittedText.length)
        if (delta) {
          emittedText = currentText
          yield { type: "token" as const, content: delta }
        }
      } else {
        emittedText = currentText
        yield { type: "token" as const, content: currentText }
      }

      if (parsed.usageMetadata) {
        const usage = {
          inputTokens: parsed.usageMetadata.promptTokenCount ?? 0,
          outputTokens:
            parsed.usageMetadata.candidatesTokenCount ??
            Math.max(
              0,
              (parsed.usageMetadata.totalTokenCount ?? 0) -
                (parsed.usageMetadata.promptTokenCount ?? 0),
            ),
        }
        yield { type: "usage" as const, usage }
      }
    }
  }
}

async function* generateAnswerStreamWithOpenAI(args: {
  question: string
  chunks: RetrievedChunk[]
}) {
  const ctx = trimContext(args.chunks, env.CHAT_MAX_CONTEXT_CHARS)
  const system = buildSystemPrompt()
  const user = buildUserPrompt({ question: args.question, ctx })

  const stream = await client().chat.completions.create({
    model: openAiModel(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: env.CHAT_MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    stream: true,
    stream_options: { include_usage: true },
  })

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || ""
    if (content) yield { type: "token" as const, content }
    if (chunk.usage) {
      yield {
        type: "usage" as const,
        usage: {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
        },
      }
    }
  }
}

function generateAnswerStreamWithProvider(
  provider: AIProvider,
  args: { question: string; chunks: RetrievedChunk[] },
) {
  return provider === "gemini"
    ? generateAnswerStreamWithGemini(args)
    : generateAnswerStreamWithOpenAI(args)
}

export async function generateAnswer(args: {
  question: string
  chunks: RetrievedChunk[]
}) {
  if (!env.CHAT_ENABLED)
    throw new AppError("CHAT_DISABLED", "Chat is disabled", 400)

  const candidates = providerFallbackOrder().filter(hasProviderCredentials)
  if (candidates.length === 0) {
    throw new AppError(
      "CONFIG_ERROR",
      "No AI provider credentials configured for chat",
      500,
    )
  }

  let lastError: unknown = null
  for (const provider of candidates) {
    try {
      return await generateWithProvider(provider, args)
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(
        `[chat] Provider ${provider} failed for generateAnswer, trying fallback if available: ${message}`,
      )
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All configured AI providers failed")
}

export async function* generateAnswerStream(args: {
  question: string
  chunks: RetrievedChunk[]
}) {
  if (!env.CHAT_ENABLED)
    throw new AppError("CHAT_DISABLED", "Chat is disabled", 400)

  const candidates = providerFallbackOrder().filter(hasProviderCredentials)
  if (candidates.length === 0) {
    throw new AppError(
      "CONFIG_ERROR",
      "No AI provider credentials configured for chat stream",
      500,
    )
  }

  let lastError: unknown = null
  for (const provider of candidates) {
    let emittedAny = false
    try {
      for await (const event of generateAnswerStreamWithProvider(provider, args)) {
        emittedAny = true
        yield event
      }
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(
        `[chat] Provider ${provider} failed for stream, trying fallback if available: ${message}`,
      )
      if (emittedAny) {
        throw error
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All configured AI providers failed for stream")
}
