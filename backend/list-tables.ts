import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const tables = await prisma.$queryRaw`
    SELECT tablename 
    FROM pg_catalog.pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename ASC;
  `
  console.log("Database Tables:", tables)

  const scrapedTables = await prisma.$queryRaw`
    SELECT tablename 
    FROM pg_catalog.pg_tables 
    WHERE schemaname = 'public' 
    AND tablename ILIKE '%scraped%'
    ORDER BY tablename ASC;
  `
  console.log("Scraped-related Tables:", scrapedTables)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
