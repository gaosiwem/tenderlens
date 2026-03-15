import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const tenderId = "2f6f65eb-6c12-42f7-a808-adb51c7b5a00"
  const counts = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT 
      COUNT(*) FILTER (WHERE embedding IS NOT NULL) as "withEmbedding",
      COUNT(*) FILTER (WHERE embedding IS NULL) as "withoutEmbedding"
    FROM "TenderChunk"
    WHERE "tenderId" = $1
  `,
    tenderId,
  )
  console.log(`Tender ${tenderId}:`, counts[0])
}
main().finally(() => prisma.$disconnect())
