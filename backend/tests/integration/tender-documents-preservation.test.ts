import { describe, expect, it } from "vitest"
import { mergePersistedExternalDocuments } from "../../src/modules/tenders/tender.service"

describe("tender external document preservation", () => {
  it("keeps original documents when a later scrape returns no documents", () => {
    const existing = [
      {
        id: "doc-1",
        name: "Original Tender.pdf",
        path: "https://example.com/original.pdf",
        archivedStorageKey: null,
        archivedMimeType: null,
        archivedSizeBytes: null,
        archivedChecksumSha256: null,
        archivedAt: null,
      },
    ]

    const merged = mergePersistedExternalDocuments(existing, [])

    expect(merged).toHaveLength(1)
    expect(merged[0]?.id).toBe("doc-1")
    expect(merged[0]?.name).toBe("Original Tender.pdf")
  })

  it("preserves archived metadata when the same document is seen again", () => {
    const existing = [
      {
        id: "doc-1",
        name: "Original Tender.pdf",
        path: "https://example.com/original.pdf",
        archivedStorageKey: "tenders/external-documents/tender-1/doc-1.pdf",
        archivedMimeType: "application/pdf",
        archivedSizeBytes: null,
        archivedChecksumSha256: null,
        archivedAt: null,
      },
    ]

    const incoming = [
      {
        id: "doc-1",
        name: "Original Tender.pdf",
        path: "https://example.com/original.pdf",
        archivedStorageKey: null,
        archivedMimeType: null,
        archivedSizeBytes: null,
        archivedChecksumSha256: null,
        archivedAt: null,
      },
    ]

    const merged = mergePersistedExternalDocuments(existing, incoming)

    expect(merged).toHaveLength(1)
    expect(merged[0]?.archivedStorageKey).toBe(
      "tenders/external-documents/tender-1/doc-1.pdf",
    )
    expect(merged[0]?.archivedMimeType).toBe("application/pdf")
  })
})
