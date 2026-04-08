
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tender = await prisma.tender.findFirst({
    where: {
      documents: {
        not: null
      }
    },
    select: {
      id: true,
      title: true,
      documents: true
    }
  })

  console.log(JSON.stringify(tender, null, 2))
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
