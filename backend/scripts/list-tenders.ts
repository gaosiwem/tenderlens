import { prisma } from "../src/db/prisma"

async function main() {
  const result = await prisma.tender.groupBy({
    by: ["createdByUserId"],
    _count: {
      id: true,
    },
  })

  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
