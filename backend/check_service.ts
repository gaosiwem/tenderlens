import { getExternalDocumentsForTender } from './src/modules/tenders/tender.service';

const tenderId = "1fc1a68f-bcff-4f66-9bc4-404cffcb4337"; // From earlier stdout output

async function main() {
  const docs = await getExternalDocumentsForTender({ tenderId });
  console.log("EXTERNAL DOCS RETURNED BY SERVICE:");
  console.log(JSON.stringify(docs, null, 2));
}

main().catch(console.error);
