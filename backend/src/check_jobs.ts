import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const tenderId = "2f6f65eb-6c12-42f7-a808-adb51c7b5a00"
  const jobs = await prisma.processingJob.findMany({
    where: { tenderId },
    orderBy: { createdAt: "desc" },
  })
  console.log(`Jobs for tender ${tenderId}:`, jobs)
}
main().finally(() => prisma.$disconnect())
