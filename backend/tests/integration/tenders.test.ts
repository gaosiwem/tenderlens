import { describe, it, expect, beforeAll } from "vitest"
import request from "supertest"
import crypto from "crypto"
import { createApp } from "../../src/app"
import { prisma } from "../../src/db/prisma"
import { signAccessToken } from "../../src/utils/jwt"
import { Prisma } from "@prisma/client"

describe("tenders integration", () => {
  const app = createApp()
  let userToken: string
  let orgId: string
  let userId: string
  let hasTenderScrapedColumns = false
  let legacyScrapedTable: "TenderScrapedData" | "ScrapedTenderData" | null = null

  beforeAll(async () => {
    // Create User
    const email = `tender-test-${Date.now()}@example.com`
    const user = await prisma.user.create({
      data: { email, passwordHash: "hash" },
    })
    userId = user.id

    // Create Org
    const org = await prisma.organization.create({
      data: { name: "Tender Corp", slug: `tender-corp-${Date.now()}` },
    })
    orgId = org.id

    // Create Membership
    await prisma.membership.create({
      data: { userId: user.id, orgId: org.id, role: "ADMIN" },
    })
    // create a tender that belongs to the organisation we just made
    // we used to insert `orgId: null` for a global item but the schema
    // currently enforces NOT NULL so we simply attach it to our test org.
    await prisma.tender.create({
      data: {
        orgId: org.id,
        createdByUserId: user.id,
        title: "Seed Tender",
        source: "etenders:seed:001",
        status: "DRAFT",
      },
    })

    const tenderColumnRows = await prisma.$queryRaw<Array<{ exists: boolean }>>(
      Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'Tender'
            AND column_name = 'externalId'
        ) AS "exists"
      `,
    )
    hasTenderScrapedColumns = Boolean(tenderColumnRows[0]?.exists)

    const legacyTableRows = await prisma.$queryRaw<Array<{ table_name: string }>>(
      Prisma.sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('TenderScrapedData', 'ScrapedTenderData')
        ORDER BY CASE WHEN table_name = 'TenderScrapedData' THEN 0 ELSE 1 END
        LIMIT 1
      `,
    )
    const tableName = legacyTableRows[0]?.table_name
    if (tableName === "TenderScrapedData" || tableName === "ScrapedTenderData") {
      legacyScrapedTable = tableName
    }

    userToken = signAccessToken(user.id)
  })

  it("lists tenders", async () => {
    const res = await request(app)
      .get("/api/v1/tenders")
      .set("Authorization", `Bearer ${userToken}`)
      .set("x-org-id", orgId)

    expect(res.status).toBe(200)
    expect(res.body.data.items.length).toBeGreaterThan(0)
    expect(res.body.data.total).toBeGreaterThan(0)
  })

  it("allows a user without any org membership to list tenders", async () => {
    // create a second user directly without an org
    // (normally registerUser would auto-create an org, but this proves
    // the endpoint works without an x-org-id header)
    const loneUser = await prisma.user.create({
      data: { email: `lone-${Date.now()}@example.com`, passwordHash: "hash" },
    });
    const loneToken = signAccessToken(loneUser.id);

    const res = await request(app)
      .get("/api/v1/tenders")
      .set("Authorization", `Bearer ${loneToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.total).toBeGreaterThan(0);
  });

  it("returns persisted scraped data and documents", async () => {
    const tender = await prisma.tender.create({
      data: {
        orgId: orgId, // again attach to the test org so the insert succeeds
        createdByUserId: userId,
        title: "Imported eTender",
        source: "etenders:123456:TN-2026-01",
        status: "DRAFT",
      },
    })

    const docs = JSON.stringify([
      {
        id: "doc-1",
        name: "Tender Notice.pdf",
        path: "https://example.com/doc-1.pdf",
      },
    ])

    if (hasTenderScrapedColumns) {
      await prisma.$executeRawUnsafe(
        `
        UPDATE "Tender"
        SET
          "externalId" = $2,
          "available" = $3,
          "tenderNumber" = $4,
          "description" = $5,
          "category" = $6,
          "companyName" = $7,
          "province" = $8,
          "scrapedStatus" = $9,
          "publishedDate" = $10,
          "closingDate" = $11,
          "documents" = $12::jsonb,
          "updatedAt" = NOW()
        WHERE "id" = $1
        `,
        tender.id,
        123456,
        true,
        "TN-2026-01",
        "Road maintenance and upgrades",
        "Construction",
        "Department of Public Works",
        "Gauteng",
        "Published",
        "2026-02-10",
        "2026-03-01",
        docs,
      )
    } else if (legacyScrapedTable) {
      const tableRef = Prisma.raw(`"${legacyScrapedTable}"`)
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO ${tableRef} (
          "id",
          "orgId",
          "tenderId",
          "source",
          "externalId",
          "available",
          "tenderNumber",
          "description",
          "category",
          "companyName",
          "province",
          "status",
          "publishedDate",
          "closingDate",
          "documents",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${crypto.randomUUID()},
          ${orgId},
          ${tender.id},
          ${"etenders.gov.za"},
          ${123456},
          ${true},
          ${"TN-2026-01"},
          ${"Road maintenance and upgrades"},
          ${"Construction"},
          ${"Department of Public Works"},
          ${"Gauteng"},
          ${"Published"},
          ${"2026-02-10"},
          ${"2026-03-01"},
          ${docs}::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT ("tenderId")
        DO UPDATE SET
          "source" = EXCLUDED."source",
          "externalId" = EXCLUDED."externalId",
          "available" = EXCLUDED."available",
          "tenderNumber" = EXCLUDED."tenderNumber",
          "description" = EXCLUDED."description",
          "category" = EXCLUDED."category",
          "companyName" = EXCLUDED."companyName",
          "province" = EXCLUDED."province",
          "status" = EXCLUDED."status",
          "publishedDate" = EXCLUDED."publishedDate",
          "closingDate" = EXCLUDED."closingDate",
          "documents" = EXCLUDED."documents",
          "updatedAt" = NOW()
      `)
    }

    const scrapedRes = await request(app)
      .get(`/api/v1/tenders/${tender.id}/scraped-data`)
      .set("Authorization", `Bearer ${userToken}`)
      .set("x-org-id", orgId)

    expect(scrapedRes.status).toBe(200)
    expect(scrapedRes.body.data.available).toBe(true)
    expect(scrapedRes.body.data.externalId).toBe(123456)
    expect(scrapedRes.body.data.companyName).toBe("Department of Public Works")

    const docsRes = await request(app)
      .get(`/api/v1/tenders/${tender.id}/external-documents`)
      .set("Authorization", `Bearer ${userToken}`)
      .set("x-org-id", orgId)

    expect(docsRes.status).toBe(200)
    expect(docsRes.body.data.source).toBe("etenders.gov.za")
    expect(docsRes.body.data.items).toEqual([
      {
        id: "doc-1",
        name: "Tender Notice.pdf",
        path: "https://example.com/doc-1.pdf",
      },
    ])
  })

  it("returns outcome insights and reissue candidates for cancelled tenders", async () => {
    const cancelledTender = await prisma.tender.create({
      data: {
        orgId,
        createdByUserId: userId,
        title: "Water Pump Maintenance Contract",
        source: `etenders:${Date.now()}:CANCELLED-1`,
        status: "DRAFT",
        companyName: "City of Tshwane",
        category: "Maintenance",
        closingDate: "2026-03-01",
        scrapedStatus: "Cancelled",
        amount: "R 1 200 000",
      },
    })

    const openTender = await prisma.tender.create({
      data: {
        orgId,
        createdByUserId: userId,
        title: "Water Pump Maintenance Contract Reissue",
        source: `etenders:${Date.now()}:OPEN-1`,
        status: "DRAFT",
        companyName: "City of Tshwane",
        category: "Maintenance",
        closingDate: "2026-05-14",
        scrapedStatus: "Published",
        amount: "R 1 300 000",
      },
    })

    const res = await request(app)
      .get(`/api/v1/tenders/${cancelledTender.id}/outcome-insights`)
      .set("Authorization", `Bearer ${userToken}`)
      .set("x-org-id", orgId)

    expect(res.status).toBe(200)
    expect(res.body.data.lifecycle).toBe("cancelled")
    expect(res.body.data.reissueCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: openTender.id,
          lifecycle: "open",
        }),
      ]),
    )
    expect(res.body.data.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "track_reissue",
        }),
      ]),
    )
  })

  it("scopes outcome insights to the active org and global tenders", async () => {
    const otherOrg = await prisma.organization.create({
      data: { name: "Other Org", slug: `other-org-${Date.now()}` },
    })

    const scopedTender = await prisma.tender.create({
      data: {
        orgId,
        createdByUserId: userId,
        title: "Scoped Awarded Tender",
        source: `etenders:${Date.now()}:SCOPED-1`,
        status: "DRAFT",
        companyName: "Scope Buyer",
        category: "ICT",
        scrapedStatus: "Awarded",
      },
    })

    await prisma.tender.create({
      data: {
        orgId: otherOrg.id,
        createdByUserId: userId,
        title: "Private Tender In Another Org",
        source: `etenders:${Date.now()}:SCOPED-2`,
        status: "DRAFT",
        companyName: "Scope Buyer",
        category: "ICT",
        scrapedStatus: "Awarded",
      },
    })

    const res = await request(app)
      .get(`/api/v1/tenders/${scopedTender.id}/outcome-insights`)
      .set("Authorization", `Bearer ${userToken}`)
      .set("x-org-id", orgId)

    expect(res.status).toBe(200)
    expect(res.body.data.stats.buyerTenderCount).toBe(1)
    expect(res.body.data.similarTenders).toEqual([])
  })

  it("keeps tender history readable after expiry but blocks mutations", async () => {
    const expiredUser = await prisma.user.create({
      data: {
        email: `expired-history-${Date.now()}@example.com`,
        passwordHash: "hash",
      },
    })

    const expiredOrg = await prisma.organization.create({
      data: {
        name: "Expired History Org",
        slug: `expired-history-org-${Date.now()}`,
      },
    })

    await prisma.membership.create({
      data: {
        userId: expiredUser.id,
        orgId: expiredOrg.id,
        role: "ADMIN",
      },
    })

    await prisma.orgSubscription.create({
      data: {
        orgId: expiredOrg.id,
        plan: "TRIAL",
        status: "EXPIRED",
        trialEndsAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    })

    const expiredTender = await prisma.tender.create({
      data: {
        orgId: expiredOrg.id,
        createdByUserId: expiredUser.id,
        title: "Expired Awarded Tender",
        source: `etenders:${Date.now()}:expired-awarded`,
        status: "DRAFT",
        companyName: "Expired Municipality",
        category: "Infrastructure",
        closingDate: "2026-03-01",
        scrapedStatus: "Awarded",
      },
    })

    const expiredToken = signAccessToken(expiredUser.id)

    const listRes = await request(app)
      .get("/api/v1/tenders?lifecycle=awarded")
      .set("Authorization", `Bearer ${expiredToken}`)
      .set("x-org-id", expiredOrg.id)

    expect(listRes.status).toBe(200)
    expect(
      listRes.body.data.items.some(
        (item: { id: string }) => item.id === expiredTender.id,
      ),
    ).toBe(true)

    const detailRes = await request(app)
      .get(`/api/v1/tenders/${expiredTender.id}`)
      .set("Authorization", `Bearer ${expiredToken}`)
      .set("x-org-id", expiredOrg.id)

    expect(detailRes.status).toBe(200)
    expect(detailRes.body.data.id).toBe(expiredTender.id)

    const uploadRes = await request(app)
      .post(`/api/v1/tenders/${expiredTender.id}/files`)
      .set("Authorization", `Bearer ${expiredToken}`)
      .set("x-org-id", expiredOrg.id)
      .attach("file", Buffer.from("blocked upload"), {
        filename: "blocked.txt",
        contentType: "text/plain",
      })

    expect(uploadRes.status).toBe(403)
    expect(uploadRes.body?.error?.code).toBe("PLAN_EXPIRED")
  })
})
