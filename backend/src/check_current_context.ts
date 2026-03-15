import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const messages = await prisma.message.findMany({
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      conversationId: true,
    },
  })
  if (messages.length > 0) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: messages[0].conversationId },
      select: { tenderId: true },
    })
    if (!conversation?.tenderId) {
      console.log("Recent message has no tender-linked conversation")
      return
    }
    console.log(
      "Recent message conversation tenderId:",
      conversation.tenderId,
    )
    const tender = await prisma.tender.findUnique({
      where: { id: conversation.tenderId },
    })
    console.log("Tender details:", tender)
  }
}
main().finally(() => prisma.$disconnect())
