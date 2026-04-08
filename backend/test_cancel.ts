import { PrismaClient } from '@prisma/client';
import { importETenders } from './src/modules/tenders/tender.service';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found");

  console.log("Running scraper for 2 cancelled tenders...");
  const out = await importETenders({
    userId: user.id, 
    status: 4, // Cancelled
    limit: 2,
    stopOnExisting: false,
    onProgress: (p: any) => {
       console.log(`Import progress...`);
    }
  });
  
  console.log(out);
}

main().catch(console.error).finally(() => prisma.$disconnect());
