
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tenders = await prisma.tender.findMany({
    where: {
      documents: {
        not: Prisma.JsonNull
      }
    },
    select: {
      id: true,
      title: true,
      documents: true
    },
    take: 100
  })

  const withMany = tenders.filter(t => Array.isArray(t.documents) && t.documents.length > 1)

  console.log('TENDERS_WITH_MANY_START')
  console.log(JSON.stringify(withMany, null, 2))
  console.log('TENDERS_WITH_MANY_END')

  if (withMany.length === 0) {
    console.log('No tenders found with > 1 document in Top 100')
    const any = tenders[0]
    console.log('Sample tender documents:', JSON.stringify(any?.documents, null, 2))
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
