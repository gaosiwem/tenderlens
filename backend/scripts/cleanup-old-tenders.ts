import { prisma } from "../src/db/prisma"

async function main() {
  console.log("Starting periodic tender retention cleanup...")

  // 1. Fetch retention settings
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "singleton" },
  })

  if (!settings) {
    console.log("SystemSettings not found. Skipping cleanup.")
    return
  }

  const retentionDays = settings.retentionDays
  console.log(`Retention policy: ${retentionDays} days after closing date.`)

  // 2. Calculate threshold
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - retentionDays)

  console.log(
    `Deleting tenders that closed before ${thresholdDate.toISOString()}...`,
  )

  // 3. Find and delete
  // Note: We join with TenderDeadline to check closingAt
  const expiredTenders = await prisma.tender.findMany({
    where: {
      deadline: {
        closingAt: {
          lt: thresholdDate,
        },
      },
    },
    select: { id: true, title: true },
  })

  if (expiredTenders.length === 0) {
    console.log("No expired tenders found to delete.")
    return
  }

  console.log(`Found ${expiredTenders.length} expired tenders. Deleting...`)

  const deletedIds = expiredTenders.map((t) => t.id)
  const result = await prisma.tender.deleteMany({
    where: {
      id: { in: deletedIds },
    },
  })

  console.log(`Successfully deleted ${result.count} expired tenders.`)
}

main()
  .catch((e) => {
    console.error("Cleanup failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
