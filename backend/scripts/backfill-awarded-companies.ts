import { prisma } from "../src/db/prisma"

type ETenderAward = {
  company?: string | null
  tenderAmount?: string | null
}

type ETenderAwardedRow = {
  id: number
  bidders?: string | null
  organ_of_State?: string | null
  tenderAmount?: string | null
  awardedTo?: string | null
  awarded_To?: string | null
  awardedCompany?: string | null
  awarded_Company?: string | null
  successfulBidder?: string | null
  successful_Bidder?: string | null
  company?: ETenderAward[] | ETenderAward | null
  awards?: ETenderAward[] | ETenderAward | null
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

function awardEntries(value: ETenderAwardedRow["awards"] | ETenderAwardedRow["company"]) {
  if (Array.isArray(value)) return value
  if (value && typeof value === "object") return [value]
  return []
}

function extractAwardedCompany(row: ETenderAwardedRow) {
  const candidates: string[] = []

  const awardRelated = [
    ...awardEntries(row.awards).map((a) => a?.company),
    ...awardEntries(row.company).map((a) => a?.company),
    row.awardedTo,
    row.awarded_To,
    row.awardedCompany,
    row.awarded_Company,
    row.successfulBidder,
    row.successful_Bidder,
  ]

  for (const value of awardRelated) {
    const cleaned = (value ?? "").trim()
    if (!cleaned) continue
    if (cleaned.includes(",")) {
      candidates.push(...cleaned.split(",").map((s) => s.trim()))
    } else {
      candidates.push(cleaned)
    }
  }

  if (candidates.length === 0) {
    const bidders = (row.bidders ?? "").trim()
    if (bidders) {
      if (bidders.includes(",")) {
        candidates.push(...bidders.split(",").map((s) => s.trim()))
      } else {
        candidates.push(bidders)
      }
    }
  }

  const unique = Array.from(
    new Map(
      candidates
        .map((c) => normalizeCompany(c))
        .filter((c): c is string => Boolean(c))
        .map((company) => [company.toLowerCase(), company]),
    ).values(),
  )

  return unique.length > 0 ? unique.sort().join(", ") : null
}

function extractAmount(row: ETenderAwardedRow) {
  const direct = normalizeCompany(row.tenderAmount)
  if (direct) return direct

  for (const award of awardEntries(row.awards)) {
    const amount = normalizeCompany(award.tenderAmount)
    if (amount) return amount
  }

  for (const award of awardEntries(row.company)) {
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
      const procuringEntityName = normalizeCompany(row.organ_of_State)
      const amount = extractAmount(row)

      const result = await prisma.tender.updateMany({
        where: {
          externalId: row.id,
          scrapedStatus: { contains: "award", mode: "insensitive" },
        },
        data: {
          companyName,
          bidders: row.bidders ?? null,
          ...(procuringEntityName ? { procuringEntityName } : {}),
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
