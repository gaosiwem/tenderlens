import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const tenderId = "2f6f65eb-6c12-42f7-a808-adb51c7b5a00"
  const files = await prisma.tenderFile.findMany({
    where: { tenderId },
    select: { id: true, originalFilename: true },
  })
  console.log(`Tender ${tenderId} has ${files.length} files:`)
  for (const f of files) {
    const count = await prisma.tenderChunk.count({
      where: { tenderFileId: f.id },
    })
    console.log(`- ${f.originalFilename} (id: ${f.id}): ${count} chunks`)
  }
}
main().finally(() => prisma.$disconnect())
