import {
  listTemplates,
  applyTemplate,
} from "./modules/watchlist/templates.service"
import { prisma } from "./db/prisma"

async function main() {
  const templates = await listTemplates()
  console.log("Templates:", JSON.stringify(templates, null, 2))

  if (templates.length > 0) {
    const org = await prisma.organization.findFirst()
    const user = await prisma.user.findFirst()

    if (org && user) {
      console.log(
        `Applying template ${templates[0].id} to user ${user.id} in org ${org.id}`,
      )
      const res = await applyTemplate({
        orgId: org.id,
        userId: user.id,
        templateId: templates[0].id,
      })
      console.log("Apply Result:", JSON.stringify(res, null, 2))
    }
  }
}

main().catch(console.error)
