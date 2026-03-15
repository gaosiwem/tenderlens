
import { prisma } from '../src/db/prisma'
import { Role, PlanType, SubscriptionStatus } from '@prisma/client'
import argon2 from 'argon2'

async function main() {
  const adminEmail = 'admin@tenderlens.co.za'
  const adminPassword = 'administrator123'
  const adminOrgName = 'Admin Organization'

  // 1. Ensure Admin Organization
  let adminOrg = await prisma.organization.findFirst({
    where: { name: adminOrgName }
  })

  if (!adminOrg) {
    adminOrg = await prisma.organization.create({
      data: {
        name: adminOrgName,
        slug: 'admin',
      }
    })
    console.log('Created Admin Organization')
  }

  // 2. Ensure Admin User
  const hashedPassword = await argon2.hash(adminPassword)
  let adminUser = await prisma.user.findUnique({
    where: { email: adminEmail }
  })

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashedPassword,
        name: 'System Admin',
        emailVerifiedAt: new Date(),
      }
    })
    console.log('Created Admin User')
  } else {
    adminUser = await prisma.user.update({
      where: { email: adminEmail },
      data: {
        passwordHash: hashedPassword,
      }
    })
    console.log('Updated Admin User')
  }

  // 3. Ensure Org Membership
  const membershipValue = await prisma.membership.findUnique({
    where: {
      userId_orgId: {
        userId: adminUser.id,
        orgId: adminOrg.id
      }
    }
  })

  if (!membershipValue) {
    await prisma.membership.create({
      data: {
        userId: adminUser.id,
        orgId: adminOrg.id,
        role: Role.ADMIN, // Org level role
      }
    })
    console.log('Assigned Admin User to Admin Org')
  }

  // 4. Ensure Enterprise Subscription
  const sub = await prisma.orgSubscription.findUnique({
    where: { orgId: adminOrg.id }
  })

  if (!sub) {
    await prisma.orgSubscription.create({
      data: {
        orgId: adminOrg.id,
        plan: PlanType.ENTERPRISE,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year
      }
    })
    console.log('Created Enterprise Subscription for Admin Org')
  } else {
    await prisma.orgSubscription.update({
      where: { orgId: adminOrg.id },
      data: {
        plan: PlanType.ENTERPRISE,
        status: SubscriptionStatus.ACTIVE,
      }
    })
    console.log('Updated existing subscription to Enterprise')
  }

  console.log('Verification Complete: Admin system is ready.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
