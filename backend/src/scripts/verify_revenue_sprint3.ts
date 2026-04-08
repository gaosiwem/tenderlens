import { prisma } from "../db/prisma"
import { getExperimentBucket } from "../billing/experiments.service"

async function verify() {
  console.log("Starting Revenue Sprint 3 Verification...")

  // 1. Setup Data
  const email = `test-invite-${Date.now()}@example.com`
  const orgName = `Test Org ${Date.now()}`

  // Create a user who invites
  const owner = await prisma.user.create({
    data: {
      email: `owner-${Date.now()}@example.com`,
      passwordHash: "hash",
      name: "Owner",
    },
  })

  const org = await prisma.organization.create({
    data: {
      name: orgName,
      slug: `test-org-${Date.now()}`,
      memberships: {
        create: {
          userId: owner.id,
          role: "OWNER",
        },
      },
    },
  })

  console.log(`Created Org: ${org.id}`)

  // 2. Invites & Accepting
  const token = `inv-${Date.now()}`
  await prisma.orgInvite.create({
    data: {
      orgId: org.id,
      email,
      role: "MEMBER",
      token,
      status: "PENDING",
      createdBy: owner.id,
      expiresAt: new Date(Date.now() + 86400000),
    },
  })

  console.log(`Created Invite: ${token}`)

  // Create invitee user
  const invitee = await prisma.user.create({
    data: {
      email,
      passwordHash: "hash",
      name: "Invitee",
    },
  })

  // Create Subscription
  await prisma.orgSubscription.create({
    data: {
      orgId: org.id,
      plan: "PRO",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 86400000),
      seatsPurchased: 5,
      seatsUsed: 1,
    },
  })

  // 3. Verify Experiments
  const bucket = await getExperimentBucket(org.id, "upgrade_test")
  console.log(`Experiment Bucket: ${bucket.bucket}`)
  const bucket2 = await getExperimentBucket(org.id, "upgrade_test")
  if (bucket.bucket !== bucket2.bucket)
    throw new Error("Experiments not stable")
  console.log("Experiments Stable: OK")

  // 4. Verify Referrals
  const refCode = await prisma.referralCode.create({
    data: { orgId: org.id, userId: owner.id, code: "REF123", active: true },
  })
  console.log(`Referral Code: ${refCode.code}`)

  // 5. Verify Referral Attribution (DB Layer)
  await prisma.referralAttribution.create({
    data: {
      orgId: org.id,
      code: "REF123",
      checkoutReference: "checkout_test_manual",
      customerReference: "customer_test",
      billingReference: "billing_test",
    },
  })

  const attr = await prisma.referralAttribution.findFirst({
    where: { code: "REF123" },
  })
  if (!attr) throw new Error("Attribution not saved")
  console.log("Referral Attribution DB: OK")

  // Cleanup
  await prisma.organization.delete({ where: { id: org.id } })
  await prisma.user.delete({ where: { id: owner.id } })
  await prisma.user.delete({ where: { id: invitee.id } })

  console.log("Verification Complete!")
}

verify().catch(console.error)
