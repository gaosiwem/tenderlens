import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true },
  })
  console.log("Organizations:", orgs)
}
main().finally(() => prisma.$disconnect())
