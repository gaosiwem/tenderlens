import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const allTenders = await prisma.tender.count()
  const scrapedTenders = await prisma.tender.count({
    where: { externalId: { not: null } },
  })
  const userCount = await prisma.user.count()
  const globalTenders = await prisma.tender.count({
    where: { orgId: null },
  })
  const privateTenders = await prisma.tender.count({
    where: { orgId: { not: null } },
  })

  console.log({
    allTenders,
    scrapedTenders,
    userCount,
    globalTenders,
    privateTenders,
  })

  if (allTenders > 0) {
    const samples = await prisma.tender.findMany({
      take: 5,
      select: {
        id: true,
        title: true,
        orgId: true,
        source: true,
      },
    })
    console.log("Sample Tenders:", samples)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
