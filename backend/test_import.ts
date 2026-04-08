import { PrismaClient } from '@prisma/client';
import { importETenders } from './src/modules/tenders/tender.service';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found");

  console.log("Running scraper for 2 tenders...");
  await importETenders({
    userId: user.id, 
    status: 1,
    limit: 2,
    stopOnExisting: false,
    onProgress: (p: any) => {
       console.log(`Import batch finished`);
    }
  });
  
  // Just find the most recently scraped tender that isn't empty
  const t = await prisma.tender.findFirst({ 
    where: { 
      status: 'DRAFT',
      documents: { not: null }
    },
    orderBy: { lastScrapedAt: 'desc' }
  });
  
  if (t && t.documents) {
    console.log(`[Tender ${t.source}] - found ${Array.isArray(t.documents) ? t.documents.length : 'unknown'} documents`);
    console.log("Example docs:", JSON.stringify(t.documents, null, 2));
  } else {
    console.log("No tender found with documents");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
