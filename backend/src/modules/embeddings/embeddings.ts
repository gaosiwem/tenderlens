import { env } from "../../config/env"
import { AppError } from "../../utils/responses"

export type Embedding = number[]

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function embedTexts(texts: string[]): Promise<Embedding[]> {
  if (!env.ENABLE_EMBEDDINGS) return texts.map(() => [])

  if ((env.AI_PROVIDER ?? "openai") === "gemini") {
    if (!env.GEMINI_API_KEY) {
      throw new AppError("CONFIG_ERROR", "GEMINI_API_KEY missing", 500)
    }

    const model = (env.EMBEDDINGS_MODEL || "").trim() || "text-embedding-004"
    const normalizedModel = model.startsWith("models/")
      ? model
      : `models/${model}`

    const out: Embedding[] = []
    for (const text of texts) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/${encodeURIComponent(
        normalizedModel,
      )}:embedContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          taskType: "RETRIEVAL_QUERY",
        }),
      })

      if (!res.ok) {
        const body = (await res.text()).slice(0, 500)
        throw new AppError(
          "EMBEDDINGS_ERROR",
          `Gemini embeddings failed (status ${res.status}): ${body}`,
          500,
        )
      }

      const json = (await res.json()) as {
        embedding?: { values?: number[] }
      }
      out.push(json.embedding?.values ?? [])
    }

    return out
  }

  if (!env.OPENAI_API_KEY) {
    throw new AppError("CONFIG_ERROR", "OPENAI_API_KEY missing", 500)
  }

  const maxAttempts = 3
  let lastErrorBody = ""
  let lastStatus = 500

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.EMBEDDINGS_MODEL,
        input: texts,
      }),
    })

    if (res.ok) {
      const json = (await res.json()) as {
        data?: Array<{ embedding: number[] }>
      }
      const data = json.data ?? []
      return data.map((d) => d.embedding)
    }

    lastStatus = res.status
    lastErrorBody = (await res.text()).slice(0, 500)
    const transient = res.status >= 500 || res.status === 429
    if (!transient || attempt === maxAttempts) break
    await wait(attempt * 350)
  }

  throw new AppError(
    "EMBEDDINGS_ERROR",
    `Embeddings failed (status ${lastStatus}): ${lastErrorBody}`,
    500,
  )
}

export async function embedQuery(q: string): Promise<Embedding> {
  const [v] = await embedTexts([q])
  return v
}
