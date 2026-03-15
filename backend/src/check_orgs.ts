import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const tenderId = "2f6f65eb-6c12-42f7-a808-adb51c7b5a00"
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    select: { orgId: true },
  })
  const fileOrgs = await prisma.tenderFile.findMany({
    where: { tenderId },
    select: { orgId: true },
    distinct: ["orgId"],
  })
  const chunkOrgs = await prisma.tenderChunk.findMany({
    where: { tenderId },
    select: { orgId: true },
    distinct: ["orgId"],
  })

  console.log(`Tender ${tenderId}:`)
  console.log(`- Tender orgId: ${tender?.orgId}`)
  console.log(`- File orgIds: ${fileOrgs.map((o) => o.orgId).join(", ")}`)
  console.log(`- Chunk orgIds: ${chunkOrgs.map((o) => o.orgId).join(", ")}`)
}
main().finally(() => prisma.$disconnect())
