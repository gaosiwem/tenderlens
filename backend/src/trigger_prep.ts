import { prepareTenderContextForChat } from "./modules/chat/chat.service"
import { prisma } from "./db/prisma"

async function main() {
  const orgId = "5d16d134-c0b7-4926-a4c6-2e6a50715b78"
  const tenderId = "2f6f65eb-6c12-42f7-a808-adb51c7b5a00"

  console.log(
    `Triggering prepareTenderContextForChat for org ${orgId}, tender ${tenderId}...`,
  )
  const result = await prepareTenderContextForChat({
    orgId,
    tenderId,
    includeExternalDocs: true,
  })
  console.log("Result:", result)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
