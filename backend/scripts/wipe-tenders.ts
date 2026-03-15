import { prisma } from "../src/db/prisma"

async function main() {
  console.log("Starting full tender data wipe...")

  // We delete the parent Tender records.
  // Most relations have onDelete: Cascade in the schema, which will clean up:
  // TenderFile, ProcessingJob, TenderExtract, TenderChunk, TenderInsight,
  // TenderSummary, WatchlistItem, TenderDeadline, TenderChangeLog,
  // TenderReminder, TenderComparison, BidChecklist, BidWorkspace.

  const result = await prisma.tender.deleteMany({})

  console.log(
    `Successfully deleted ${result.count} tender records and all cascading related data.`,
  )
}

main()
  .catch((e) => {
    console.error("Wipe failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
