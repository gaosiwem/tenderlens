import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Find the PDF file that has 0 chunks
  const pdfFile = await prisma.tenderFile.findFirst({
    where: { mimeType: "application/pdf" },
  })
  if (!pdfFile) {
    console.log("No PDF file found")
    return
  }
  console.log(
    "PDF file:",
    pdfFile.id,
    pdfFile.originalFilename,
    pdfFile.storageKey,
  )
  console.log("Mime type:", pdfFile.mimeType)

  // Check existing chunks for this file
  const existingChunks = await prisma.tenderChunk.count({
    where: { tenderFileId: pdfFile.id },
  })
  console.log(`Existing chunks for this file: ${existingChunks}`)

  // Check existing extract for this file
  const existingExtract = await prisma.tenderExtract.findFirst({
    where: { tenderFileId: pdfFile.id },
    select: { id: true, text: true },
  })
  console.log(
    `Existing extract: ${existingExtract ? `${existingExtract.id} (${existingExtract.text?.length ?? 0} chars)` : "NONE"}`,
  )

  // Step 1: Download from storage
  console.log("\n--- Step 1: Download from storage ---")
  const { storage } = await import("./modules/storage/storage")
  let buf: Buffer
  try {
    buf = await storage().getObject({ key: pdfFile.storageKey })
    console.log(`Downloaded ${buf.length} bytes`)
    console.log(
      `First 10 bytes (ascii):`,
      buf.subarray(0, 10).toString("ascii"),
    )
    const isPdf = buf.subarray(0, 5).toString("ascii") === "%PDF-"
    console.log(`Starts with %PDF-: ${isPdf}`)
  } catch (e: any) {
    console.error(`Download failed: ${e.message}`)
    return
  }

  // Step 2: Check looksLikeHtml
  console.log("\n--- Step 2: looksLikeHtml check ---")
  const first1k = buf.subarray(0, 1024).toString("utf-8")
  const htmlPatterns = [/<html/i, /<head/i, /<body/i, /<!DOCTYPE/i]
  const looksHtml = htmlPatterns.some((p) => p.test(first1k))
  console.log(`Looks like HTML: ${looksHtml}`)

  // Step 3: Try PDF extraction
  console.log("\n--- Step 3: PDF extraction ---")
  try {
    const { PDFParse } = require("pdf-parse")
    console.log("PDFParse type:", typeof PDFParse)
    const parser = new PDFParse({ data: buf })
    console.log("Parser created, calling getText()...")
    const out = await parser.getText()
    console.log(`Extraction complete!`)
    console.log(`Text length: ${out.text?.length ?? 0}`)
    console.log(`Total pages: ${out.total}`)
    console.log(`Pages array length: ${out.pages?.length ?? 0}`)
    if (out.text && out.text.length > 0) {
      console.log(`\nFirst 500 chars:\n${out.text.substring(0, 500)}`)
    } else {
      console.log("WARNING: Extracted text is empty!")
    }
  } catch (e: any) {
    console.error(`PDF extraction failed: ${e.message}`)
    console.error(e.stack)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
