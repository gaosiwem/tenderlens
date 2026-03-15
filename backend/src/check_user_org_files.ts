import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const orgId = "88bd3134-6093-4d9c-8bba-a33ae7cf91f6"
  const tenderId = "2f6f65eb-6c12-42f7-a808-adb51c7b5a00"
  const files = await prisma.tenderFile.findMany({ where: { orgId, tenderId } })
  console.log(`Org ${orgId} has ${files.length} files for tender ${tenderId}`)
}
main().finally(() => prisma.$disconnect())
