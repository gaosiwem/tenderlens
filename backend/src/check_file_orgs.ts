import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const ids = [
    "75b7d92d-22ed-4064-b2e3-7d5bdf25f49a",
    "2e07cc8c-ab92-4cd5-a2a4-512ac6c27510",
    "b8a8e23a-a2bb-48fe-a37a-2bb4584634ac",
  ]
  for (const id of ids) {
    const f = await prisma.tenderFile.findUnique({
      where: { id },
      select: { id: true, orgId: true, originalFilename: true },
    })
    console.log(`File ${id} (${f?.originalFilename}): orgId = ${f?.orgId}`)
  }
}
main().finally(() => prisma.$disconnect())
