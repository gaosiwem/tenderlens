import { PrismaClient } from '@prisma/client'
import { getExternalDocumentsForTender } from './src/modules/tenders/tender.service';

const prisma = new PrismaClient()

// I'll just write a quick mock that uses the underlying regex/parsing from tender.service
// to see if the docs are correctly parsed
async function main() {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT "documents" FROM "Tender" WHERE "id" = '1fc1a68f-bcff-4f66-9bc4-404cffcb4337'
  `;
  const tender = rows[0];
  console.log("Raw documents from DB:", JSON.stringify(tender?.documents, null, 2));

  // The code that parses it is in tender.service.ts, let's see what happens if we import and use it
  // Wait, the parsePersistedExternalDocuments is not exported. I'll just copy it here to test.
  
  function decodeDownloadedFileNameFromPath(pathValue: string) {
    try {
      const url = new URL(pathValue)
      return (url.searchParams.get("downloadedFileName") ?? "").trim()
    } catch {
      return ""
    }
  }

  function normalizeExternalDocumentName(args: {
    id: string
    name: string
    path: string
  }) {
    const direct = (args.name ?? "").trim()
    const fromPath = decodeDownloadedFileNameFromPath(args.path)

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    function looksLikeOpaqueId(name: string) {
      const t = (name ?? "").trim()
      if (!t) return false
      const noExt = t.replace(/\.[A-Za-z0-9]{1,6}$/, "")
      return UUID_RE.test(noExt) || /^[0-9a-f]{24,}$/i.test(noExt)
    }

    if (direct && !looksLikeOpaqueId(direct)) return direct
    if (fromPath && !looksLikeOpaqueId(fromPath)) return fromPath
    if (direct) return direct
    return `External document ${args.id}`
  }

  function parsePersisted(value: unknown) {
    if (!Array.isArray(value)) return []
    return value.map(entry => {
      if (!entry || typeof entry !== "object") return null
      const doc = entry as any;
      if (typeof doc.id !== "string" || typeof doc.name !== "string" || typeof doc.path !== "string") return null;
      return {
        id: doc.id,
        name: normalizeExternalDocumentName({ id: doc.id, name: doc.name, path: doc.path }),
        path: doc.path
      }
    }).filter(x => x !== null)
  }

  console.log("Parsed documents:", JSON.stringify(parsePersisted(tender?.documents), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
