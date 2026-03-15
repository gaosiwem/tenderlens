import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const count = await prisma.tenderChunk.count()
  console.log("Total chunks in database:", count)
}
main().finally(() => prisma.$disconnect())
