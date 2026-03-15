import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const tenderId = "2f6f65eb-6c12-42f7-a808-adb51c7b5a00"
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    select: { id: true, status: true, title: true },
  })
  console.log(`Tender ${tenderId}:`, tender)
}
main().finally(() => prisma.$disconnect())
