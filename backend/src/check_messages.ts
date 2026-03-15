import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const messages = await prisma.message.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { conversationId: true, role: true, content: true, orgId: true },
  })
  console.log("Recent messages:", messages)
}
main().finally(() => prisma.$disconnect())
