import { prisma } from "../src/db/prisma"

type ETenderAward = {
  company?: string | null
  tenderAmount?: string | null
}

type ETenderAwardedRow = {
  id: number
  bidders?: string | null
  tenderAmount?: string | null
  company?: ETenderAward[] | null
  awards?: ETenderAward[] | null
}

type ETendersPayload = {
  data?: ETenderAwardedRow[]
}

function awardedFeedUrl(start: number, length: number) {
  const params = new URLSearchParams({
    draw: "2",
    start: String(start),
    length: String(length),
    "search[value]": "",
    "search[regex]": "false",
    status: "2",
    _: String(Date.now()),
  })
  return `https://www.etenders.gov.za/Home/PaginatedTenderOpportunities?${params.toString()}`
}

function normalizeCompany(value: string | null | undefined) {
  const normalized = (value ?? "").replace(/[\s\u00a0]+/g, " ").trim()
  return normalized || null
}

function extractAwardedCompany(row: ETenderAwardedRow) {
  const candidates: string[] = []

  for (const award of row.awards ?? []) {
    const company = normalizeCompany(award.company)
    if (company) candidates.push(company)
  }

  for (const award of row.company ?? []) {
    const company = normalizeCompany(award.company)
    if (company) candidates.push(company)
  }

  const bidders = normalizeCompany(row.bidders)
  if (bidders) candidates.push(bidders)

  const unique = Array.from(
    new Map(
      candidates.map((company) => [
        company.replace(/[\s\u00a0]+/g, " ").trim().toLowerCase(),
        company,
      ]),
    ).values(),
  )
  return unique.length > 0 ? unique.join(", ") : null
}

function extractAmount(row: ETenderAwardedRow) {
  const direct = normalizeCompany(row.tenderAmount)
  if (direct) return direct

  for (const award of row.awards ?? []) {
    const amount = normalizeCompany(award.tenderAmount)
    if (amount) return amount
  }

  for (const award of row.company ?? []) {
    const amount = normalizeCompany(award.tenderAmount)
    if (amount) return amount
  }

  return null
}

async function fetchAwardedRows(start: number, length: number) {
  const response = await fetch(awardedFeedUrl(start, length))
  if (!response.ok) {
    throw new Error(`eTenders request failed: ${response.status}`)
  }

  const payload = (await response.json()) as ETendersPayload
  return payload.data ?? []
}

async function main() {
  const batchSize = Number(process.env.BACKFILL_BATCH_SIZE ?? "250")
  const maxRows = Number(process.env.BACKFILL_MAX_ROWS ?? "5000")
  let scanned = 0
  let updated = 0

  for (let start = 0; start < maxRows; start += batchSize) {
    const rows = await fetchAwardedRows(start, batchSize)
    if (rows.length === 0) break

    for (const row of rows) {
      const companyName = extractAwardedCompany(row)
      if (!companyName) continue
      const amount = extractAmount(row)

      const result = await prisma.tender.updateMany({
        where: {
          externalId: row.id,
          scrapedStatus: { contains: "award", mode: "insensitive" },
        },
        data: {
          companyName,
          ...(amount ? { amount } : {}),
          updatedAt: new Date(),
        },
      })
      updated += result.count
    }

    scanned += rows.length
    console.log(`Scanned ${scanned} awarded rows, updated ${updated} tenders`)
    if (rows.length < batchSize) break
  }

  console.log(`Done. Scanned ${scanned} awarded rows, updated ${updated} tenders.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
