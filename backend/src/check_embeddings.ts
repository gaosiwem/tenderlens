import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const tenderId = "2f6f65eb-6c12-42f7-a808-adb51c7b5a00"
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "TenderChunk"
    WHERE "tenderId" = ${tenderId}
      AND "embedding" IS NOT NULL
  `
  const chunksWithEmbeddings = Number(rows[0]?.count ?? 0n)
  const totalChunks = await prisma.tenderChunk.count({ where: { tenderId } })
  console.log(`Tender ${tenderId}:`)
  console.log(`- Total chunks: ${totalChunks}`)
  console.log(`- Chunks with embeddings: ${chunksWithEmbeddings}`)
}
main().finally(() => prisma.$disconnect())
