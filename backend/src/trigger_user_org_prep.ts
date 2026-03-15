import { prepareTenderContextForChat } from "./modules/chat/chat.service"
import { prisma } from "./db/prisma"

async function main() {
  const orgId = "88bd3134-6093-4d9c-8bba-a33ae7cf91f6"
  const tenderId = "2f6f65eb-6c12-42f7-a808-adb51c7b5a00"

  console.log(
    `Triggering prepareTenderContextForChat for user org ${orgId}, tender ${tenderId}...`,
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
