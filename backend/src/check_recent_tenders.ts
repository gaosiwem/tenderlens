import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const tenders = await prisma.tender.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, status: true, createdAt: true },
  })
  console.log("Recent tenders:", tenders)
}
main().finally(() => prisma.$disconnect())
