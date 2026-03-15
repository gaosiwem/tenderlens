import { prisma } from "../../db/prisma"
import { AppError } from "../../utils/responses"

export type RetrievedChunk = {
  id: string
  tenderId: string
  tenderFileId: string
  index: number
  content: string
  score: number
}

type RetrievalScope = "org" | "global"

function extractSearchTerms(question: string) {
  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
  return Array.from(new Set(terms)).slice(0, 8)
}

function scoreByKeyword(content: string, terms: string[]) {
  if (terms.length === 0) return 0
  const lower = content.toLowerCase()
  let hits = 0
  for (const term of terms) {
    if (lower.includes(term)) hits += 1
  }
  return hits / terms.length
}

export async function retrieveTopChunks(args: {
  orgId: string
  queryVector: number[]
  limit: number
  tenderId?: string
  scope?: RetrievalScope
}) {
  const { orgId, queryVector, limit, tenderId, scope = "org" } = args
  if (!queryVector.length)
    throw new AppError(
      "EMBEDDINGS_DISABLED",
      "Query embeddings unavailable",
      400,
    )

  // Postgres array literal for vector
  const vectorStr = `[${queryVector.join(",")}]`

  const isGlobalTenderScope = Boolean(tenderId && scope === "global")
  const params: any[] = isGlobalTenderScope
    ? [vectorStr, tenderId, limit]
    : tenderId
      ? [vectorStr, orgId, tenderId, limit]
      : [vectorStr, orgId, limit]

  const sql = isGlobalTenderScope
    ? `
      SELECT
        c.id,
        c."tenderId",
        c."tenderFileId",
        c.index,
        c.content,
        1 - (c.embedding <=> $1::vector) AS score
      FROM "TenderChunk" c
      WHERE c.embedding IS NOT NULL
        AND c."tenderId" = $2
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $3
    `
    : tenderId
      ? `
      SELECT
        c.id,
        c."tenderId",
        c."tenderFileId",
        c.index,
        c.content,
        1 - (c.embedding <=> $1::vector) AS score
      FROM "TenderChunk" c
      WHERE c."orgId" = $2
        AND c.embedding IS NOT NULL
        AND c."tenderId" = $3
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $4
    `
      : `
      SELECT
        c.id,
        c."tenderId",
        c."tenderFileId",
        c.index,
        c.content,
        1 - (c.embedding <=> $1::vector) AS score
      FROM "TenderChunk" c
      WHERE c."orgId" = $2
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $3
    `

  const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params)

  const seen = new Set<string>()
  const out: RetrievedChunk[] = []
  for (const r of rows) {
    const key = `${r.tenderFileId}:${r.index}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: r.id,
      tenderId: r.tenderId,
      tenderFileId: r.tenderFileId,
      index: r.index,
      content: r.content,
      score: Number(r.score ?? 0),
    })
  }

  return out
}

export async function retrieveTopChunksFallback(args: {
  orgId: string
  question: string
  limit: number
  tenderId?: string
  scope?: RetrievalScope
}) {
  const { orgId, question, limit, tenderId, scope = "org" } = args
  const terms = extractSearchTerms(question)
  const whereBase = tenderId
    ? scope === "global"
      ? { tenderId }
      : { orgId, tenderId }
    : { orgId }
  const take = Math.max(limit * 5, limit)

  const keywordRows =
    terms.length > 0
      ? await prisma.tenderChunk.findMany({
          where: {
            ...whereBase,
            OR: terms.map((term) => ({
              content: { contains: term, mode: "insensitive" as const },
            })),
          },
          select: {
            id: true,
            tenderId: true,
            tenderFileId: true,
            index: true,
            content: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take,
        })
      : []

  const rows =
    keywordRows.length > 0
      ? keywordRows
      : await prisma.tenderChunk.findMany({
          where: whereBase,
          select: {
            id: true,
            tenderId: true,
            tenderFileId: true,
            index: true,
            content: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take,
        })

  const ranked = rows
    .map((r) => ({
      id: r.id,
      tenderId: r.tenderId,
      tenderFileId: r.tenderFileId,
      index: r.index,
      content: r.content,
      score: scoreByKeyword(r.content, terms),
      createdAtMs: r.createdAt.getTime(),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.createdAtMs !== a.createdAtMs) return b.createdAtMs - a.createdAtMs
      return a.index - b.index
    })
    .slice(0, limit)

  return ranked.map((r) => ({
    id: r.id,
    tenderId: r.tenderId,
    tenderFileId: r.tenderFileId,
    index: r.index,
    content: r.content,
    score: r.score,
  })) satisfies RetrievedChunk[]
}

export async function retrieveHybridChunks(args: {
  orgId: string
  queryVector: number[]
  question: string
  limit: number
  tenderId?: string
  scope?: RetrievalScope
}) {
  const [vectorResults, keywordResults] = await Promise.all([
    retrieveTopChunks({
      orgId: args.orgId,
      queryVector: args.queryVector,
      limit: args.limit,
      tenderId: args.tenderId,
      scope: args.scope,
    }),
    retrieveTopChunksFallback({
      orgId: args.orgId,
      question: args.question,
      limit: args.limit,
      tenderId: args.tenderId,
      scope: args.scope,
    }),
  ])

  const seen = new Set<string>()
  const combined: RetrievedChunk[] = []

  // Split the limit to ensure both types get a fair representation
  const vectorQuota = Math.floor(args.limit * 0.6)

  // 1. Fill some of the limit with top vector results
  for (const res of vectorResults.slice(0, vectorQuota)) {
    const key = `${res.tenderFileId}:${res.index}`
    if (!seen.has(key)) {
      seen.add(key)
      combined.push(res)
    }
  }

  // 2. Add as many keyword results as fit in the remaining limit
  for (const res of keywordResults) {
    if (combined.length >= args.limit) break
    const key = `${res.tenderFileId}:${res.index}`
    if (!seen.has(key)) {
      seen.add(key)
      combined.push(res)
    }
  }

  // 3. If there's still space, pull in more vector results
  for (const res of vectorResults) {
    if (combined.length >= args.limit) break
    const key = `${res.tenderFileId}:${res.index}`
    if (!seen.has(key)) {
      seen.add(key)
      combined.push(res)
    }
  }

  return combined
}
