import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("Enabling vector extension...")
  try {
    await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector;")
    console.log("Extension enabled successfully.")
  } catch (e) {
    console.error("Failed to enable extension:", e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
