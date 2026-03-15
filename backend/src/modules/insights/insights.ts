import { normalizeText } from "../text/chunker"

function findEmails(text: string) {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
  return Array.from(new Set(m ?? [])).slice(0, 10)
}

function findPhones(text: string) {
  const m = text.match(/(\+27|0)\s?\d{2}\s?\d{3}\s?\d{4}/g)
  return Array.from(new Set(m ?? [])).slice(0, 10)
}

function findDates(text: string) {
  const m = text.match(
    /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/gi,
  )
  return Array.from(new Set(m ?? [])).slice(0, 20)
}

function findMoney(text: string) {
  const m = text.match(/\b(R|ZAR)\s?[\d,]+(\.\d{2})?\b/g)
  return Array.from(new Set(m ?? [])).slice(0, 20)
}

export function buildBaselineInsights(raw: string) {
  const text = normalizeText(raw)
  const lower = text.toLowerCase()

  const keywords = [
    "closing date",
    "submission",
    "briefing",
    "compulsory briefing",
    "evaluation",
    "scope",
    "terms and conditions",
    "minimum requirements",
    "eligibility",
    "bid number",
    "rfp",
    "tender",
  ]
    .filter((k) => lower.includes(k))
    .slice(0, 20)

  return {
    contacts: {
      emails: findEmails(text),
      phones: findPhones(text),
    },
    hints: {
      dates: findDates(text),
      money: findMoney(text),
      keywords,
    },
  }
}
