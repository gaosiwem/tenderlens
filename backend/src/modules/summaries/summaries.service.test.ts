import { describe, expect, it } from "vitest"
import {
  buildSummaryExtractContext,
  selectLatestExtractsPerFile,
  type SummaryLatestExtract,
} from "./summaries.service"

describe("summaries.service helpers", () => {
  it("selects the latest extract per file", () => {
    const latest = selectLatestExtractsPerFile({
      extracts: [
        {
          tenderFileId: "file-a",
          text: "newest-a",
          createdAt: new Date("2026-03-19T10:00:00.000Z"),
        },
        {
          tenderFileId: "file-b",
          text: "newest-b",
          createdAt: new Date("2026-03-19T09:00:00.000Z"),
        },
        {
          tenderFileId: "file-a",
          text: "old-a",
          createdAt: new Date("2026-03-18T09:00:00.000Z"),
        },
      ],
      fileNameById: new Map([
        ["file-a", "A.pdf"],
        ["file-b", "B.pdf"],
      ]),
    })

    expect(latest).toHaveLength(2)
    expect(latest[0].tenderFileId).toBe("file-a")
    expect(latest[0].text).toBe("newest-a")
    expect(latest[1].tenderFileId).toBe("file-b")
    expect(latest[1].fileName).toBe("B.pdf")
  })

  it("builds context with coverage across multiple files", () => {
    const extracts: SummaryLatestExtract[] = [
      {
        tenderFileId: "file-1",
        fileName: "Large.pdf",
        text: "A".repeat(15000),
        createdAt: new Date("2026-03-19T10:00:00.000Z"),
      },
      {
        tenderFileId: "file-2",
        fileName: "Small.docx",
        text: "B".repeat(900),
        createdAt: new Date("2026-03-19T09:00:00.000Z"),
      },
      {
        tenderFileId: "file-3",
        fileName: "Schedule.xlsx",
        text: "C".repeat(700),
        createdAt: new Date("2026-03-19T08:00:00.000Z"),
      },
    ]

    const out = buildSummaryExtractContext(extracts)

    expect(out.context).toContain("[Document 1: Large.pdf]")
    expect(out.context).toContain("[Document 2: Small.docx]")
    expect(out.context).toContain("[Document 3: Schedule.xlsx]")

    expect(out.coverage.fileCountTotal).toBe(3)
    expect(out.coverage.fileCountIncluded).toBe(3)
    expect(out.coverage.totalCharsUsed).toBeGreaterThan(0)
    expect(out.coverage.totalCharsUsed).toBeLessThanOrEqual(32000)
    expect(out.coverage.latestExtractCreatedAt).toBe(
      "2026-03-19T10:00:00.000Z",
    )
    expect(out.coverage.truncatedFileCount).toBeGreaterThanOrEqual(1)
  })
})
