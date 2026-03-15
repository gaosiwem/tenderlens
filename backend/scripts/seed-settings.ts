import { prisma } from "../src/db/prisma"

async function main() {
  console.log("Seeding initial SystemSettings...")

  const settings = await prisma.systemSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      retentionDays: 30,
      hideClosedTenders: true,
    },
  })

  console.log("SystemSettings ready:", settings)
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
