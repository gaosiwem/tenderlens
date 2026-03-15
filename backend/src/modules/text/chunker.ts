import crypto from "crypto"
import { env } from "../../config/env"

export type Chunk = {
  index: number
  content: string
  contentHash: string
  tokenCount?: number
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex")
}

export function normalizeText(input: string) {
  return (input ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function chunkText(
  text: string,
  chunkSize = env.CHUNK_SIZE,
  overlap = env.CHUNK_OVERLAP,
): Chunk[] {
  const t = normalizeText(text)
  if (!t) return []

  const chunks: Chunk[] = []
  let start = 0
  let i = 0

  while (start < t.length) {
    const end = Math.min(t.length, start + chunkSize)
    const slice = t.slice(start, end).trim()
    if (slice) {
      chunks.push({ index: i, content: slice, contentHash: sha256(slice) })
      i += 1
    }
    if (end === t.length) break
    start = Math.max(0, end - overlap)
  }

  return chunks
}
