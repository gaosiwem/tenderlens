import { PrismaClient } from "@prisma/client"
import { hashPassword } from "./src/utils/crypto"

const prisma = new PrismaClient()

async function main() {
  const email = "admin@tenderlens.co.za"
  const password = "administrator123!"

  // Hash the password
  const passwordHash = await hashPassword(password)

  // Check if user exists
  let user = await prisma.user.findUnique({
    where: { email },
  })

  if (user) {
    // Update password
    user = await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    })
    console.log(`Updated existing user: ${email}`)
  } else {
    // Create user
    user = await prisma.user.create({
      data: {
        email,
        name: "Admin",
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    })
    console.log(`Created new user: ${email}`)
  }

  // Create or find an Admin Organization
  let org = await prisma.organization.findFirst({
    where: { name: "Admin Organization" },
  })

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Admin Organization",
        slug: "admin-organization",
      },
    })
    console.log(`Created Admin Organization`)
  }

  // Ensure user is an ADMIN in the organization
  const membershipExists = await prisma.membership.findUnique({
    where: {
      userId_orgId: {
        userId: user.id,
        orgId: org.id,
      },
    },
  })

  if (!membershipExists) {
    await prisma.membership.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role: "ADMIN",
        isBillingAdmin: true,
      },
    })
    console.log(`Added user as ADMIN to organization`)
  } else if (membershipExists.role !== "ADMIN") {
    await prisma.membership.update({
      where: {
        userId_orgId: {
          userId: user.id,
          orgId: org.id,
        },
      },
      data: {
        role: "ADMIN",
        isBillingAdmin: true,
      },
    })
    console.log(`Updated user role to ADMIN in organization`)
  } else {
    console.log(`User is already an ADMIN in organization`)
  }

  console.log("Admin user creation successful.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
