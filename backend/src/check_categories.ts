import { prisma } from "./db/prisma"

async function main() {
  const categories = await prisma.tender.findMany({
    select: { category: true },
    distinct: ["category"],
    where: { category: { not: null } },
  })
  console.log(
    "Categories found:",
    categories.map((c) => c.category),
  )
}

main().catch(console.error)
